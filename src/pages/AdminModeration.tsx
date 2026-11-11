import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Flag,
  History,
  Download,
  MapPin,
  Megaphone,
  MessageCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  dismissViolation,
  getPendingReports,
  getPendingViolationAppeals,
  isModerator,
  reviewViolation,
  reviewViolationAppeal,
} from '../lib/api'
import { fetchSOSAlerts, fetchPendingVerifications, fetchRecentReviews, fetchFeedbackForModerator, reviewFeedback, mapLink, reviewSOSAlert, reviewVerification } from '../lib/moderation'
import type { SOSAlert, SOSStatus, VerificationSubmission, RecentReview, ReportForAdmin } from '../lib/moderation'
import type { Violation, ViolationSeverity } from '../types'
import { VIOLATION_CATEGORIES } from '../types'
import { useNotifications } from '../context/NotificationContext'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import ReviewDetailSheet from '../components/ReviewDetailSheet'

const SEVERITY_LABELS: Record<string, string> = {
  warning: 'a warning',
  suspension_24h: 'a 24-hour suspension',
  suspension_7d: 'a 7-day suspension',
  suspension_30d: 'a 30-day suspension',
  permanent_ban: 'a permanent ban',
}

function csvEscape(value: string) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function toCsv(items: Array<RecentReview & { summary: string }>) {
  const header = ['Kind', 'Title', 'Status', 'Member', 'Username', 'Note', 'Reviewed at']
  const body = items.map((item) =>
    [item.kind, item.summary, item.status, item.display_name ?? '', item.username ?? '', item.note ?? '', item.reviewed_at]
      .map(csvEscape)
      .join(','),
  )
  return [header.map(csvEscape).join(','), ...body].join('\r\n')
}

