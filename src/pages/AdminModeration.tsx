import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ExternalLink,
  MapPin,
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
import { fetchSOSAlerts, fetchPendingVerifications, mapLink, reviewSOSAlert, reviewVerification } from '../lib/moderation'
import type { SOSAlert, SOSStatus, VerificationSubmission } from '../lib/moderation'
import type { Violation, ViolationSeverity } from '../types'
import { VIOLATION_CATEGORIES } from '../types'
import { useNotifications } from '../context/NotificationContext'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'

const SEVERITY_LABELS: Record<string, string> = {
  warning: 'a warning',
  suspension_24h: 'a 24-hour suspension',
  suspension_7d: 'a 7-day suspension',
  suspension_30d: 'a 30-day suspension',
  permanent_ban: 'a permanent ban',
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

export default function AdminModeration() {
  const { moderation, refresh: refreshBadges } = useNotifications()

  const [moderator, setModerator] = useState<boolean | null>(null)
  const [reports, setReports] = useState<Violation[]>([])
  const [appeals, setAppeals] = useState<PendingAppeal[]>([])
  const [alerts, setAlerts] = useState<SOSAlert[]>([])
  const [verifications, setVerifications] = useState<VerificationSubmission[]>([])
  const [severity, setSeverity] = useState<Record<string, ViolationSeverity>>({})
  const [actions, setActions] = useState<Record<string, string>>({})
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [sosNotes, setSosNotes] = useState<Record<string, string>>({})
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ kind: 'review' | 'dismiss'; id: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const allowed = await isModerator()
      setModerator(allowed)
      if (!allowed) return
      const [pendingReports, pendingAppeals, sos, pendingVerifications] = await Promise.all([
        getPendingReports(),
        getPendingViolationAppeals(),
        fetchSOSAlerts().catch(() => [] as SOSAlert[]),
        fetchPendingVerifications().catch(() => [] as VerificationSubmission[]),
      ])
      setReports(pendingReports)
      setAppeals(pendingAppeals)
      setAlerts(sos)
      setVerifications(pendingVerifications)
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
            {/* Counters */}
            <div className="grid grid-cols-5 gap-2">
              <Tile label="SOS" value={moderation.sos} tone={moderation.sos > 0 ? 'alert' : 'plain'} />
              <Tile label="Reports" value={moderation.reports} tone="plain" />
              <Tile label="Appeals" value={moderation.appeals} tone="plain" />
              <Tile label="Ads" value={moderation.ads} tone="plain" />
              <Tile label="Selfies" value={moderation.verifications} tone={moderation.verifications > 0 ? 'alert' : 'plain'} />
            </div>

            {/* SOS */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-[18px] font-bold">
                  <ShieldAlert size={18} className={pendingSOS.length > 0 ? 'text-alert' : 'text-muted'} />
                  SOS alerts
                </h2>
                <span className="text-[12px] text-muted">{pendingSOS.length} waiting</span>
              </div>

              {alerts.length === 0 && (
                <p className="rounded-xl border border-line bg-white p-4 text-[13px] text-muted">
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
            </section>

            {/* Selfie verification queue */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-[18px] font-bold">
                  <ShieldCheck size={18} className={verifications.length > 0 ? 'text-verified' : 'text-muted'} aria-hidden />
                  Selfie verification
                </h2>
                <span className="text-[12px] text-muted">{verifications.length} waiting</span>
              </div>

              {verifications.length === 0 && (
                <p className="rounded-xl border border-line bg-white p-4 text-[13px] text-muted">
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
            </section>

            {/* Ads */}
            <Link to="/admin/ads" className="card flex items-center justify-between rounded-2xl p-4">
              <span>
                <span className="block text-[14px] font-semibold">Ad review</span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  {moderation.ads > 0
                    ? `${moderation.ads} ad${moderation.ads === 1 ? '' : 's'} waiting for approval`
                    : 'No ads waiting'}
                </span>
              </span>
              <span aria-hidden className="text-muted">→</span>
            </Link>

            {/* Reports */}
            <section>
              <h2 className="mb-3 font-display text-[18px] font-bold">Pending reports ({reports.length})</h2>
              <div className="space-y-3">
                {reports.length === 0 && <p className="text-[13px] text-muted">No reports waiting for review.</p>}
                {reports.map((report) => (
                  <article key={report.id} className="card rounded-2xl p-4">
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
            </section>

            {/* Appeals */}
            <section>
              <h2 className="mb-3 font-display text-[18px] font-bold">Appeals ({appeals.length})</h2>
              <div className="space-y-3">
                {appeals.length === 0 && <p className="text-[13px] text-muted">No appeals waiting for review.</p>}
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
                        {busy === appeal.id ? 'Saving…' : 'Grant appeal'}
                      </button>
                      <button className="btn-ghost" disabled={busy !== null} onClick={() => void handleAppeal(appeal.id, 'denied')}>
                        Deny appeal
                      </button>
                    </div>
                  </article>
                ))}
              </div>
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

        {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-[13px] text-alert">{error}</p>}
      </main>
    </div>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'alert' | 'plain'
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 text-center ${
        tone === 'alert' && value > 0 ? 'border-alert/40 bg-alert/5' : 'border-line bg-white'
      }`}
    >
      <p className={`text-[18px] font-bold leading-none ${tone === 'alert' && value > 0 ? 'text-alert' : 'text-ink'}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  )
}
