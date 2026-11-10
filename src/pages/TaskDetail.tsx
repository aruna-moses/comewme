import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  cancelTask,
  createReview,
  fetchMyJoinRequest,
  fetchParticipants,
  fetchJoinRequests,
  fetchTask,
  markTaskDone,
  requestJoin,
  setJoinStatus,
  submitReport,
  withdrawJoin,
} from '../lib/api'
import type { JoinRequest, Profile, ReportCategory, Task } from '../types'
import { REPORT_CATEGORIES, categoryLabel, trustLevel } from '../types'
import { formatDateTime, isPast, timeOfDay } from '../lib/format'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { TrustPill, VerifiedBadge } from '../components/Badges'
import TaskCompletionCelebration from '../components/TaskCompletionCelebration'
import ShareTaskButton from '../components/ShareTaskButton'
import SOSConfirmationSheet from '../components/SOSConfirmationSheet'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null)
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [participants, setParticipants] = useState<JoinRequest[]>([])
  const [hostProfile, setHostProfile] = useState<Profile | null>(null)

  const [joinOpen, setJoinOpen] = useState(false)
  const [joinMessage, setJoinMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [decisionPending, setDecisionPending] = useState<{
    requestId: string
    name: string
    status: 'declined' | 'waitlisted' | 'remove'
  } | null>(null)
  const [doneConfirmOpen, setDoneConfirmOpen] = useState(false)
  const [completionCount, setCompletionCount] = useState<number | null>(null)
  const closeCompletionCelebration = useCallback(() => setCompletionCount(null), [])
  const findNextActivity = useCallback(() => {
    setCompletionCount(null)
    navigate('/')
  }, [navigate])

  const [sosOpen, setSosOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment')
  const [reportSubject, setReportSubject] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportDone, setReportDone] = useState(false)
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)

  const [rateOpen, setRateOpen] = useState(false)
  const [rating, setRating] = useState<Record<string, number>>({})
  const [rated, setRated] = useState<Record<string, boolean>>({})

  const isHost = Boolean(profile && task && task.host_id === profile.id)
  const isAccepted = myRequest?.status === 'accepted'
  const isParticipant = Boolean(isHost || isAccepted)
  const isFull = Boolean(task && task.spots_filled >= task.spots_needed)
  const communityCheckPassed = Boolean(profile?.community_check_passed_at)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const t = await fetchTask(id)
      setTask(t)
      if (t) {
        const { data } = await supabase.from('profiles').select('*').eq('id', t.host_id).maybeSingle()
        setHostProfile((data as Profile) ?? null)
      }
      if (t && profile) {
        const [req, part] = await Promise.all([
          fetchMyJoinRequest(t.id, profile.id),
          fetchParticipants(t.id),
        ])
        setMyRequest(req)
        setParticipants(part)
        if (t.host_id === profile.id) setRequests(await fetchJoinRequests(t.id))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this activity')
    } finally {
      setLoading(false)
    }
  }, [id, profile?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const state = location.state
    if (!state || typeof state !== 'object' || !('openGroupInfo' in state) || state.openGroupInfo !== true) return
    setGroupInfoOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  async function handleJoin() {
    if (!task || !profile) return
    setBusy(true)
    try {
      await requestJoin(task, profile, joinMessage)
      setJoinOpen(false)
      setJoinMessage('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send request')
    } finally {
      setBusy(false)
    }
  }

  async function handleDecision(
    requestId: string,
    status: 'accepted' | 'declined' | 'waitlisted',
  ) {
    setBusy(true)
    try {
      await setJoinStatus(requestId, status)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update request')
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    if (!myRequest) return
    setLeaveConfirmOpen(false)
    setBusy(true)
    try {
      await withdrawJoin(myRequest.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not leave this activity')
    } finally {
      setBusy(false)
    }
  }

  async function handleDone() {
    if (!task) return
    setDoneConfirmOpen(false)
    setBusy(true)
    try {
      await markTaskDone(task.id)
      const completedCount = (hostProfile?.tasks_completed ?? profile?.tasks_completed ?? 0) + 1
      setTask({ ...task, status: 'completed' })
      setHostProfile((current) =>
        current ? { ...current, tasks_completed: current.tasks_completed + 1 } : current,
      )
      setCompletionCount(completedCount)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!task) return
    setCancelConfirmOpen(false)
    setBusy(true)
    try {
      await cancelTask(task.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  async function handleReport() {
    if (!profile || !task) return
    setBusy(true)
    try {
      await submitReport({
        reporter_id: profile.id,
        category: reportCategory,
        details: `Subject: ${reportSubject.trim()}\n\n${reportDetails.trim()}`,
        task_id: task.id,
        reported_user_id: task.host_id,
      })
      setReportDone(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send report')
    } finally {
      setBusy(false)
    }
  }

  async function handleRate(targetId: string) {
    if (!task || !profile) return
    const score = rating[targetId]
    if (!score) return
    try {
      await createReview({
        task_id: task.id,
        reviewer_id: profile.id,
        reviewee_id: targetId,
        rating: score,
        comment: '',
      })
      setRated((r) => ({ ...r, [targetId]: true }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save rating')
    }
  }

  if (loading) return <Spinner full />
  if (error || !task)
    return (
      <div className="p-6">
        <p className="font-semibold text-alert">{error ?? 'Activity not found'}</p>
        <Link to="/" className="btn-ghost btn-sm mt-4">
          Back to Discover
        </Link>
      </div>
    )

  const spotsLeft = Math.max(0, task.spots_needed - task.spots_filled)
  const rateTargets = [
    { id: task.host_id, name: task.host_name, avatar: task.host_avatar_url },
    ...participants.map((p) => ({
      id: p.requester_id,
      name: p.requester_name,
      avatar: p.requester_avatar_url,
    })),
  ].filter((t) => t.id !== profile?.id)

  return (
    <div className="pb-8">
      {/* top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} className="p-1" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="pill bg-sun/25">{categoryLabel(task.category)}</span>
        {task.status === 'completed' && <span className="pill bg-line text-muted">Done</span>}
        {task.status === 'cancelled' && <span className="pill bg-line text-muted">Cancelled</span>}
        <div className="ml-auto">
          <ShareTaskButton task={task} />
        </div>
      </div>

      <div className="px-4 pt-5">
        <h1 className="font-display text-[23px] font-bold leading-tight">{task.title}</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {task.area} · {formatDateTime(task.date_time)}
        </p>

        {task.description && (
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{task.description}</p>
        )}

        {/* host */}
        <Link to={`/profile/${task.host_id}`} className="card mt-5 flex items-center gap-3 p-4">
          <Avatar src={task.host_avatar_url} name={task.host_name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold">{task.host_name}</p>
              <VerifiedBadge status={hostProfile?.verification_status} />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <TrustPill level={trustLevel(hostProfile?.tasks_completed ?? 0)} />
              <span className="text-[12px] text-muted">{hostProfile?.tasks_completed ?? 0} completed</span>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-muted">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {/* meeting point */}
        <div className="card mt-3 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Meeting point</p>
          <p className="mt-1 text-[15px] font-semibold">{task.meeting_point}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Only share personal details with people you've met. Keep the first meet in a public place.
          </p>
        </div>

        {/* spots */}
        <div className="card mt-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">{isFull ? 'This one is full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}</p>
            <p className="text-[12px] text-muted">{task.spots_filled} of {task.spots_needed}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full transition-all bg-amber" style={{ width: `${Math.min(100, (task.spots_filled / task.spots_needed) * 100)}%` }} />
          </div>

          {participants.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {participants.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    to={`/profile/${p.requester_id}`}
                    aria-label={`View ${p.requester_name}'s profile`}
                    title={`View ${p.requester_name}'s profile`}
                    className="rounded-full focus-visible:z-10"
                  >
                    <Avatar src={p.requester_avatar_url} name={p.requester_name} size={30} className="ring-2 ring-white" />
                  </Link>
                ))}
              </div>
              <span className="text-[12px] text-muted">
                {participants.length} going · tap a photo to view profile
              </span>
            </div>
          )}
        </div>

        {/* primary action */}
        <div className="mt-5">
          {!session && (
            <Link to="/login" state={{ from: `/task/${task.id}` }} className="btn-primary w-full">
              Sign up or sign in to join
            </Link>
          )}

          {session && isHost && ['open', 'full'].includes(task.status) && <button className="btn-primary w-full" disabled={busy} onClick={() => setDoneConfirmOpen(true)}>Mark as done</button>}
          {session && isHost && ['open', 'full'].includes(task.status) && <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={() => setCancelConfirmOpen(true)}>Cancel activity</button>}

          {session && !isHost && task.status === 'open' && (!myRequest || myRequest.status === 'declined') && (
            <button
              className="btn-primary w-full"
              disabled={isFull}
              onClick={async () => {
                if (!communityCheckPassed) {
                  navigate(`/community-check?returnTo=${encodeURIComponent(`/task/${task.id}`)}`)
                  return
                }
                setJoinOpen(true)
              }}
            >
              {isFull
                ? "This one's full"
                : !communityCheckPassed
                  ? 'Complete community check to join'
                  : myRequest?.status === 'declined'
                    ? 'Request again'
                    : 'Request to join'}
            </button>
          )}
          {session && !isHost && myRequest?.status === 'pending' && <button className="btn-ghost w-full" disabled>Request sent — waiting for the host</button>}
          {session && !isHost && myRequest?.status === 'waitlisted' && (
            <div className="rounded-card border border-[#4273a8]/20 bg-[#eef4fb] p-4 text-center">
              <p className="text-[14px] font-bold text-[#4273a8]">You're on the waitlist</p>
              <p className="mt-0.5 text-[13px] text-ink/70">The host will review your request if a spot opens.</p>
            </div>
          )}
          {session && !isHost && isAccepted && (
            <div className="rounded-card border border-verified/25 bg-verified/10 p-4 text-center">
              <p className="text-[15px] font-bold text-verified">You're in</p>
              <p className="mt-0.5 text-[13px] text-ink/70">Meet at {task.meeting_point}</p>
              <button
                type="button"
                className="btn-ghost btn-sm mt-3"
                disabled={busy}
                onClick={() => setLeaveConfirmOpen(true)}
              >
                Leave activity
              </button>
            </div>
          )}
          {session && !isHost && myRequest?.status === 'declined' && (
            <div className="rounded-card border border-line bg-white p-4 text-center">
              <p className="text-[14px] font-semibold">This one didn't work out</p>
              <p className="mt-0.5 text-[13px] text-muted">The host chose another applicant. You can try again if the activity is still open.</p>
            </div>
          )}
        </div>

        {isHost && requests.some((r) => r.status === 'pending' || r.status === 'waitlisted') && (
          <section className="mt-6">
            <h2 className="mb-1 font-display text-base font-bold">Applicants</h2>
            <p className="mb-3 text-[12px] text-muted">Review each person, then accept, waitlist, or kindly decline.</p>
            <div className="space-y-2">
              {requests.filter((r) => r.status === 'pending' || r.status === 'waitlisted').map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={r.requester_avatar_url} name={r.requester_name} size={38} />
                    <Link to={`/profile/${r.requester_id}`} className="min-w-0 flex-1 truncate font-semibold">{r.requester_name}</Link>
                  </div>
                  {r.message && <p className="mt-2 rounded-xl bg-canvas p-3 text-[13px] text-ink/80">{r.message}</p>}
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-primary btn-sm flex-1"
                      disabled={busy || spotsLeft === 0}
                      onClick={() => handleDecision(r.id, 'accepted')}
                    >
                      {spotsLeft === 0 ? 'Full' : 'Accept'}
                    </button>
                    {r.status !== 'waitlisted' && (
                      <button className="btn-ghost btn-sm flex-1" disabled={busy} onClick={() => setDecisionPending({ requestId: r.id, name: r.requester_name, status: 'waitlisted' })}>Waitlist</button>
                    )}
                    <button className="btn-ghost btn-sm flex-1" disabled={busy} onClick={() => setDecisionPending({ requestId: r.id, name: r.requester_name, status: 'declined' })}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {isHost && requests.some((r) => r.status === 'accepted') && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-base font-bold">Confirmed members</h2>
            <div className="space-y-2">
              {requests.filter((r) => r.status === 'accepted').map((r) => (
                <div key={r.id} className="card flex items-center gap-3 p-3">
                  <Avatar src={r.requester_avatar_url} name={r.requester_name} size={38} />
                  <Link to={`/profile/${r.requester_id}`} className="min-w-0 flex-1 truncate font-semibold">{r.requester_name}</Link>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => setDecisionPending({ requestId: r.id, name: r.requester_name, status: 'remove' })}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* rate after completion */}
        {task.status === 'completed' && isParticipant && rateTargets.length > 0 && (
          <button className="btn-dark mt-5 w-full" onClick={() => setRateOpen(true)}>Rate this activity</button>
        )}

        {/* Group chat */}
        {isParticipant && (
          <section className="mt-6">
            <div
              className="flex cursor-pointer items-center justify-between rounded-2xl p-2 transition hover:bg-canvas"
              onClick={() => setGroupInfoOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === 'Enter' && setGroupInfoOpen(true)}
              aria-label="Open group info"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={task.host_avatar_url} name={task.host_name} size={34} />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-bold text-ink">{task.title}</h2>
                  <p className="text-[11px] text-muted">{task.spots_filled} of {task.spots_needed} members</p>
                </div>
              </div>
              <button
                type="button"
                className="ml-2 shrink-0 rounded-full bg-line p-1.5 text-muted transition hover:bg-ink hover:text-white"
                aria-label="More options"
                onClick={(event) => {
                  event.stopPropagation()
                  setGroupInfoOpen(true)
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => navigate(`/task/${task.id}/chat`)}
                className="btn-primary min-h-11 flex-1 text-sm font-semibold"
              >
                Open chat
              </button>
              <button
                type="button"
                onClick={() => setSosOpen(true)}
                className="btn-alert min-h-11 flex-1 border border-alert text-sm font-semibold text-alert"
              >
                SOS
              </button>
            </div>
          </section>
        )}

        {/* Group Info Sheet */}
        <Sheet open={groupInfoOpen} onClose={() => setGroupInfoOpen(false)} title={task.title}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-canvas border border-line">
              <Avatar src={task.host_avatar_url} name={task.host_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{task.host_name}</p>
                <p className="text-[11px] text-muted">{categoryLabel(task.category)} · {task.area}</p>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-full bg-line text-muted hover:bg-ink hover:text-white transition"
                aria-label="Close"
                onClick={() => setGroupInfoOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Host controls - Mark as done left, Cancel activity right */}
            {isHost && task.status === 'open' && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-white p-3">
                <button
                  onClick={() => setDoneConfirmOpen(true)}
                  disabled={busy}
                  className="btn-primary w-full px-3 py-2 text-sm font-semibold"
                >
                  {busy ? 'Marking…' : 'Mark as done'}
                </button>
                <button
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={busy}
                  className="btn-ghost w-full px-3 py-2 text-sm text-alert hover:bg-alert/5"
                >
                  Cancel activity
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => navigate(`/task/${task.id}/chat`)}
                className="btn-primary w-full py-3 text-sm font-semibold"
              >
                Open chat
              </button>
              <button
                type="button"
                aria-label="Send emergency SOS"
                onClick={() => {
                  setGroupInfoOpen(false)
                  setSosOpen(true)
                }}
                className="btn-alert w-full border border-alert py-3 text-sm font-semibold text-alert"
              >
                SOS
              </button>
            </div>

            {/* Report this activity */}
            <div className="pt-2 border-t border-line pt-3">
              <button
                onClick={() => {
                  setGroupInfoOpen(false)
                  setReportOpen(true)
                }}
                className="w-full py-3 text-[12px] font-semibold text-muted underline underline-offset-4 text-left"
              >
                Report this activity
              </button>
            </div>
          </div>
        </Sheet>

        {/* Cancel confirm dialog */}
        {cancelConfirmOpen && (
          <Sheet open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)} title="Cancel activity?">
            <p className="text-[13px] text-muted">
              Cancelling will remove this activity from the feed. People who already joined will be notified.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => setCancelConfirmOpen(false)}
              >
                Keep activity
              </button>
              <button
                type="button"
                className="btn-alert flex-1"
                disabled={busy}
                onClick={async () => {
                  setCancelConfirmOpen(false)
                  try {
                    await cancelTask(task.id)
                    setBusy(false)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Could not cancel')
                    setBusy(false)
                  }
                }}
              >
                {busy ? 'Cancelling…' : 'Cancel activity'}
              </button>
            </div>
          </Sheet>
        )}
        {/* report */}
        <button onClick={() => setReportOpen(true)} className="mt-6 w-full py-3 text-[12px] font-semibold text-muted underline underline-offset-4">Report this activity</button>

        {/* join sheet */}
        <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} title="Ready to join?">
          <p className="text-[13px] leading-relaxed text-muted">
            Please only apply if you're sure you can make it. Your spot is confirmed only after the host accepts your request.
          </p>
          <textarea className="field mt-3 min-h-[96px] resize-none" placeholder="I'm free that morning and I live close by…" value={joinMessage} onChange={(e) => setJoinMessage(e.target.value)} maxLength={400} />
          <button className="btn-primary mt-3 w-full" disabled={busy} onClick={handleJoin}>{busy ? 'Sending…' : "I'm sure — send request"}</button>
        </Sheet>

        {/* report sheet */}
        <Sheet open={reportOpen} onClose={() => { setReportOpen(false); setReportDone(false); setReportSubject(''); setReportDetails('') }} title={reportDone ? 'Thanks for telling us' : 'Report task'}>
          {reportDone ? (
            <div className="py-4 text-center">
              <p role="status" className="font-display text-lg font-bold">Your report has been sent.</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">It won&apos;t be shared with the person you reported. If you feel unsafe, leave the situation and contact someone you trust.</p>
            </div>
          ) : (
            <>
              <div className="card rounded-[16px] p-4">
                <p className="text-[12px] text-muted">Task</p>
                <p className="mt-1 text-[14px] font-semibold">{task.title}</p>
                <p className="mt-2 text-[12px] text-amber">Reporting host: {task.host_name}</p>
              </div>
              <select className="field" value={reportCategory} onChange={(e) => setReportCategory(e.target.value as ReportCategory)}>
                {REPORT_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
              <label className="label mt-3" htmlFor="report-subject">Subject</label>
              <input id="report-subject" className="field" placeholder="Meeting details seem unsafe" value={reportSubject} onChange={(e) => setReportSubject(e.target.value)} maxLength={120} />
              <label className="label mt-3" htmlFor="report-details">What happened?</label>
              <textarea id="report-details" className="field min-h-[112px] resize-y" placeholder="Share only what helps us understand the problem." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} maxLength={3800} />
              <p className="mt-2 text-[12px] leading-relaxed text-muted">Reports are private. Never include verification codes or private account details.</p>
              <button className="btn-primary mt-3 w-full" disabled={busy || reportSubject.trim().length < 3 || reportDetails.trim().length < 3} onClick={handleReport}>{busy ? 'Sending…' : 'Send report'}</button>
            </>
          )}
        </Sheet>

        {/* SOS confirmation sheet */}
        <Sheet open={sosOpen} onClose={() => setSosOpen(false)} title="Emergency SOS">
          <SOSConfirmationSheet taskId={task.id} onClose={() => setSosOpen(false)} onSent={() => setSosOpen(false)} />
        </Sheet>

        {/* rating sheet */}
        <Sheet open={rateOpen} onClose={() => setRateOpen(false)} title="How did it go?">
          <div className="space-y-3">
            {rateTargets.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
                <Avatar src={t.avatar} name={t.name} size={34} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t.name}</span>
                {rated[t.id] ? (
                  <span className="text-[12px] font-semibold text-verified">Rated</span>
                ) : (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} aria-label={`${n} stars`} onClick={() => setRating((r) => ({ ...r, [t.id]: n }))} className={`text-lg leading-none ${(rating[t.id] ?? 0) >= n ? 'text-amber' : 'text-line'}`}>★</button>
                    ))}
                    <button className="btn-ghost btn-sm ml-2" disabled={!rating[t.id]} onClick={() => handleRate(t.id)}>Save</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Sheet>

        <ConfirmDialog
          open={cancelConfirmOpen}
          title="Calling it off?"
          message="This activity will disappear from Discover, and people won’t be able to join. You can’t undo this."
          cancelLabel="Keep it going"
          confirmLabel="Cancel activity"
          destructive
          busy={busy}
          onCancel={() => setCancelConfirmOpen(false)}
          onConfirm={() => void handleCancel()}
        />
        <ConfirmDialog
          open={leaveConfirmOpen}
          title="Need to step out?"
          message="Leaving will free your spot so the host can welcome someone else. Are you sure you can't make it?"
          cancelLabel="Stay in"
          confirmLabel="Leave activity"
          destructive
          busy={busy}
          onCancel={() => setLeaveConfirmOpen(false)}
          onConfirm={() => void handleLeave()}
        />
        {decisionPending && (
          <ConfirmDialog
            open
            destructive
            busy={busy}
            title={
              decisionPending.status === 'remove'
                ? `Remove ${decisionPending.name}?`
                : decisionPending.status === 'waitlisted'
                  ? `Waitlist ${decisionPending.name}?`
                  : `Decline ${decisionPending.name}?`
            }
            message={
              decisionPending.status === 'remove'
                ? "They'll be notified they're out and won't be in the group any more. You can welcome someone else instead."
                : decisionPending.status === 'waitlisted'
                  ? "They'll be kept as backup and moved in automatically if a spot frees up."
                  : "They'll be notified they weren't selected. Spots go to whoever the host picks."
            }
            cancelLabel="Keep request"
            confirmLabel={decisionPending.status === 'remove' ? 'Remove' : decisionPending.status === 'waitlisted' ? 'Waitlist' : 'Decline'}
            onCancel={() => setDecisionPending(null)}
            onConfirm={() => {
              const target = decisionPending
              setDecisionPending(null)
              void handleDecision(target.requestId, target.status === 'remove' ? 'declined' : target.status)
            }}
          />
        )}
        <ConfirmDialog
          open={doneConfirmOpen}
          title="Mark this activity as done?"
          message="Everyone in the activity will all be asked to rate each other. This can't be undone."
          cancelLabel="Not yet"
          confirmLabel="Mark as done"
          busy={busy}
          onCancel={() => setDoneConfirmOpen(false)}
          onConfirm={() => void handleDone()}
        />
        {completionCount !== null && (
          <TaskCompletionCelebration
            activityTitle={task.title}
            completedCount={completionCount}
            onClose={closeCompletionCelebration}
            onFindNext={findNextActivity}
          />
        )}
      </div>
    </div>
  )
}
