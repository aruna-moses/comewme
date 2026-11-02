import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  cancelTask,
  createReview,
  fetchMessages,
  fetchMyJoinRequest,
  fetchParticipants,
  fetchJoinRequests,
  fetchTask,
  markTaskDone,
  requestJoin,
  sendMessage,
  setJoinStatus,
  submitReport,
  subscribeToMessages,
  uploadChatMedia,
  claimSpot,
} from '../lib/api'
import type { JoinRequest, Message, Profile, ReportCategory, Task } from '../types'
import { REPORT_CATEGORIES, categoryLabel, trustLevel } from '../types'
import { formatDateTime, formatTime, isPast, isSameDay, timeOfDay } from '../lib/format'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import Spinner from '../components/Spinner'
import { TrustPill, VerifiedBadge } from '../components/Badges'

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile, session } = useAuth()
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

  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const chatEnd = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // voice note recording
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [reportOpen, setReportOpen] = useState(false)
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment')
  const [reportDetails, setReportDetails] = useState('')
  const [reportDone, setReportDone] = useState(false)

  const [rateOpen, setRateOpen] = useState(false)
  const [rating, setRating] = useState<Record<string, number>>({})
  const [rated, setRated] = useState<Record<string, boolean>>({})

  const isHost = Boolean(profile && task && task.host_id === profile.id)
  const isAccepted = myRequest?.status === 'accepted'
  const isParticipant = Boolean(isHost || isAccepted)
  const isFull = Boolean(task && task.spots_filled >= task.spots_needed)

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

  // chat: load + live updates, only for participants
  useEffect(() => {
    if (!task || !isParticipant) return
    let alive = true

    fetchMessages(task.id)
      .then((rows) => alive && setMessages(rows))
      .catch(() => undefined)

    const unsub = subscribeToMessages(task.id, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    })

    return () => {
      alive = false
      unsub()
    }
  }, [task?.id, isParticipant])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

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

  async function handleDecision(requestId: string, status: 'accepted' | 'declined') {
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

  async function handleDone() {
    if (!task) return
    if (!confirm('Mark this activity as done? People will be asked to rate each other.')) return
    setBusy(true)
    try {
      await markTaskDone(task.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!task) return
    if (!confirm('Cancel this activity? It disappears from the feed.')) return
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

  async function handleSend(text: string, type: 'text' | 'image' | 'audio' = 'text', url: string | null = null, duration: number | null = null) {
    if (!task || !profile) return
    if (type === 'text' && !text.trim()) return
    try {
      await sendMessage(task.id, profile, text, type, url, duration)
      setDraft('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send')
    }
  }

  // -------- media attachment --------
  async function handleAttach(file: File) {
    if (!task || !profile) return
    const isImage = file.type.startsWith('image/')
    const isAudio = file.type.startsWith('audio/')
    if (!isImage && !isAudio) {
      alert('Only images and audio files are supported.')
      return
    }
    setUploading(true)
    try {
      const { signedUrl } = await uploadChatMedia(task.id, file)
      await handleSend(
        isImage ? '' : '',
        isImage ? 'image' : 'audio',
        signedUrl,
        isAudio ? Math.ceil(file.size / 14_000) : null // rough duration guess
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not attach file')
    } finally {
      setUploading(false)
    }
  }

  // -------- voice notes --------
  async function toggleRecording() {
    if (!task || !profile) return
    if (recording) {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') mr.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setUploading(true)
        try {
          const { signedUrl } = await uploadChatMedia(task.id, file)
          const duration = Math.ceil(blob.size / 14_000) // rough estimate
          await handleSend('', 'audio', signedUrl, duration)
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Could not send voice note')
        } finally {
          setUploading(false)
        }
      }
      mr.onerror = () => {
        setRecording(false)
        alert('Voice recording failed')
      }

      mr.start()
      setRecording(true)
    } catch (e) {
      alert('Microphone access denied')
    }
  }

  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url)
    audioRef.current = a
    void a.play()
  }

  async function handleReport() {
    if (!profile || !task) return
    setBusy(true)
    try {
      await submitReport({
        reporter_id: profile.id,
        category: reportCategory,
        details: reportDetails,
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
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (task.spots_filled / task.spots_needed) * 100)}%`, backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }} />
          </div>

          {participants.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {participants.slice(0, 5).map((p) => (
                  <Avatar key={p.id} src={p.requester_avatar_url} name={p.requester_name} size={30} className="ring-2 ring-white" />
                ))}
              </div>
              <span className="text-[12px] text-muted">{participants.length} going</span>
            </div>
          )}
        </div>

        {/* primary action */}
        <div className="mt-5">
          {!session && <Link to="/login" className="btn-primary w-full">Sign in to join</Link>}

          {session && isHost && task.status === 'open' && <button className="btn-primary w-full" disabled={busy} onClick={handleDone}>Mark as done</button>}
          {session && isHost && task.status === 'open' && <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={handleCancel}>Cancel activity</button>}

          {session && !isHost && task.status === 'open' && !myRequest && (
            <button
              className="btn-primary w-full"
              disabled={isFull}
              onClick={async () => {
                if (task.fill_mode === 'first_come') {
                  await claimSpot(task.id, profile!)
                  await load()
                } else {
                  setJoinOpen(true)
                }
              }}
            >
              {isFull ? "This one's full" : task.fill_mode === 'first_come' ? 'Claim spot' : 'Request to join'}
            </button>
          )}
          {session && !isHost && myRequest?.status === 'pending' && <button className="btn-ghost w-full" disabled>Request sent — waiting for the host</button>}
          {session && !isHost && isAccepted && (
            <div className="rounded-card border border-verified/25 bg-verified/10 p-4 text-center">
              <p className="text-[15px] font-bold text-verified">You're in</p>
              <p className="mt-0.5 text-[13px] text-ink/70">Meet at {task.meeting_point}</p>
            </div>
          )}
          {session && !isHost && myRequest?.status === 'declined' && (
            <div className="rounded-card border border-line bg-white p-4 text-center">
              <p className="text-[14px] font-semibold">This one didn't work out</p>
              <p className="mt-0.5 text-[13px] text-muted">The host went another way.</p>
            </div>
          )}
        </div>

        {/* host: pending requests */}
        {isHost && requests.filter((r) => r.status === 'pending').length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-base font-bold">Requests</h2>
            <div className="space-y-2">
              {requests.filter((r) => r.status === 'pending').map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={r.requester_avatar_url} name={r.requester_name} size={38} />
                    <Link to={`/profile/${r.requester_id}`} className="min-w-0 flex-1 truncate font-semibold">{r.requester_name}</Link>
                  </div>
                  {r.message && <p className="mt-2 rounded-xl bg-canvas p-3 text-[13px] text-ink/80">{r.message}</p>}
                  <div className="mt-3 flex gap-2">
                    <button className="btn-primary btn-sm flex-1" disabled={busy} onClick={() => handleDecision(r.id, 'accepted')}>Accept</button>
                    <button className="btn-ghost btn-sm flex-1" disabled={busy} onClick={() => handleDecision(r.id, 'declined')}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* rate after completion */}
        {task.status === 'completed' && isParticipant && rateTargets.length > 0 && (
          <button className="btn-dark mt-5 w-full" onClick={() => setRateOpen(true)}>Rate this activity</button>
        )}

        {/* group chat */}
        {isParticipant && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Group</h2>
              <a href={`https://meet.jit.si/comewme-${task.id}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Start call</a>
            </div>

            <div className="card overflow-hidden">
              <div className="max-h-96 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-muted">Nobody has said anything yet. Break the ice.</p>
                )}
                {messages.map((m, i) => {
                  const mine = m.sender_id === profile?.id
                  const prev = messages[i - 1]
                  const newDay = i === 0 || !isSameDay(m.created_at, prev.created_at)
                  const showName = !mine && (i === 0 || messages[i - 1]?.sender_id !== m.sender_id)

                  return (
                    <div key={m.id} className="flex flex-col">
                      {newDay && (
                        <p className="mx-2 my-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{formatDateTime(m.created_at).split(' · ')[0]}</p>
                      )}
                      <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!mine && <Avatar src={m.sender_avatar_url} name={m.sender_name} size={26} />}
                        <div className={`max-w-[82%] ${mine ? 'text-right' : 'text-left'}`}>
                          {showName && !mine && <p className="text-[10px] font-semibold text-muted mb-0.5">{m.sender_name}</p>}

                          {m.type === 'image' && m.url && (
                            <img
                              src={m.url}
                              alt=""
                              className="mt-0.5 rounded-xl max-w-[64%] max-h-48 object-cover cursor-pointer"
                              onClick={() => window.open(m.url!, '_blank')}
                            />
                          )}
                          {m.type === 'audio' && m.url && (
                            <div className="mt-0.5 flex items-center gap-2 rounded-xl bg-line px-3 py-2">
                              <button onClick={() => playAudio(m.url!)} className="p-1 text-muted hover:text-ink">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path d="M1 9v2a8 8 0 0 0 16 0V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M11 3a9 9 0 0 1 9 9v2a7 7 0 0 0-7-7h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <audio src={m.url!} className="hidden" />
                              <span className="text-[10px] text-muted">{formatDuration(m.duration)}</span>
                            </div>
                          )}
                          {m.type === 'text' && m.body && (
                            <div className={`mt-0.5 inline-block rounded-2xl px-3 py-2 text-[14px] leading-snug whitespace-pre-wrap ${mine ? 'bg-sun/40 text-ink' : 'bg-canvas text-ink'}`}>
                              {m.body}
                            </div>
                          )}
                          <p className={`text-[10px] ${mine ? 'text-amber/70' : 'text-muted'}`}>{formatTime(m.created_at)}</p>
                        </div>
                        {mine && <Avatar src={profile?.avatar_url ?? null} name={profile?.display_name ?? 'You'} size={26} />}
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEnd} />
              </div>

              <div className="flex items-end gap-2 border-t border-line p-2">
                <label
                  className="p-1 text-muted hover:text-ink cursor-pointer"
                  title="Attach photo or voice note"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleAttach(f)
                    }}
                  />
                </label>

                {recording ? (
                  <button
                    onClick={toggleRecording}
                    className="p-2 rounded-full bg-alert text-white hover:bg-alert/90"
                    title="Stop recording"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
                    </svg>
                    <span className="text-[10px] font-bold mt-0.5 block">Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={toggleRecording}
                    className="p-2 rounded-full bg-line text-muted hover:bg-line/80"
                    title="Record voice note"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3" />
                    </svg>
                    <span className="text-[10px] font-bold mt-0.5 block">Voice</span>
                  </button>
                )}

                <input
                  className="field min-h-[44px] border-0 bg-canvas flex-1"
                  placeholder="Message the group…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(draft)}
                  maxLength={2000}
                  disabled={uploading}
                />
                <button
                  className="btn-primary btn-sm shrink-0"
                  onClick={() => handleSend(draft)}
                  disabled={!draft.trim() || uploading}
                >
                  {uploading ? '…' : 'Send'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted">Never share a home address here. Keep the first meet public.</p>
            </div>
          </section>
        )}

        {/* report */}
        <button onClick={() => setReportOpen(true)} className="mt-6 w-full py-3 text-[12px] font-semibold text-muted underline underline-offset-4">Report this activity</button>

        {/* join sheet */}
        <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} title="Request to join">
          <p className="text-[13px] text-muted">{task.host_name} will see this. A line about why you want to come goes a long way.</p>
          <textarea className="field mt-3 min-h-[96px] resize-none" placeholder="I'm free that morning and I live close by…" value={joinMessage} onChange={(e) => setJoinMessage(e.target.value)} maxLength={400} />
          <button className="btn-primary mt-3 w-full" disabled={busy} onClick={handleJoin}>{busy ? 'Sending…' : 'Send request'}</button>
        </Sheet>

        {/* report sheet */}
        <Sheet open={reportOpen} onClose={() => { setReportOpen(false); setReportDone(false); setReportDetails('') }} title={reportDone ? undefined : 'Report'}>
          {reportDone ? (
            <div className="py-4 text-center">
              <p className="font-display text-lg font-bold">Got it</p>
              <p className="mt-1 text-[13px] text-muted">We'll review this. Thanks for saying something.</p>
            </div>
          ) : (
            <>
              <select className="field" value={reportCategory} onChange={(e) => setReportCategory(e.target.value as ReportCategory)}>
                {REPORT_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
              <textarea className="field mt-3 min-h-[96px] resize-none" placeholder="What happened?" value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} maxLength={4000} />
              <button className="btn-dark mt-3 w-full" disabled={busy || reportDetails.trim().length < 3} onClick={handleReport}>{busy ? 'Sending…' : 'Send report'}</button>
            </>
          )}
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
      </div>
    </div>
  )
}
