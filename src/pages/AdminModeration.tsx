import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getPendingReports,
  getPendingViolationAppeals,
  isModerator,
  dismissViolation,
  reviewViolation,
  reviewViolationAppeal,
} from '../lib/api'
import type { Violation, ViolationSeverity } from '../types'
import { VIOLATION_CATEGORIES } from '../types'
import Spinner from '../components/Spinner'

type PendingAppeal = Awaited<ReturnType<typeof getPendingViolationAppeals>>[number]

export default function AdminModeration() {
  const [moderator, setModerator] = useState<boolean | null>(null)
  const [reports, setReports] = useState<Violation[]>([])
  const [appeals, setAppeals] = useState<PendingAppeal[]>([])
  const [severity, setSeverity] = useState<Record<string, ViolationSeverity>>({})
  const [actions, setActions] = useState<Record<string, string>>({})
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const allowed = await isModerator()
      setModerator(allowed)
      if (!allowed) return
      const [pendingReports, pendingAppeals] = await Promise.all([
        getPendingReports(),
        getPendingViolationAppeals(),
      ])
      setReports(pendingReports)
      setAppeals(pendingAppeals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load moderation queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleReview(reportId: string) {
    setBusy(reportId)
    setError(null)
    try {
      await reviewViolation(reportId, severity[reportId] ?? 'warning', actions[reportId] ?? '')
      await load()
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not review this appeal.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-[100dvh] pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-[13px] font-semibold text-amber">Back</Link>
        <h1 className="font-display text-[18px] font-bold">Moderation</h1>
      </header>
      <main className="mx-auto max-w-[720px] space-y-5 px-4 py-5">
        {loading ? <Spinner /> : moderator === false ? (
          <div className="card rounded-2xl p-5">
            <h2 className="font-semibold">Moderator access isn&apos;t configured</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">A project owner can add moderator user IDs to <code>public.moderators</code> in Supabase when the moderation team is ready.</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 font-display text-[18px] font-bold">Pending reports ({reports.length})</h2>
              <div className="space-y-3">
                {reports.length === 0 && <p className="text-[13px] text-muted">No reports waiting for review.</p>}
                {reports.map((report) => (
                  <article key={report.id} className="card rounded-2xl p-4">
                    <p className="text-[12px] text-muted">{VIOLATION_CATEGORIES.find((item) => item.value === report.category)?.label} · {new Date(report.created_at).toLocaleString()}</p>
                    <p className="mt-1 break-all text-[11px] text-muted">Reported account: {report.user_id}</p>
                    {report.reported_task_id && <p className="mt-1 break-all text-[11px] text-muted">Related activity: {report.reported_task_id}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{report.description}</p>
                    <label className="label mt-3" htmlFor={`severity-${report.id}`}>Action</label>
                    <select id={`severity-${report.id}`} className="field" value={severity[report.id] ?? 'warning'} onChange={(event) => setSeverity({ ...severity, [report.id]: event.target.value as ViolationSeverity })}>
                      <option value="warning">Warning</option>
                      <option value="suspension_24h">Suspend 24 hours</option>
                      <option value="suspension_7d">Suspend 7 days</option>
                      <option value="suspension_30d">Suspend 30 days</option>
                      <option value="permanent_ban">Permanent ban</option>
                    </select>
                    <label className="label mt-3" htmlFor={`action-${report.id}`}>Message to the user (optional)</label>
                    <textarea id={`action-${report.id}`} className="field min-h-[72px]" value={actions[report.id] ?? ''} maxLength={1000} onChange={(event) => setActions({ ...actions, [report.id]: event.target.value })} />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="btn-primary" disabled={busy !== null} onClick={() => void handleReview(report.id)}>{busy === report.id ? 'Saving…' : 'Apply action'}</button>
                      <button className="btn-ghost" disabled={busy !== null} onClick={() => void handleDismiss(report.id)}>{busy === report.id ? 'Saving…' : 'Dismiss report'}</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-display text-[18px] font-bold">Appeals ({appeals.length})</h2>
              <div className="space-y-3">
                {appeals.length === 0 && <p className="text-[13px] text-muted">No appeals waiting for review.</p>}
                {appeals.map((appeal) => (
                  <article key={appeal.id} className="card rounded-2xl p-4">
                    <p className="text-[12px] text-muted">{VIOLATION_CATEGORIES.find((item) => item.value === appeal.violation_category)?.label} · {new Date(appeal.created_at).toLocaleString()}</p>
                    <p className="mt-2 text-[12px] text-muted">Original report: {appeal.violation_description}</p>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed"><strong>Appeal:</strong> {appeal.appeal_reason}</p>
                    <label className="label mt-3" htmlFor={`response-${appeal.id}`}>Response to user (optional)</label>
                    <textarea id={`response-${appeal.id}`} className="field min-h-[72px]" maxLength={1000} value={responses[appeal.id] ?? ''} onChange={(event) => setResponses({ ...responses, [appeal.id]: event.target.value })} />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="btn-primary" disabled={busy !== null} onClick={() => void handleAppeal(appeal.id, 'granted')}>{busy === appeal.id ? 'Saving…' : 'Grant appeal'}</button>
                      <button className="btn-ghost" disabled={busy !== null} onClick={() => void handleAppeal(appeal.id, 'denied')}>Deny appeal</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-[13px] text-alert">{error}</p>}
      </main>
    </div>
  )
}
