import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, Mic, Paperclip, Square } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  cancelTask,
  createReview,
  deleteChatMedia,
  fetchMessages,
  fetchMyJoinRequest,
  fetchParticipants,
  fetchJoinRequests,
  fetchTask,
  markTaskDone,
  requestJoin,
  resolveChatMedia,
  sendMessage,
  setJoinStatus,
  submitReport,
  subscribeToMessages,
  uploadChatMedia,
  withdrawJoin,
} from '../lib/api'
import type { JoinRequest, Message, Profile, ReportCategory, Task } from '../types'
import { REPORT_CATEGORIES, categoryLabel, trustLevel } from '../types'
import { formatDateTime, formatTime, isPast, isSameDay, timeOfDay } from '../lib/format'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { TrustPill, VerifiedBadge } from '../components/Badges'
import TaskCompletionCelebration from '../components/TaskCompletionCelebration'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import ShareTaskButton from '../components/ShareTaskButton'

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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [completionCount, setCompletionCount] = useState<number | null>(null)
  const closeCompletionCelebration = useCallback(() => setCompletionCount(null), [])
  const findNextActivity = useCallback(() => {
    setCompletionCount(null)
    navigate('/')
  }, [navigate])

  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEnd = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [progressMessageId, setProgressMessageId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState(0)

  // voice note recording
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment')
  const [reportSubject, setReportSubject] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportDone, setReportDone] = useState(false)

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

  // chat: load + live updates, only for participants
  useEffect(() => {
    if (!task || !isParticipant) return
    let alive = true

    fetchMessages(task.id)
      .then((rows) => alive && setMessages(rows))
      .catch((e) => alive && setChatError(e instanceof Error ? e.message : 'Could not load group messages.'))

    const unsub = subscribeToMessages(task.id, (m) => {
      void resolveChatMedia([m])
        .then(([resolved]) => setMessages((prev) => (prev.some((x) => x.id === resolved.id) ? prev : [...prev, resolved])))
        .catch((e) => setChatError(e instanceof Error ? e.message : 'Could not load a group attachment.'))
    }, (message) => {
      if (message.deleted_at) {
        setMessages((prev) => prev.map((current) => current.id === message.id ? message : current))
        if (audioRef.current?.dataset.messageId === message.id) {
          audioRef.current.pause()
          audioRef.current = null
          setPlayingMessageId(null)
          setAudioProgress(0)
        }
      }
    })

    return () => {
      alive = false
      unsub()
    }
  }, [task?.id, isParticipant])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  useEffect(() => () => {
    audioRef.current?.pause()
  }, [])

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
    if (!confirm('Mark this activity as done? People will be asked to rate each other.')) return
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

  async function handleSend(text: string, type: 'text' | 'image' | 'audio' = 'text', url: string | null = null, duration: number | null = null): Promise<boolean> {
    if (!task || !profile || (type === 'text' && !text.trim())) return false
    setChatError(null)
    try {
      const message = await sendMessage(task.id, profile, text, type, url, duration)
      setMessages((prev) => (prev.some((existing) => existing.id === message.id) ? prev : [...prev, message]))
      setDraft('')
      return true
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not send message.')
      return false
    }
  }

  // -------- media attachment --------
  async function handleAttach(file: File, duration: number | null = null) {
    if (!task || !profile) return
    const isImage = file.type.startsWith('image/') && file.type !== 'image/svg+xml'
    const isAudio = file.type.startsWith('audio/')
    if (!isImage && !isAudio) {
      setChatError('Only images and audio files are supported.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setChatError('Attachments must be 15 MB or smaller.')
      return
    }
    setChatError(null)
    setUploading(true)
    let uploadedPath: string | null = null
    try {
      const { path } = await uploadChatMedia(task.id, file)
      uploadedPath = path
      const sent = await handleSend('', isImage ? 'image' : 'audio', path, duration)
      if (!sent) {
        await deleteChatMedia(path)
        uploadedPath = null
      }
    } catch (e) {
      let message = e instanceof Error ? e.message : 'Could not attach file.'
      if (uploadedPath) {
        try {
          await deleteChatMedia(uploadedPath)
        } catch {
          message = `${message} The uploaded file could not be cleaned up.`
        }
      }
      setChatError(message)
    } finally {
      setUploading(false)
    }
  }

  // -------- voice notes --------
  async function toggleRecording() {
    if (!task || !profile) return
    if (recording) {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') {
        setUploading(true)
        mr.stop()
      }
      setRecording(false)
      return
    }

    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice recording is not supported in this browser.')
      }
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream = audioStream
      const supportedTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
        ? supportedTypes.find((type) => MediaRecorder.isTypeSupported(type))
        : undefined
      const mr = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      recordingStartedAtRef.current = Date.now()
      setChatError(null)

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        setRecording(false)
        audioStream.getTracks().forEach((t) => t.stop())
        const blobType = mr.mimeType || chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        if (blob.size === 0) {
          setUploading(false)
          setChatError('No audio was recorded. Please try again.')
          return
        }
        const baseMimeType = blobType.split(';')[0]
        const extension = baseMimeType === 'audio/mp4' ? 'm4a' : baseMimeType === 'audio/ogg' ? 'ogg' : 'webm'
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: baseMimeType })
        const duration = Math.max(1, Math.ceil((Date.now() - recordingStartedAtRef.current) / 1000))
        await handleAttach(file, duration)
      }
      mr.onerror = () => {
        setRecording(false)
        setUploading(false)
        audioStream.getTracks().forEach((t) => t.stop())
        setChatError('Voice recording failed. Please try again.')
      }

      mr.start()
      setRecording(true)
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop())
      setChatError(e instanceof Error ? e.message : 'Microphone access was denied.')
    }
  }

  function toggleAudio(messageId: string, audio: HTMLAudioElement) {
    if (audioRef.current === audio && playingMessageId === messageId) {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
      setPlayingMessageId(null)
      setProgressMessageId(messageId)
      setAudioProgress(0)
      return
    }

    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
    audio.currentTime = 0
    audioRef.current = audio
    setPlayingMessageId(messageId)
    setProgressMessageId(messageId)
    setAudioProgress(0)
    void audio.play().catch(() => {
      if (audioRef.current === audio) audioRef.current = null
      setPlayingMessageId(null)
      setChatError('Could not play this voice note. Please try again.')
    })
  }

  function handleAudioEnded(messageId: string) {
    if (audioRef.current?.dataset.messageId !== messageId) return
    setAudioProgress(audioRef.current.duration || 0)
    setProgressMessageId(messageId)
    setPlayingMessageId(null)
    audioRef.current = null
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

          {session && isHost && ['open', 'full'].includes(task.status) && <button className="btn-primary w-full" disabled={busy} onClick={handleDone}>Mark as done</button>}
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
                      <button className="btn-ghost btn-sm flex-1" disabled={busy} onClick={() => handleDecision(r.id, 'waitlisted')}>Waitlist</button>
                    )}
                    <button className="btn-ghost btn-sm flex-1" disabled={busy} onClick={() => handleDecision(r.id, 'declined')}>Decline</button>
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
                    onClick={() => handleDecision(r.id, 'declined')}
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

        {/* group chat */}
        {isParticipant && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Group</h2>
              <div className="flex items-center gap-2">
                <Link to={`/task/${task.id}/chat`} className="btn-ghost btn-sm">Open chat</Link>
                <a href={`https://meet.jit.si/comewme-${task.id}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Start call</a>
              </div>
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
                              alt="Photo shared in the group chat"
                              className="mt-0.5 max-h-64 max-w-full cursor-pointer rounded-xl object-cover"
                              onClick={() => window.open(m.url!, '_blank')}
                            />
                          )}
                          {m.type === 'audio' && m.url && (
                            <div className="mt-0.5">
                              <VoiceNotePlayer
                                messageId={m.id}
                                url={m.url}
                                duration={m.duration}
                                isPlaying={playingMessageId === m.id}
                                currentTime={progressMessageId === m.id ? audioProgress : 0}
                                onToggle={toggleAudio}
                                onProgress={(time) => {
                                  setProgressMessageId(m.id)
                                  setAudioProgress(time)
                                }}
                                onEnded={() => handleAudioEnded(m.id)}
                              />
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
                  className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink ${uploading || recording ? 'pointer-events-none opacity-50' : ''}`}
                  title="Take a photo to share"
                >
                  <Camera size={19} aria-hidden />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="Take a photo to share"
                    className="sr-only"
                    disabled={uploading || recording}
                    onChange={(e) => {
                      const photo = e.currentTarget.files?.[0]
                      if (photo) void handleAttach(photo)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
                <label
                  className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink ${uploading || recording ? 'pointer-events-none opacity-50' : ''}`}
                  title="Attach a photo or audio"
                >
                  <Paperclip size={19} aria-hidden />
                  <input
                    type="file"
                    accept="image/*,audio/*"
                    className="sr-only"
                    disabled={uploading || recording}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleAttach(f)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void toggleRecording()}
                  disabled={uploading}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${recording ? 'animate-pulse bg-alert text-white' : 'bg-canvas text-muted hover:text-ink'} disabled:cursor-not-allowed disabled:opacity-50`}
                  title={recording ? 'Stop and send voice note' : 'Record voice note'}
                  aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}
                >
                  {recording ? <Square size={16} fill="currentColor" aria-hidden /> : <Mic size={19} aria-hidden />}
                </button>

                <input
                  className="field min-h-[44px] border-0 bg-canvas flex-1"
                  placeholder="Message the group…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(draft)}
                  maxLength={2000}
                  disabled={uploading || recording}
                />
                <button
                  type="button"
                  className="btn-primary btn-sm shrink-0"
                  onClick={() => void handleSend(draft)}
                  disabled={!draft.trim() || uploading || recording}
                >
                  {uploading ? '…' : 'Send'}
                </button>
              </div>
              {chatError && <p role="alert" className="px-3 pb-2 text-[12px] font-medium text-alert">{chatError}</p>}
              <p className="mt-2 text-[11px] text-muted">Never share a home address here. Keep the first meet public.</p>
            </div>
          </section>
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