function downloadCsv(items: Array<RecentReview & { summary: string }>) {
  const blob = new Blob([`\ufeff${toCsv(items)}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `comewme-reviews-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type PendingAppeal = Awaited<ReturnType<typeof getPendingViolationAppeals>>[number]

const SOS_STATUS_STYLE: Record<SOSStatus, string> = {
  pending: 'bg-alert/10 text-alert',
  reviewed: 'bg-sun/25 text-amber',
  resolved: 'bg-verified/15 text-verified',
  false_alarm: 'bg-line text-muted',
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

function CollapsibleSection({
  title,
  count,
  sub,
  urgent,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  sub?: string
  urgent?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-canvas"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold leading-none tabular-nums ${
            urgent && count > 0 ? 'bg-alert text-white' : 'bg-line text-muted'
          }`}
        >
          {count}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display text-[15px] font-bold leading-tight text-ink">{title}</span>
          {sub && (
            <span className="mt-0.5 block truncate text-[11px] text-muted">{sub}</span>
          )}
        </span>
        <ChevronDown
          size={19}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="border-t border-line px-3 py-3 sm:px-4">{children}</div>}
    </section>
  )
}

export default function AdminModeration() {
  const { moderation, refresh: refreshBadges } = useNotifications()

  const [moderator, setModerator] = useState<boolean | null>(null)
  const [reports, setReports] = useState<Violation[]>([])
  const [appeals, setAppeals] = useState<PendingAppeal[]>([])
  const [alerts, setAlerts] = useState<SOSAlert[]>([])
  const [verifications, setVerifications] = useState<VerificationSubmission[]>([])
  const [feedback, setFeedback] = useState<ReportForAdmin[]>([])
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({})
  const [recent, setRecent] = useState<RecentReview[]>([])
  const [recentOpen, setRecentOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<RecentReview | null>(null)
  const [recentFilter, setRecentFilter] = useState<'all' | RecentReview['kind']>('all')
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    sos: true,
    verifications: true,
    feedback: true,
    ads: true,
    reports: true,
    appeals: true,
    recent: false,
  })
  const toggleSection = (id: string) => setOpenSection((prev) => ({ ...prev, [id]: !prev[id] }))
  const [severity, setSeverity] = useState<Record<string, ViolationSeverity>>({})
  const [actions, setActions] = useState<Record<string, string>>({})
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [sosNotes, setSosNotes] = useState<Record<string, string>>({})
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ kind: 'review' | 'dismiss'; id: string } | null>(null)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [recentQuery, setRecentQuery] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const allowed = await isModerator()
      setModerator(allowed)
      if (!allowed) return
      const [pendingReports, pendingAppeals, sos, pendingVerifications, recentReviews, pendingFeedback] = await Promise.all([
        getPendingReports(),
        getPendingViolationAppeals(),
        fetchSOSAlerts().catch(() => [] as SOSAlert[]),
        fetchPendingVerifications().catch(() => [] as VerificationSubmission[]),
        fetchRecentReviews(30).catch(() => [] as RecentReview[]),
        fetchFeedbackForModerator().catch(() => [] as ReportForAdmin[]),
      ])
      setReports(pendingReports)
      setAppeals(pendingAppeals)
      setAlerts(sos)
      setVerifications(pendingVerifications)
      setRecent(recentReviews)
      setFeedback(pendingFeedback)
      // Selection is anchored to the pending list — after a refresh, drop ids that are no longer pending
      setSelectedReports((prev) => new Set(pendingReports.filter((r) => prev.has(r.id)).map((r) => r.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the moderation queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleReview(reportId: string) {
    setBusy(reportId)
    setError(null)
    try {
      await reviewViolation(reportId, severity[reportId] ?? 'warning', actions[reportId] ?? '')
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not review this report.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDismiss(reportId: string) {
    setBusy(reportId)
    setError(null)
    try {
      await dismissViolation(reportId, actions[reportId] ?? '')
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not dismiss this report.')
    } finally {
      setBusy(null)
    }
  }

  async function handleAppeal(appealId: string, decision: 'granted' | 'denied') {
    setBusy(appealId)
    setError(null)
    try {
      await reviewViolationAppeal(appealId, decision, responses[appealId] ?? '')
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not review this appeal.')
    } finally {
      setBusy(null)
    }
  }

  const selectedCount = selectedReports.size
  const allReportsSelected = reports.length > 0 && selectedCount === reports.length

  function toggleAllReports() {
    setSelectedReports(allReportsSelected ? new Set() : new Set(reports.map((r) => r.id)))
  }

  function toggleReport(id: string) {
    setSelectedReports((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDismiss() {
    setBulkConfirmOpen(false)
    setBulkBusy(true)
    setError(null)
    try {
      for (const id of selectedReports) {
        await dismissViolation(id, 'Bulk dismissal — no action warranted')
      }
      setSelectedReports(new Set())
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not dismiss the selected reports.')
    } finally {
      setBulkBusy(false)
    }
  }

  const filteredRecent = useMemo(() => {
    const q = recentQuery.trim().toLowerCase()
    return recent.filter((item) => {
      if (recentFilter !== 'all' && item.kind !== recentFilter) return false
      if (!q) return true
      return [item.title, item.display_name ?? '', item.username ?? '', item.note ?? '', item.status, item.kind].join(' ').toLowerCase().includes(q)
    })
  }, [recent, recentQuery, recentFilter])

  const exportable = useMemo(
    () => filteredRecent.map((item) => ({ ...item, summary: prettyTitle(item) })),
    [filteredRecent],
  )

  const recentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of recent) counts[r.kind] = (counts[r.kind] ?? 0) + 1
    return counts
  }, [recent])

  async function handleSOS(alert: SOSAlert, status: SOSStatus) {
    setBusy(alert.id)
    setError(null)
    try {
      await reviewSOSAlert(alert.id, status, sosNotes[alert.id]?.trim() || null)
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this SOS alert.')
    } finally {
      setBusy(null)
    }
  }

  async function handleVerification(id: string, status: 'approved' | 'rejected') {
    setBusy(id)
    setError(null)
    try {
      await reviewVerification(id, status, verificationNotes[id] ?? null)
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this verification.')
    } finally {
      setBusy(null)
    }
  }

  async function handleFeedback(id: string, status: 'reviewing' | 'resolved') {
    setBusy(id)
    setError(null)
    try {
      await reviewFeedback(id, status, feedbackNotes[id] ?? null)
      await load()
      void refreshBadges()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this feedback item.')
    } finally {
      setBusy(null)
    }
  }

  const pendingSOS = alerts.filter((a) => a.status === 'pending')

  if (loading) return <Spinner />

  return (
    <div className="min-h-[100dvh] pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-[13px] font-semibold text-amber">Back</Link>
        <h1 className="font-display text-[18px] font-bold">Moderation inbox</h1>
      </header>

      <main className="mx-auto max-w-[720px] space-y-5 px-4 py-5">
        {moderator === false ? (
          <div className="card rounded-2xl p-5">
            <h2 className="font-semibold">This page is for moderators</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Only accounts listed in <code>public.moderators</code> can open the inbox. A project
              owner can add your user ID there in Supabase.
            </p>
          </div>
        ) : (
          <>
            {/* SOS */}
            <CollapsibleSection
              title="SOS alerts"
              count={pendingSOS.length}
              sub={pendingSOS.length === 0 ? 'All clear' : 'Tap to review'}
              urgent
              open={openSection.sos}
              onToggle={() => toggleSection('sos')}
            >
              {alerts.length === 0 && (
                <p className="rounded-xl border border-line bg-canvas p-4 text-[13px] text-muted">
                  No SOS alerts yet. When someone presses SOS during an activity, it lands here and a
                  red banner appears on every moderator screen.
                </p>
              )}

              <div className="space-y-3">
                {alerts.map((alert) => {
                  const map = mapLink(alert.location_lat, alert.location_lng, alert.location_address)
                  return (
                    <article
                      key={alert.id}
                      className={`card rounded-2xl p-4 ${alert.status === 'pending' ? 'border-alert/40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                            <AlertTriangle size={15} className="shrink-0 text-alert" />
                            {alert.display_name || 'Member'}
                            {alert.username && (
                              <span className="text-[11px] font-normal text-muted">@{alert.username}</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted">
                            {alert.task_title || 'Activity'} · {timeAgo(alert.created_at)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SOS_STATUS_STYLE[alert.status]}`}>
                          {alert.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-[12px]">
                        <MapPin size={13} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate text-ink">
                          {alert.location_address || 'No street address captured'}
                        </span>
                        {map && (
                          <a
                            href={map}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 font-semibold text-amber"
                          >
                            Map <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      {alert.media_url && (
                        <a href={alert.media_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-canvas px-2 py-1 text-[11px] font-semibold text-ink">
                          {alert.media_type === 'video' ? 'Open video' : 'Open photo'}
                          <ExternalLink size={11} />
                        </a>
                      )}

                      {alert.admin_note && (
                        <p className="mt-2 rounded-lg bg-canvas p-2 text-[11px] text-muted">
                          Note: {alert.admin_note}
                        </p>
                      )}

                      {alert.status === 'pending' && (
                        <>
                          <input
                            className="field mt-3 py-2 text-[12px]"
                            placeholder="Note for the record (optional)"
                            value={sosNotes[alert.id] ?? ''}
                            onChange={(e) => setSosNotes({ ...sosNotes, [alert.id]: e.target.value })}
                          />
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <button
                              className="btn-ghost btn-sm"
                              disabled={busy !== null}
                              onClick={() => void handleSOS(alert, 'reviewed')}
                            >
                              <Check size={13} />
                              Seen
                            </button>
                            <button
                              className="btn-primary btn-sm"
                              disabled={busy !== null}
                              onClick={() => void handleSOS(alert, 'resolved')}
                            >
                              <CheckCheck size={13} />
                              Resolved
                            </button>
                            <button
                              className="btn-ghost btn-sm"
                              disabled={busy !== null}
                              onClick={() => void handleSOS(alert, 'false_alarm')}
                            >
                              <X size={13} />
                              False
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  )
                })}
              </div>
            </CollapsibleSection>

            {/* Member feedback */}
            <CollapsibleSection
              title="Member feedback"
              count={feedback.filter((f) => f.status !== 'resolved').length}
              sub={feedback.filter((f) => f.status !== 'resolved').length > 0 ? 'Tap to review feedback' : 'No new feedback'}
              urgent={feedback.some((f) => f.status === 'open')}
              open={openSection.feedback}
              onToggle={() => toggleSection('feedback')}
            >
              {feedback.length === 0 && (
                <p className="rounded-xl border border-line bg-canvas p-4 text-[13px] text-muted">
                  Nothing yet. Bug reports, complaints and suggestions arrive here — you read them, decide what to do, and optionally send a short note back.
                </p>
              )}

              <div className="space-y-3">
                {feedback.map((item) => {
                  const name = item.reporter_name || 'Member'
                  const handle = item.reporter_username ? `@${item.reporter_username}` : null
                  const STATUS_TONE: Record<string, string> = {
                    open: 'bg-sun/25 text-amber',
                    reviewing: 'bg-[#eef4fb] text-[#4273a8]',
                    resolved: 'bg-verified/15 text-verified',
                  }
                  return (
                    <article key={item.id} className="card rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold">{name}</p>
                          <p className="text-[11px] text-muted">
                            {handle ? `${handle} · ` : ''}{new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                            {item.task_title && ` · on "${item.task_title}"`}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[item.status] ?? 'bg-line text-muted'}`}>
                          {item.status === 'open' ? 'New' : item.status}
                        </span>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{item.details}</p>
                      {item.reported_name && (
                        <p className="mt-1 text-[11px] text-muted">About: <span className="font-semibold text-ink">{item.reported_name}</span></p>
                      )}

                      {item.admin_note && (
                        <p className="mt-2 rounded-lg bg-canvas p-2 text-[11px] text-muted">Your reply: {item.admin_note}</p>
                      )}

                      <textarea
                        className="field mt-3 min-h-[60px] py-2 text-[12px]"
                        placeholder="Reply to this member (optional)"
                        value={feedbackNotes[item.id] ?? ''}
                        onChange={(e) => setFeedbackNotes({ ...feedbackNotes, [item.id]: e.target.value })}
                        maxLength={500}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          className="btn-ghost btn-sm flex-1"
                          disabled={busy !== null}
                          onClick={() => void handleFeedback(item.id, 'reviewing')}
                        >
                          Mark reviewing
                        </button>
                        <button
                          className="btn-primary btn-sm flex-1"
                          disabled={busy !== null}
                          onClick={() => void handleFeedback(item.id, 'resolved')}
                        >
                          Done & reply
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </CollapsibleSection>

            {/* Selfie verification queue */}
            <CollapsibleSection
              title="Selfie verification"
              count={verifications.length}
              sub={verifications.length === 0 ? 'All clear' : 'Tap to review'}
              urgent={verifications.length > 0}
              open={openSection.verifications}
              onToggle={() => toggleSection('verifications')}
            >
              {verifications.length === 0 && (
                <p className="rounded-xl border border-line bg-canvas p-4 text-[13px] text-muted">
                  Nothing waiting. When a member sends a selfie, match it against their profile photo and approve — the green check flips on instantly.
                </p>
              )}

              <div className="space-y-3">
                {verifications.map((sub) => {
                  const name = sub.display_name || 'Member'
                  return (
                    <article key={sub.id} className="card rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold">{name}</p>
                          <p className="text-[11px] text-muted">
                            {sub.username ? `@${sub.username} · ` : ''}
                            Sent {timeAgo(sub.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-sun/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                          Pending
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <figure className="overflow-hidden rounded-xl border border-line bg-canvas">
                          <p className="border-b border-line bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            Profile photo
                          </p>
                          {sub.avatar_url ? (
                            <img src={sub.avatar_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-40 items-center justify-center text-[11px] text-muted">No profile photo</div>
                          )}
                        </figure>
                        <figure className="overflow-hidden rounded-xl border border-line bg-canvas">
                          <p className="border-b border-line bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            Selfie
                          </p>
                          {sub.selfie_url ? (
                            <a href={sub.selfie_url} target="_blank" rel="noopener noreferrer">
                              <img src={sub.selfie_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
                            </a>
                          ) : (
                            <div className="flex h-40 items-center justify-center text-[11px] text-muted">Could not load</div>
                          )}
                        </figure>
                      </div>

                      <input
                        className="field mt-3 py-2 text-[12px]"
                        placeholder="Note to the member (optional)"
                        value={verificationNotes[sub.id] ?? ''}
                        onChange={(e) => setVerificationNotes({ ...verificationNotes, [sub.id]: e.target.value })}
                      />

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="btn-primary btn-sm flex-1"
                          disabled={busy !== null}
                          onClick={() => void handleVerification(sub.id, 'approved')}
                        >
                          <Check size={14} />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm flex-1 text-alert"
                          disabled={busy !== null}
                          onClick={() => void handleVerification(sub.id, 'rejected')}
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </CollapsibleSection>

            {/* Ads */}
            <CollapsibleSection
              title="Ad review"
              count={moderation.ads}
              sub={moderation.ads > 0 ? 'Tap to approve ads' : 'No ads waiting'}
              urgent={moderation.ads > 0}
              open={openSection.ads}
              onToggle={() => toggleSection('ads')}
            >
              <Link to="/admin/ads" className="flex items-center justify-between rounded-xl border border-line bg-canvas p-4 transition active:bg-line">
                <span>
                  <span className="block text-[14px] font-semibold">Open the ad review queue</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {moderation.ads > 0
                      ? `${moderation.ads} ad${moderation.ads === 1 ? '' : 's'} waiting for approval — approve to run on Discover`
                      : 'No ads waiting for approval'}
                  </span>
                </span>
                <span aria-hidden className="text-muted">→</span>
              </Link>
            </CollapsibleSection>

            {/* Reports */}
            <CollapsibleSection
              title="Pending reports"
              count={reports.length}
              sub={reports.length === 0 ? 'All clear' : 'Tap to review'}
              urgent={reports.length > 0}
              open={openSection.reports}
              onToggle={() => toggleSection('reports')}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-muted">{reports.length > 0 ? 'Select all to bulk-dismiss' : ''}</span>
                {reports.length > 0 && (
                  <button type="button" className="btn-ghost btn-sm" onClick={toggleAllReports}>
                    {allReportsSelected ? 'Clear selection' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {reports.length === 0 && <p className="text-[13px] text-muted">No reports waiting for review.</p>}
                {reports.map((report) => (
                  <article key={report.id} className="card rounded-2xl p-4">
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-muted">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#ff9f1c]"
                        checked={selectedReports.has(report.id)}
                        onChange={() => toggleReport(report.id)}
                        aria-label="Select this report"
                      />
                      Select this report
                    </label>
                    <p className="text-[12px] text-muted">
                      {VIOLATION_CATEGORIES.find((item) => item.value === report.category)?.label} ·{' '}
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-muted">Reported account: {report.user_id}</p>
                    {report.reported_task_id && (
                      <p className="mt-1 break-all text-[11px] text-muted">Related activity: {report.reported_task_id}</p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{report.description}</p>
                    <label className="label mt-3" htmlFor={`severity-${report.id}`}>Action</label>
                    <select
                      id={`severity-${report.id}`}
                      className="field"
                      value={severity[report.id] ?? 'warning'}
                      onChange={(event) => setSeverity({ ...severity, [report.id]: event.target.value as ViolationSeverity })}
                    >
                      <option value="warning">Warning</option>
                      <option value="suspension_24h">Suspend 24 hours</option>
                      <option value="suspension_7d">Suspend 7 days</option>
                      <option value="suspension_30d">Suspend 30 days</option>
                      <option value="permanent_ban">Permanent ban</option>
                    </select>
                    <label className="label mt-3" htmlFor={`action-${report.id}`}>Message to the user (optional)</label>
                    <textarea
                      id={`action-${report.id}`}
                      className="field min-h-[72px]"
                      value={actions[report.id] ?? ''}
                      maxLength={1000}
                      onChange={(event) => setActions({ ...actions, [report.id]: event.target.value })}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="btn-primary" disabled={busy !== null} onClick={() => setConfirmAction({ kind: 'review', id: report.id })}>
                        {busy === report.id ? 'Saving…' : 'Apply action'}
                      </button>
                      <button className="btn-ghost" disabled={busy !== null} onClick={() => setConfirmAction({ kind: 'dismiss', id: report.id })}>
                        {busy === report.id ? 'Saving…' : 'Dismiss report'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {selectedCount > 0 && (
                <div className="sticky bottom-[76px] z-20 mt-3 flex items-center justify-between gap-2 rounded-xl border border-alert/30 bg-white p-2 shadow-sm">
                  <p className="pl-1 text-[12px] font-semibold text-ink">{selectedCount} selected</p>
                  <button
                    className="btn-ghost btn-sm text-alert"
                    disabled={bulkBusy}
                    onClick={() => setBulkConfirmOpen(true)}
                  >
                    {bulkBusy ? 'Dismissing…' : 'Dismiss selected'}
                  </button>
                </div>
              )}
            </CollapsibleSection>

            {/* Appeals */}
            <CollapsibleSection
              title="Appeals"
              count={appeals.length}
              sub={appeals.length === 0 ? 'All clear' : 'Tap to review'}
              urgent={appeals.length > 0}
              open={openSection.appeals}
              onToggle={() => toggleSection('appeals')}
            >
              <div className="space-y-3">
                {appeals.length === 0 && <p className="rounded-xl border border-line bg-canvas p-4 text-[13px] text-muted">No appeals waiting for review.</p>}
                {appeals.map((appeal) => (
                  <article key={appeal.id} className="card rounded-2xl p-4">
                    <p className="text-[12px] text-muted">
                      {VIOLATION_CATEGORIES.find((item) => item.value === appeal.violation_category)?.label} ·{' '}
                      {new Date(appeal.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-[12px] text-muted">Original report: {appeal.violation_description}</p>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">
                      <strong>Appeal:</strong> {appeal.appeal_reason}
                    </p>
                    <label className="label mt-3" htmlFor={`response-${appeal.id}`}>Response to user (optional)</label>
                    <textarea
                      id={`response-${appeal.id}`}
                      className="field min-h-[72px]"
                      maxLength={1000}
                      value={responses[appeal.id] ?? ''}
                      onChange={(event) => setResponses({ ...responses, [appeal.id]: event.target.value })}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="btn-primary" disabled={busy !== null} onClick={() => void handleAppeal(appeal.id, 'granted')}>
                        {busy === appeal.id ? 'Saving…' : 'Grant & reinstate'}
                      </button>
                      <button className="btn-ghost" disabled={busy !== null} onClick={() => void handleAppeal(appeal.id, 'denied')}>
                        Deny appeal
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">
                      Granting immediately restores their posting and joining rights.
                    </p>
                  </article>
                ))}
              </div>
            </CollapsibleSection>

            {/* Recently reviewed — collapsed by default, newest first */}
            <section>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-white p-4 text-left transition hover:border-amber/40"
                onClick={() => setRecentOpen((v) => !v)}
                aria-expanded={recentOpen}
                aria-controls="reviewed-panel"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <History size={16} className="text-amber" aria-hidden />
                  Recently reviewed{filteredRecent.length > 0 ? ` (${filteredRecent.length}${recentQuery ? ` of ${recent.length}` : ''})` : ''}
                </span>
                <ChevronDown size={18} className={`shrink-0 transition-transform duration-200 ${recentOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {recentOpen && (
                <div id="reviewed-panel" className="mt-2 space-y-2">
                  {/* Category chips — jump straight to the queue you care about */}
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { id: 'all', label: 'All' },
                      { id: 'sos', label: 'SOS' },
                      { id: 'report', label: 'Reports' },
                      { id: 'appeal', label: 'Appeals' },
                      { id: 'ad', label: 'Ads' },
                      { id: 'verification', label: 'Selfies' },
                      { id: 'feedback', label: 'Feedback' },
                    ] as Array<{ id: 'all' | RecentReview['kind']; label: string }>).map(({ id, label }) => {
                      const active = recentFilter === id
                      const n = id === 'all' ? recent.length : recentCounts[id] ?? 0
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setRecentFilter(id)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                            active ? 'border-amber/40 bg-sun/20 text-ink' : 'border-line bg-white text-muted'
                          }`}
                        >
                          {label} ({n})
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className="ml-auto flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:text-ink"
                      onClick={() => downloadCsv(exportable)}
                      aria-label="Export filtered reviews as CSV"
                      title="Download the currently filtered list as CSV"
                    >
                      <Download size={12} aria-hidden />
                      Export
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                    <Search size={14} className="shrink-0 text-muted" aria-hidden />
                    <input
                      className="min-w-0 flex-1 bg-transparent py-1 text-[12px] outline-none placeholder:text-muted"
                      placeholder="Search name, @handle, keyword, note…"
                      aria-label="Search reviewed history"
                      value={recentQuery}
                      onChange={(event) => setRecentQuery(event.target.value)}
                    />
                    {recentQuery && (
                      <button type="button" className="text-[11px] font-semibold text-muted underline underline-offset-2" onClick={() => setRecentQuery('')}>
                        Clear
                      </button>
                    )}
                  </div>
                  {filteredRecent.length === 0 && (
                    <p className="rounded-xl border border-line bg-white p-4 text-[12px] leading-relaxed text-muted">
                      {recentQuery || recentFilter !== 'all'
                        ? 'No reviewed items match that filter.'
                        : 'Nothing here yet. Everything you approve, reject, dismiss or resolve gathers here for later — nothing is ever thrown away.'}
                    </p>
                  )}
                  {filteredRecent.map((item) => (
                    <RecentItem key={`${item.kind}:${item.id}`} item={item} onSelect={() => setDetailItem(item)} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

      {confirmAction && (
        <ConfirmDialog
          open
          destructive
          busy={busy !== null}
          title={confirmAction.kind === 'dismiss' ? 'Dismiss this report?' : 'Apply this action?'}
          message={
            confirmAction.kind === 'dismiss'
              ? 'No action is taken and the member is never notified. The report is closed for good.'
              : `This applies "${SEVERITY_LABELS[severity[confirmAction.id] ?? 'warning']}" to the reported member. It can't be undone.`
          }
          cancelLabel="Keep it"
          confirmLabel={confirmAction.kind === 'dismiss' ? 'Dismiss' : 'Apply'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const target = confirmAction
            setConfirmAction(null)
            if (target.kind === 'dismiss') void handleDismiss(target.id)
            else void handleReview(target.id)
          }}
        />
      )}

      {bulkConfirmOpen && (
        <ConfirmDialog
          open
          destructive
          busy={bulkBusy}
          title={`Dismiss ${selectedCount} report${selectedCount === 1 ? '' : 's'}?`}
          message="No action is taken and the members are never notified. Each report is marked resolved and disappears from the queue for good."
          cancelLabel="Keep reviewing"
          confirmLabel={`Dismiss ${selectedCount}`}
          onCancel={() => setBulkConfirmOpen(false)}
          onConfirm={() => void handleBulkDismiss()}
        />
      )}

      <ReviewDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />

        {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-[13px] text-alert">{error}</p>}
      </main>
    </div>
  )
}

const KIND_ICON = {
  sos: ShieldAlert,
  report: Flag,
  appeal: MessageCircle,
  ad: Megaphone,
  verification: ShieldCheck,
  feedback: MessageCircle,
} as const

const RECENT_STATUS_STYLE: Record<string, string> = {
  approved: 'bg-verified/15 text-verified',
  resolved: 'bg-verified/15 text-verified',
  granted: 'bg-verified/15 text-verified',
  reviewed: 'bg-sun/25 text-amber',
  rejected: 'bg-alert/10 text-alert',
  denied: 'bg-alert/10 text-alert',
  false_alarm: 'bg-line text-muted',
  paused: 'bg-line text-muted',
}

function prettyTitle(item: RecentReview) {
  if (item.kind === 'report') {
    return VIOLATION_CATEGORIES.find((c) => c.value === item.title)?.label ?? item.title
  }
  if (item.kind === 'appeal' && item.title.startsWith('appeal — ')) {
    const slug = item.title.slice('appeal — '.length)
    const label = VIOLATION_CATEGORIES.find((c) => c.value === slug)?.label ?? slug
    return `Appeal — ${label}`
  }
  return item.title
}

function RecentItem({ item, onSelect }: { item: RecentReview; onSelect: () => void }) {
  const Icon = KIND_ICON[item.kind]
  const name = item.display_name || 'Member'
  const status = item.status.toUpperCase()
  const tone = RECENT_STATUS_STYLE[item.status] ?? 'bg-line text-muted'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Open details for ${prettyTitle(item)}`}
      className="card flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:border-amber/40"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-muted" aria-hidden>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{prettyTitle(item)}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {name}
          {item.username ? ` @${item.username}` : ''} · {timeAgo(item.reviewed_at)}
        </p>
        {item.note && (
          <p className="mt-1.5 rounded-lg bg-canvas p-2 text-[11px] leading-relaxed text-ink/80">{item.note}</p>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone}`}>
        {status}
      </span>
    </button>
  )
}

