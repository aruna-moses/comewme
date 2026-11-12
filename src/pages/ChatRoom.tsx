import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Copy, Mic, MoreVertical, Paperclip, Reply, Send, Square, Trash2, X, Clock3, MapPin, ArrowRight, Volume2, VolumeX, BookmarkCheck, MessageSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import {
  checkInToActivity,
  deleteMessage,
  deleteChatMedia,
  fetchCheckins,
  fetchMessages,
  fetchMessageReactions,
  fetchMyJoinRequest,
  fetchRecap,
  fetchSystemEvents,
  fetchParticipants,
  fetchTask,
  markChatRead,
  resolveChatMedia,
  sendMessage,
  signChatMedia,
  subscribeToMessages,
  toggleMessageReaction,
  uploadChatMedia,
  writeRecap,
} from '../lib/api'
import { formatTime, isSameDay, formatDateTime } from '../lib/format'
import { usePersistedState } from '../lib/drafts'
import type { JoinRequest, Message, Task, ChatSystemEvent } from '../types'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import ChatPhotoEditor from '../components/ChatPhotoEditor'

const REACTIONS = ['👍', '❤️', '😂', '😎']

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [participants, setParticipants] = useState<JoinRequest[]>([])
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [systemEvents, setSystemEvents] = useState<ChatSystemEvent[]>([])
  const [checkins, setCheckins] = useState<Record<string, string>>({})
  const [checkinPending, setCheckinPending] = useState(false)
  const [recapText, setRecapText] = useState('')
  const [recapPosted, setRecapPosted] = useState(false)
  const [muteThisChat, setMuteThisChat] = usePersistedState<boolean>(`chat:${id}:mute`, false)
  const [reactions, setReactions] = useState<Record<string, Record<string, { count: number; mine: boolean }>>>({})
  const [draft, setDraft] = usePersistedState(`chat:${id}:draft`, '')
  const [uploading, setUploading] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<Message | null>(null)
  const [actionMessageId, setActionMessageId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [progressMessageId, setProgressMessageId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const chatEnd = useRef<HTMLDivElement | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const recordingChunks = useRef<Blob[]>([])
  const recordingStartedAt = useRef(0)
  const activeAudio = useRef<HTMLAudioElement | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const pointerStart = useRef<{ messageId: string; x: number; y: number } | null>(null)
  const longPressTriggered = useRef(false)

  useEffect(() => {
    let active = true
    async function loadRoom() {
      if (!id || !profile) return
      setLoading(true)
      setError(null)
      try {
        const currentTask = await fetchTask(id)
        if (!currentTask) throw new Error('This group chat could not be found.')
        const membership = currentTask.host_id === profile.id
          ? true
          : (await fetchMyJoinRequest(currentTask.id, profile.id))?.status === 'accepted'
        if (!membership) {
          if (active) {
            setTask(currentTask)
            setAuthorized(false)
          }
          return
        }
        if (active) {
          setTask(currentTask)
          setAuthorized(true)
        }
        const groupMembers = await fetchParticipants(currentTask.id)
        if (active) setParticipants(groupMembers)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not open this group chat.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadRoom()
    return () => { active = false }
  }, [id, profile?.id])

  useEffect(() => {
    if (!task?.id) return
    let active = true
    const refreshEvents = async () => {
      const [eventsRes, checkinsRes] = await Promise.all([
        fetchSystemEvents(task.id).catch(() => [] as ChatSystemEvent[]),
        fetchCheckins(task.id).catch(() => [] as Array<{ user_id: string; checked_in_at: string }>),
      ])
      if (!active) return
      setSystemEvents(eventsRes)
      setCheckins(Object.fromEntries(checkinsRes.map((c) => [c.user_id, c.checked_in_at])))
    }
    void refreshEvents()

    // Realtime check-ins + system events (welcome, left, recap, etc.)
    const eventsChannel = supabase.channel(`activity-events:${task.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_system_events', filter: `task_id=eq.${task.id}` }, () => { void refreshEvents() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_checkins', filter: `task_id=eq.${task.id}` }, () => { void refreshEvents() })
      .subscribe()

    // Host cares about arrival pinging the host when someone taps "I'm here".
    return () => {
      active = false
      void supabase.removeChannel(eventsChannel)
    }
  }, [task?.id])

  useEffect(() => {
    if (!task || !authorized) return
    let active = true
    fetchMessages(task.id)
      .then(async (rows) => {
        if (!active) return
        setMessages(rows)
        fetchMessageReactions(rows.map((r) => r.id))
          .then((all) => {
            if (!active) return
            const map: Record<string, Record<string, { count: number; mine: boolean }>> = {}
            for (const r of all) {
              map[r.message_id] = map[r.message_id] ?? {}
              const bucket = map[r.message_id][r.emoji] ?? { count: 0, mine: false }
              bucket.count += 1
              if (r.user_id === profile?.id) bucket.mine = true
              map[r.message_id][r.emoji] = bucket
            }
            setReactions(map)
          })
          .catch(() => undefined)
        if (document.visibilityState === 'visible') {
          try {
            await markChatRead(task.id)
            await refreshNotifications()
          } catch (e) {
            if (active) setError(e instanceof Error ? e.message : 'Could not update chat read status.')
          }
        }
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load messages.') })

    const unsubscribe = subscribeToMessages(task.id, (message) => {
      void resolveChatMedia([message])
        .then(([resolved]) => {
          if (!active) return
          setMessages((current) => current.some((item) => item.id === resolved.id) ? current : [...current, resolved])
          fetchMessageReactions([resolved.id])
            .then((all) => {
              setReactions((current) => {
                // initial seed — full fetch happens on message load and periodically
                const next = { ...current }
                for (const r of all) {
                  const bucket = next[r.message_id]?.[r.emoji] ?? { count: 0, mine: false }
                  bucket.count += 1
                  if (r.user_id === profile?.id) bucket.mine = true
                  next[r.message_id] = { ...(next[r.message_id] ?? {}), [r.emoji]: bucket }
                }
                return next
              })
            })
            .catch(() => undefined)
          if (document.visibilityState === 'visible') {
            void markChatRead(task.id)
              .then(refreshNotifications)
              .catch((e: unknown) => {
                if (active) setError(e instanceof Error ? e.message : 'Could not update chat read status.')
              })
          }
        })
        .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load a chat attachment.') })
    }, (message) => {
      if (!active) return
      setMessages((current) => current.map((item) => item.id === message.id ? message : item))
      if (message.deleted_at) {
        setActionMessageId((current) => current === message.id ? null : current)
        setReplyTarget((current) => current?.id === message.id ? message : current)
        if (activeAudio.current?.dataset.messageId === message.id) {
          activeAudio.current.pause()
          activeAudio.current = null
          setPlayingMessageId(null)
          setAudioProgress(0)
        }
      }
    })
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void markChatRead(task.id)
        .then(refreshNotifications)
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not update chat read status.')
        })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      unsubscribe()
    }
  }, [task?.id, authorized, refreshNotifications])

  useEffect(() => () => {
    activeAudio.current?.pause()
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
  }, [])

  useEffect(() => {
    if (!actionMessageId) return
    const closeOnOutsideClick = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-chat-message-actions]')) {
        setActionMessageId(null)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionMessageId(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionMessageId])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const isHost = Boolean(profile && task?.host_id === profile.id)
  const handleSend = useCallback(async (
    body: string,
    type: 'text' | 'image' | 'audio' = 'text',
    url: string | null = null,
    duration: number | null = null,
  ): Promise<boolean> => {
    if (!task || !profile || (type === 'text' && !body.trim())) return false
    setError(null)
    try {
      const message = await sendMessage(task.id, profile, body, type, url, duration, replyTarget)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      if (type === 'text') setDraft('')
      setReplyTarget(null)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message.')
      return false
    }
  }, [task, profile, replyTarget])

  const onToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    setError(null)
    try {
      const prev = reactions[messageId]?.[emoji]
      const isMine = prev?.mine ?? false
      const toggled = await toggleMessageReaction(messageId, emoji)
      // Optimistic-ish update
      setReactions((current) => {
        const currentEntry = current[messageId]?.[emoji] ?? { count: 0, mine: false }
        if (toggled === 'added') {
          return {
            ...current,
            [messageId]: {
              ...(current[messageId] ?? {}),
              [emoji]: { count: currentEntry.count + (currentEntry.mine ? 0 : 1), mine: true },
            },
          }
        }
        return {
          ...current,
          [messageId]: {
            ...(current[messageId] ?? {}),
            [emoji]: { count: Math.max(0, currentEntry.count - (currentEntry.mine ? 1 : 0)), mine: false },
          },
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update reaction.')
    }
  }, [reactions])

  const handleAttach = useCallback(async (file: File, duration: number | null = null, caption = '') => {
    if (!task || !profile) return
    const image = file.type.startsWith('image/') && file.type !== 'image/svg+xml'
    const audio = file.type.startsWith('audio/')
    if (!image && !audio) {
      setError('Choose an image or audio file.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Attachments must be 15 MB or smaller.')
      return
    }

    setUploading(true)
    setError(null)

    const type = image ? 'image' : 'audio'
    const captionText = caption.trim()
    const tempId = `temp-${crypto.randomUUID()}`
    const localUrl = URL.createObjectURL(file)
    // Show the bubble immediately — WhatsApp-style — then swap in the real row.
    const optimistic: Message = {
      id: tempId,
      task_id: task.id,
      sender_id: profile.id,
      sender_name: profile.display_name,
      sender_avatar_url: profile.avatar_url,
      body: captionText,
      type,
      url: localUrl,
      duration,
      reply_to_message_id: replyTarget?.id ?? null,
      reply_to_sender_id: replyTarget?.sender_id ?? null,
      reply_to_sender_name: replyTarget?.sender_name ?? null,
      reply_to_preview: replyTarget
        ? replyTarget.type === 'image'
          ? replyTarget.body?.trim() || 'Photo'
          : replyTarget.type === 'audio'
            ? 'Voice note'
            : replyTarget.body.slice(0, 200)
        : null,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((current) => [...current, optimistic])

    let uploadedPath: string | null = null
    try {
      const { path } = await uploadChatMedia(task.id, file)
      uploadedPath = path
      // Insert the row and sign the media URL in parallel: one round trip, not two.
      const [created, signedUrl] = await Promise.all([
        sendMessage(task.id, profile, captionText, type, path, duration, replyTarget, { resolveMedia: false }),
        signChatMedia(path),
      ])
      const resolved: Message = { ...created, url: signedUrl, pending: false }
      setMessages((current) => {
        const next = current.map((item) => (item.id === tempId ? resolved : item))
        const seen = new Set<string>()
        return next.filter((item) => {
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
      })
      setReplyTarget(null)
    } catch (e) {
      setMessages((current) => current.filter((item) => item.id !== tempId))
      let message = e instanceof Error ? e.message : 'Could not attach the file.'
      if (uploadedPath) {
        try {
          await deleteChatMedia(uploadedPath)
        } catch {
          message = `${message} The uploaded file could not be cleaned up.`
        }
      }
      setError(message)
    } finally {
      URL.revokeObjectURL(localUrl)
      setUploading(false)
    }
  }, [task, profile, replyTarget])

  async function toggleRecording() {
    if (recording) {
      if (mediaRecorder.current?.state === 'recording') {
        setUploading(true)
        mediaRecorder.current.stop()
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
      const recorder = new MediaRecorder(audioStream, {
        ...(mimeType ? { mimeType } : {}),
        // Voice notes are speech: 32 kbps opus uploads ~4x faster than the
        // browser default and still sounds clean in a chat.
        audioBitsPerSecond: 32_000,
      })
      mediaRecorder.current = recorder
      recordingChunks.current = []
      recordingStartedAt.current = Date.now()
      setError(null)
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunks.current.push(event.data)
      }
      recorder.onstop = async () => {
        setRecording(false)
        audioStream.getTracks().forEach((track) => track.stop())
        const mime = recorder.mimeType || recordingChunks.current[0]?.type || 'audio/webm'
        const blob = new Blob(recordingChunks.current, { type: mime })
        if (!blob.size) {
          setUploading(false)
          setError('No audio was recorded. Please try again.')
          return
        }
        const baseMime = mime.split(';')[0]
        const extension = baseMime === 'audio/mp4' ? 'm4a' : baseMime === 'audio/ogg' ? 'ogg' : 'webm'
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: baseMime })
        const duration = Math.max(1, Math.ceil((Date.now() - recordingStartedAt.current) / 1000))
        await handleAttach(file, duration)
      }
      recorder.onerror = () => {
        setRecording(false)
        setUploading(false)
        audioStream.getTracks().forEach((track) => track.stop())
        setError('Voice recording failed. Please try again.')
      }
      recorder.start()
      setRecording(true)
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop())
      setError(e instanceof Error ? e.message : 'Microphone access was denied.')
    }
  }

  function toggleAudio(messageId: string, audio: HTMLAudioElement) {
    if (activeAudio.current === audio && playingMessageId === messageId) {
      audio.pause()
      audio.currentTime = 0
      activeAudio.current = null
      setPlayingMessageId(null)
      setProgressMessageId(messageId)
      setAudioProgress(0)
      return
    }

    activeAudio.current?.pause()
    if (activeAudio.current) activeAudio.current.currentTime = 0
    audio.currentTime = 0
    activeAudio.current = audio
    setPlayingMessageId(messageId)
    setProgressMessageId(messageId)
    setAudioProgress(0)
    void audio.play().catch(() => {
      if (activeAudio.current === audio) activeAudio.current = null
      setPlayingMessageId(null)
      setError('Could not play this voice note.')
    })
  }

  function handleAudioEnded(messageId: string) {
    if (activeAudio.current?.dataset.messageId !== messageId) return
    setAudioProgress(activeAudio.current.duration || 0)
    setProgressMessageId(messageId)
    setPlayingMessageId(null)
    activeAudio.current = null
  }

  function handleMessagePointerDown(message: Message, event: PointerEvent<HTMLDivElement>) {
    if (message.pending || message.deleted_at) return
    const target = event.target as HTMLElement
    if (target.closest('a') || (message.type !== 'audio' && target.closest('button, input'))) return
    if (event.button !== 0) return
    pointerStart.current = { messageId: message.id, x: event.clientX, y: event.clientY }
    longPressTriggered.current = false
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = window.setTimeout(() => {
      setActionMessageId(message.id)
      longPressTriggered.current = true
    }, 500)
  }

  function handleMessagePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    if (!start) return
    if (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12) {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleMessagePointerUp(message: Message, event: PointerEvent<HTMLDivElement>) {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    if (longPressTriggered.current) {
      window.setTimeout(() => {
        longPressTriggered.current = false
      }, 0)
      return
    }
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (!message.deleted_at && message.sender_id !== profile?.id && deltaX > 56 && Math.abs(deltaY) < 70) {
      setReplyTarget(message)
      setActionMessageId(null)
    }
  }

  function handleMessageContextMenu(messageId: string, event: MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    if (messageId.startsWith('temp-')) return
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    setActionMessageId(messageId)
  }

  function selectMessageForReply(message: Message, event: MouseEvent<HTMLDivElement>) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    if (message.deleted_at || message.sender_id === profile?.id) return
    if ((event.target as HTMLElement).closest('button, a, input')) return
    setReplyTarget(message)
    setActionMessageId(null)
  }

  async function copyMessage(message: Message) {
    if (!message.body || !navigator.clipboard?.writeText) {
      setError('Copy is not available in this browser.')
      return
    }
    try {
      await navigator.clipboard.writeText(message.body)
      setActionMessageId(null)
    } catch {
      setError('Could not copy this message.')
    }
  }

  async function handleDeleteMessage() {
    if (!deleteTarget || !profile) return
    const message = deleteTarget
    setDeleteTarget(null)
    try {
      const { mediaPath, message: deletedMessage } = await deleteMessage(message.id, profile.id)
      setMessages((current) => current.map((item) => item.id === message.id ? deletedMessage : item))
      setActionMessageId(null)
      if (replyTarget?.id === message.id) setReplyTarget(null)
      if (playingMessageId === message.id) {
        activeAudio.current?.pause()
        activeAudio.current = null
        setPlayingMessageId(null)
        setAudioProgress(0)
      }
      if (mediaPath) {
        try {
          await deleteChatMedia(mediaPath)
        } catch {
          setError('Message deleted, but its attached media could not be removed.')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this message.')
    }
  }

  if (loading) return <Spinner full />

  if (!authorized || !task) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-xl font-bold">{error ? 'Unable to open chat' : 'Chat unavailable'}</h1>
        <p role={error ? 'alert' : undefined} className="mt-2 text-sm text-muted">
          {error ?? 'This group chat is only available to the host and accepted participants.'}
        </p>
        <button type="button" className="btn-primary mt-5" onClick={() => navigate('/chats', { replace: true })}>Back to chats</button>
      </main>
    )
  }

  return (
    <main className="-mb-24 flex min-h-[100dvh] flex-col bg-canvas">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => navigate('/chats')} className="rounded-full p-2 hover:bg-canvas" aria-label="Back to chats">
          <ArrowLeft size={21} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/task/${task.id}`, { state: { openGroupInfo: true } })}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left transition hover:bg-canvas"
          aria-label="Open group and activity information"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff4d1] text-amber">
            <span className="text-sm font-bold" aria-hidden>G</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[16px] font-bold">{task.title}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              Group chat · {participants.length + 1} {participants.length === 0 ? 'member' : 'members'}
              <span aria-hidden>·</span>
              {Object.keys(checkins).length > 0 ? `${Object.keys(checkins).length} checked in` : 'nobody here yet'}
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 transition hover:bg-canvas"
            aria-label={muteThisChat ? 'Unmute notifications for this chat' : 'Mute notifications for this chat'}
            aria-pressed={muteThisChat}
            onClick={(event) => {
              event.stopPropagation()
              setMuteThisChat((v) => !v)
            }}
          >
            {muteThisChat ? <VolumeX size={19} aria-hidden /> : <Volume2 size={19} aria-hidden />}
          </button>
          <MoreVertical size={19} className="shrink-0 text-muted" aria-hidden />
        </button>
      </header>

      <section className="flex flex-1 flex-col px-3 pb-3">
        <div className="-mx-1 border-b border-line px-1">
          <section className="no-scrollbar flex gap-2 overflow-x-auto py-3" aria-label="Group members">
            <Link
              to={`/profile/${task.host_id}`}
              className="flex min-w-[92px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-center transition hover:bg-canvas"
            >
              <Avatar src={task.host_avatar_url} name={task.host_name} size={38} />
              <span className="max-w-[96px] truncate text-[10px] font-semibold">
                {task.host_id === profile?.id ? 'You · Host' : `${task.host_name} · Host`}
              </span>
            </Link>
            {participants.map((participant) => (
            <Link
              key={participant.id}
              to={`/profile/${participant.requester_id}`}
              className="flex min-w-[76px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-center transition hover:bg-canvas"
            >
              <Avatar src={participant.requester_avatar_url} name={participant.requester_name} size={38} />
              <span className="max-w-[96px] truncate text-[10px] font-semibold">
                {participant.requester_id === profile?.id ? 'You' : participant.requester_name}
              </span>
            </Link>
            ))}
          </section>
        </div>

        {/* Quick facts + one-tap replies + check-in */}
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Meeting quick facts">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-muted">
            <Clock3 size={11} aria-hidden />
            {formatDateTime(task.date_time)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-muted">
            <MapPin size={11} aria-hidden />
            <span className="max-w-[140px] truncate">{task.meeting_point}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-muted">
            <MessageSquare size={11} aria-hidden />
            {systemEvents.length} updates
          </span>
        </div>

        {/* Timeline of what happened historically */}
        {systemEvents.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Activity timeline">
            {systemEvents.slice(-6).map((event) => (
              <span key={event.id} className="inline-flex max-w-[160px] items-center gap-1.5 rounded-full bg-line px-2.5 py-1 text-[10px] font-semibold text-muted">
                <span aria-hidden>{event.event_type === 'joined' ? '🤝' : event.event_type === 'arrived' ? '📍' : event.event_type === 'completed' ? '✅' : event.event_type === 'recap' ? '📝' : 'ℹ️'}</span>
                <span className="truncate">{event.actor_name}{event.event_type === 'joined' ? ' joined' : event.event_type === 'arrived' ? ' arrived' : event.event_type === 'completed' ? ' — done' : event.event_type === 'recap' ? ' wrote a recap' : ''}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Quick messages">
          {[
            'On my way',
            'Running 5 mins late',
            'Traffic is bad',
          ].map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => void handleSend(text, 'text')}
              className="rounded-full border border-amber/40 bg-sun/15 px-3 py-1.5 text-[11px] font-semibold text-amber transition hover:bg-sun/25"
            >
              {text}
            </button>
          ))}
          <button
            type="button"
            disabled={checkinPending}
            aria-pressed={Boolean(checkins[profile?.id ?? ''])}
            onClick={async () => {
              if (!profile) return
              setCheckinPending(true)
              setError(null)
              try {
                await checkInToActivity(task.id, profile)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not check in.')
              } finally {
                setCheckinPending(false)
              }
            }}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              checkins[profile?.id ?? '']
                ? 'border border-verified/40 bg-verified/15 text-verified'
                : 'border border-amber/40 bg-sun/15 text-amber hover:bg-sun/25'
            } disabled:opacity-60`}
          >
            {checkinPending ? 'Checking…' : checkins[profile?.id ?? ''] ? '✓ I’m here' : 'Check in'}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-[13px] text-muted">No messages yet. Say hello to your group.</p>
          )}
          {messages.map((message, index) => {
            const mine = message.sender_id === profile?.id
            const previous = messages[index - 1]
            const showName = !mine && (!previous || previous.sender_id !== message.sender_id)
            return (
              <div key={message.id}>
                {(!previous || !isSameDay(message.created_at, previous.created_at)) && (
                  <p className="my-3 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {new Date(message.created_at).toLocaleDateString()}
                  </p>
                )}
                <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && (
                    <Link to={`/profile/${message.sender_id}`} aria-label={`View ${message.sender_name}'s profile`}>
                      <Avatar src={message.sender_avatar_url} name={message.sender_name} size={30} />
                    </Link>
                  )}
                  <div className={`max-w-[82%] ${mine ? 'text-right' : 'text-left'}`}>
                    {showName && (
                      <Link to={`/profile/${message.sender_id}`} className="mb-1 inline-block text-[10px] font-semibold text-muted hover:text-amber">
                        {message.sender_name}
                      </Link>
                    )}
                    <div className={`flex items-start gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="relative min-w-0 max-w-full" data-chat-message-actions>
                        <div
                          className={`chat-message-bubble inline-block max-w-full rounded-2xl p-2 text-left transition ${
                            mine ? 'bg-sun/40' : 'bg-white'
                          } ${replyTarget?.id === message.id ? 'ring-2 ring-amber' : ''} ${message.deleted_at ? 'italic text-muted' : ''}`}
                          onPointerDown={(event) => handleMessagePointerDown(message, event)}
                          onPointerMove={handleMessagePointerMove}
                          onPointerUp={(event) => handleMessagePointerUp(message, event)}
                          onPointerCancel={() => {
                            if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
                            longPressTimer.current = null
                            pointerStart.current = null
                          }}
                          onContextMenu={(event) => handleMessageContextMenu(message.id, event)}
                          onClick={(event) => selectMessageForReply(message, event)}
                        >
                          {message.reply_to_message_id && message.reply_to_preview && (
                            <div className="mb-1.5 min-w-0 border-l-2 border-amber px-2 py-1 text-left">
                              <p className="truncate text-[10px] font-bold text-amber">
                                {message.reply_to_sender_id && profile?.id && message.reply_to_sender_id === profile.id ? 'You' : message.reply_to_sender_name ?? 'Message'}
                              </p>
                              <p className="truncate text-[11px] text-muted">{message.reply_to_preview}</p>
                            </div>
                          )}
                          {!message.deleted_at && message.type === 'image' && message.url && (
                            <a href={message.url} target="_blank" rel="noreferrer">
                              <img
                                src={message.url}
                                alt="Photo shared in the group chat"
                                className={`max-h-72 max-w-full rounded-xl object-cover transition ${message.pending ? 'opacity-75' : ''}`}
                              />
                            </a>
                          )}
                          {!message.deleted_at && message.type === 'image' && message.body && (
                            <p className="whitespace-pre-wrap px-1 pt-1 text-[14px] leading-snug">{message.body}</p>
                          )}
                          {!message.deleted_at && message.type === 'audio' && message.url && (
                            <VoiceNotePlayer
                              messageId={message.id}
                              url={message.url}
                              duration={message.duration}
                              isPlaying={playingMessageId === message.id}
                              currentTime={progressMessageId === message.id ? audioProgress : 0}
                              onToggle={toggleAudio}
                              onProgress={(time) => {
                                setProgressMessageId(message.id)
                                setAudioProgress(time)
                              }}
                              onEnded={() => handleAudioEnded(message.id)}
                            />
                          )}
                          {message.type === 'text' && message.body && (
                            <p className="whitespace-pre-wrap px-1 py-0.5 text-[14px] leading-snug">
                              {message.body}
                            </p>
                          )}
                          {message.pending && (
                            <p className="mt-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
                              Sending…
                            </p>
                          )}
                        </div>
                        {!message.deleted_at && message.type === 'text' && (
                          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`} aria-label="React to message">
                            {REACTIONS.map((emoji) => {
                              const info = reactions[message.id]?.[emoji]
                              const count = info?.count ?? 0
                              const mine = info?.mine ?? false
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void onToggleReaction(message.id, emoji)}
                                  className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition ${
                                    mine
                                      ? 'border-amber bg-sun/25 text-amber'
                                      : 'border-line bg-canvas text-muted hover:text-ink'
                                  }`}
                                  aria-pressed={mine}
                                  aria-label={`React ${emoji} (${count})`}
                                >
                                  <span aria-hidden="true">{emoji}</span>
                                  {count > 0 && <span className="font-semibold">{count}</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {actionMessageId === message.id && !message.deleted_at && (
                          <div className={`absolute top-full z-20 mt-1 flex min-w-[150px] flex-col overflow-hidden rounded-xl border border-line bg-white py-1 text-left shadow-lift ${mine ? 'right-0' : 'left-0'}`} role="menu" aria-label="Message actions">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setReplyTarget(message)
                                setActionMessageId(null)
                              }}
                              className="flex min-h-10 items-center gap-2 px-3 text-[12px] font-medium hover:bg-canvas"
                            >
                              <Reply size={15} aria-hidden /> Reply
                            </button>
                            {message.type === 'text' && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => void copyMessage(message)}
                                className="flex min-h-10 items-center gap-2 px-3 text-[12px] font-medium hover:bg-canvas"
                              >
                                <Copy size={15} aria-hidden /> Copy
                              </button>
                            )}
                            {mine && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setDeleteTarget(message)
                                  setActionMessageId(null)
                                }}
                                className="flex min-h-10 items-center gap-2 px-3 text-[12px] font-medium text-alert hover:bg-canvas"
                              >
                                <Trash2 size={15} aria-hidden /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {!message.deleted_at && (
                        <button
                          type="button"
                          aria-label={`More options for ${mine ? 'your' : `${message.sender_name}'s`} message`}
                          aria-haspopup="menu"
                          aria-expanded={actionMessageId === message.id}
                          onClick={() => setActionMessageId((current) => current === message.id ? null : message.id)}
                          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
                          data-chat-message-actions
                        >
                          <MoreVertical size={18} aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted">{formatTime(message.created_at)}</p>
                  </div>
                  {mine && (
                    <Link to={`/profile/${message.sender_id}`} aria-label="View your profile">
                      <Avatar src={profile?.avatar_url ?? null} name={profile?.display_name ?? 'You'} size={30} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={chatEnd} />
        </div>

        {isHost && task.status === 'completed' && !recapPosted && (
          <div className="mb-2 rounded-xl border border-amber/30 bg-sun/15 p-3">
            <p className="text-[11px] font-bold text-amber">Share a recap</p>
            <p className="mt-0.5 text-[11px] text-ink/80">Tell everyone what went down — what you loved, what you&apos;d skip next time.</p>
            <textarea
              className="field mt-2 min-h-[60px] text-[13px]"
              placeholder="e.g. Brilliant energy. Go for the fruit stand first — everyone agreed next time\u2019ll be there at 8am sharp."
              value={recapText}
              onChange={(event) => setRecapText(event.target.value)}
              maxLength={400}
            />
            <button
              type="button"
              disabled={!recapText.trim()}
              className="btn-primary btn-sm mt-2"
              onClick={async () => {
                if (!profile || !recapText.trim()) return
                setError(null)
                try {
                  await writeRecap(task.id, profile.id, isHost ? 'You' : profile.display_name, recapText.trim())
                  setRecapPosted(true)
                  setRecapText('')
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not save recap.')
                }
              }}
            >
              Post recap
            </button>
          </div>
        )}
        {recapPosted && (
          <p className="mb-2 text-[11px] font-semibold text-verified">Recap saved. Everyone can see it on this activity.</p>
        )}

        <div className="sticky bottom-0 -mx-3 border-t border-line bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
          {error && <p role="alert" className="px-2 pb-2 text-[12px] font-medium text-alert">{error}</p>}
          {replyTarget && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-amber bg-canvas px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-amber">Replying to {replyTarget.sender_id === profile?.id ? 'You' : replyTarget.sender_name}</p>
                <p className="truncate text-[11px] text-muted">
                  {replyTarget.type === 'image' ? (replyTarget.body || 'Photo') : replyTarget.type === 'audio' ? 'Voice note' : replyTarget.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                aria-label="Cancel reply"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <label className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas ${uploading || recording ? 'pointer-events-none opacity-50' : ''}`} title="Take a photo">
              <Camera size={19} aria-hidden />
              <input type="file" accept="image/*" capture="environment" aria-label="Take a photo" className="sr-only" disabled={uploading || recording} onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) setPendingPhoto(file)
                event.currentTarget.value = ''
              }} />
            </label>
            <label className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas ${uploading || recording ? 'pointer-events-none opacity-50' : ''}`} title="Attach a photo or audio">
              <Paperclip size={19} aria-hidden />
              <input type="file" accept="image/*,audio/*" aria-label="Attach a photo or audio" className="sr-only" disabled={uploading || recording} onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file && file.type.startsWith('image/') && file.type !== 'image/svg+xml') setPendingPhoto(file)
                else if (file) void handleAttach(file)
                event.currentTarget.value = ''
              }} />
            </label>
            <button type="button" onClick={() => void toggleRecording()} disabled={uploading} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${recording ? 'animate-pulse bg-alert text-white' : 'bg-canvas text-muted'} disabled:opacity-50`} aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}>
              {recording ? <Square size={16} fill="currentColor" aria-hidden /> : <Mic size={19} aria-hidden />}
            </button>
            <input
              className="field min-h-[42px] min-w-0 flex-1 border-0 bg-canvas px-3"
              placeholder="Message the group…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend(draft)
                }
              }}
              maxLength={2000}
              disabled={uploading || recording}
            />
            <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber text-white disabled:opacity-50" onClick={() => void handleSend(draft)} disabled={!draft.trim() || uploading || recording} aria-label="Send message">
              {uploading ? <span className="text-xs">…</span> : <Send size={17} aria-hidden />}
            </button>
          </div>
        </div>
      </section>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this message?"
        message="This message will be removed from the group chat for everyone."
        cancelLabel="Keep message"
        confirmLabel="Delete message"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteMessage()}
      />
      {pendingPhoto && (
        <ChatPhotoEditor
          file={pendingPhoto}
          onCancel={() => setPendingPhoto(null)}
          onSend={(file, caption) => {
            setPendingPhoto(null)
            void handleAttach(file, null, caption)
          }}
        />
      )}
    </main>
  )
}
