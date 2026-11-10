import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Copy, Mic, MoreVertical, Paperclip, Reply, Send, Square, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import {
  deleteMessage,
  deleteChatMedia,
  fetchMessages,
  fetchMyJoinRequest,
  fetchParticipants,
  fetchTask,
  markChatRead,
  resolveChatMedia,
  sendMessage,
  subscribeToMessages,
  uploadChatMedia,
} from '../lib/api'
import { formatTime, isSameDay } from '../lib/format'
import { usePersistedState } from '../lib/drafts'
import type { JoinRequest, Message, Task } from '../types'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import VoiceNotePlayer from '../components/VoiceNotePlayer'

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
  const [draft, setDraft] = usePersistedState(`chat:${id}:draft`, '')
  const [uploading, setUploading] = useState(false)
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
    if (!task || !authorized) return
    let active = true
    fetchMessages(task.id)
      .then(async (rows) => {
        if (!active) return
        setMessages(rows)
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

  const handleAttach = useCallback(async (file: File, duration: number | null = null) => {
    if (!task) return
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
    let uploadedPath: string | null = null
    try {
      const { path } = await uploadChatMedia(task.id, file)
      uploadedPath = path
      const sent = await handleSend('', image ? 'image' : 'audio', path, duration)
      if (!sent) {
        await deleteChatMedia(path)
        uploadedPath = null
      }
    } catch (e) {
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
      setUploading(false)
    }
  }, [task, handleSend])

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
      const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream)
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
            <span className="block truncate text-[12px] text-muted">
              Group chat · {participants.length + 1} {participants.length === 0 ? 'member' : 'members'}
            </span>
          </span>
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
                                {message.reply_to_sender_name ?? 'Message'}
                              </p>
                              <p className="truncate text-[11px] text-muted">{message.reply_to_preview}</p>
                            </div>
                          )}
                          {!message.deleted_at && message.type === 'image' && message.url && (
                            <a href={message.url} target="_blank" rel="noreferrer">
                              <img src={message.url} alt="Photo shared in the group chat" className="max-h-72 max-w-full rounded-xl object-cover" />
                            </a>
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
                        </div>
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

        <div className="sticky bottom-0 -mx-3 border-t border-line bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
          {error && <p role="alert" className="px-2 pb-2 text-[12px] font-medium text-alert">{error}</p>}
          {replyTarget && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-amber bg-canvas px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-amber">Replying to {replyTarget.sender_name}</p>
                <p className="truncate text-[11px] text-muted">
                  {replyTarget.type === 'image' ? 'Photo' : replyTarget.type === 'audio' ? 'Voice note' : replyTarget.body}
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
                if (file) void handleAttach(file)
                event.currentTarget.value = ''
              }} />
            </label>
            <label className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas ${uploading || recording ? 'pointer-events-none opacity-50' : ''}`} title="Attach a photo or audio">
              <Paperclip size={19} aria-hidden />
              <input type="file" accept="image/*,audio/*" aria-label="Attach a photo or audio" className="sr-only" disabled={uploading || recording} onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) void handleAttach(file)
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
    </main>
  )
}
