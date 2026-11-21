import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Speaker, Video, VideoOff } from 'lucide-react'
import {
  Room,
  RoomEvent,
  ConnectionState,
  isVideoTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalTrackPublication,
} from 'livekit-client'
import { fetchLiveKitToken, type CallType } from '../../lib/calls'

interface Props {
  sessionId: string
  chatId: string
  callType: CallType
  callerName?: string
  onLeave: () => void
}

const STATUS: Record<ConnectionState, string> = {
  [ConnectionState.Disconnected]: 'Disconnected',
  [ConnectionState.Connecting]: 'Connecting…',
  [ConnectionState.Connected]: 'Connected',
  [ConnectionState.Reconnecting]: 'Reconnecting…',
  [ConnectionState.SignalReconnecting]: 'Reconnecting…',
}

/** LiveKit call surface: participant video/audio, local preview, mute, camera,
 *  speaker selection and hangup. Media elements are attached imperatively by
 *  the SDK; only the controls and labels are React-rendered. */
export default function LiveCall({ sessionId, chatId, callType, onLeave }: Props) {
  const roomRef = useRef<Room | null>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const audioHolderRef = useRef<HTMLDivElement>(null)
  const localPreviewRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Connecting…')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(callType === 'video')
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; video: boolean }>>([])
  const [speakerId, setSpeakerId] = useState<string>('')
  const [speakers, setSpeakers] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    let cancelled = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room

    const refreshParticipants = () => {
      setParticipants(
        [...room.remoteParticipants.values()].map((p) => ({
          id: p.identity,
          name: p.name || 'Member',
          video: [...p.videoTrackPublications.values()].some((t) => t.isSubscribed),
        })),
      )
    }

    const attachTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
      if (isVideoTrack(track)) {
        const el = track.attach() as HTMLVideoElement
        el.autoplay = true
        el.playsInline = true
        el.className = 'h-full w-full object-cover'
        const holder = document.createElement('div')
        holder.dataset.track = track.sid
        holder.className = 'relative aspect-square overflow-hidden rounded-[20px] bg-white/10'
        holder.appendChild(el)
        mediaRef.current?.appendChild(holder)
      } else {
        // Remote audio MUST be attached to a DOM element or nothing is heard.
        const el = track.attach() as HTMLAudioElement
        el.autoplay = true
        el.dataset.track = track.sid
        audioHolderRef.current?.appendChild(el)
        void el.play().catch(() => undefined)
      }
      refreshParticipants()
    }
    const detachTrack = (track: RemoteTrack) => {
      const el = track.detach()[0]
      el?.parentElement?.remove()
      refreshParticipants()
    }
    const attachLocalVideo = (pub: LocalTrackPublication) => {
      if (!isVideoTrack(pub.track) || !localPreviewRef.current) return
      localPreviewRef.current.innerHTML = ''
      const el = pub.track.attach() as HTMLVideoElement
      el.autoplay = true
      el.playsInline = true
      el.muted = true
      el.className = 'h-full w-full object-cover'
      localPreviewRef.current.appendChild(el)
    }

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => attachTrack(track, participant))
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => detachTrack(track))
    room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => attachLocalVideo(pub))
    room.on(RoomEvent.LocalTrackUnpublished, () => { if (localPreviewRef.current) localPreviewRef.current.innerHTML = '' })
    room.on(RoomEvent.ParticipantConnected, refreshParticipants)
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipants)
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => setStatus(STATUS[state] ?? state))
    room.on(RoomEvent.Disconnected, () => setStatus('Call ended'))

    void (async () => {
      try {
        const { url, token } = await fetchLiveKitToken({ chatId, roomName: sessionId })
        await room.connect(url, token)
        if (cancelled) { await room.disconnect(); return }
        await room.localParticipant.setMicrophoneEnabled(true)
        if (callType === 'video') await room.localParticipant.setCameraEnabled(true)
        setMicOn(true)
        setCamOn(callType === 'video')
      } catch (e) {
        setStatus(`Could not connect: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()

    // Speaker options where the browser supports output-device selection (Chrome/Android).
    if (navigator.mediaDevices?.enumerateDevices) {
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        const outs = devices.filter((d) => d.kind === 'audiooutput' && d.deviceId)
        setSpeakers(outs.map((d) => ({ id: d.deviceId, label: d.label || 'Speaker' })))
        if (outs[0]) setSpeakerId(outs[0].deviceId)
      }).catch(() => undefined)
    }

    return () => {
      cancelled = true
      void room.disconnect().catch(() => undefined)
      roomRef.current = null
      if (mediaRef.current) mediaRef.current.innerHTML = ''
      if (audioHolderRef.current) audioHolderRef.current.innerHTML = ''
      if (localPreviewRef.current) localPreviewRef.current.innerHTML = ''
    }
  }, [sessionId, chatId, callType])

  const toggleMic = async () => {
    const next = !micOn
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next)
    setMicOn(next)
  }
  const toggleCam = async () => {
    const next = !camOn
    await roomRef.current?.localParticipant.setCameraEnabled(next)
    setCamOn(next)
  }
  const cycleSpeaker = async () => {
    if (speakers.length < 2) return
    const index = speakers.findIndex((s) => s.id === speakerId)
    const next = speakers[(index + 1) % speakers.length]
    const elements = audioHolderRef.current?.querySelectorAll('audio') ?? []
    for (const el of elements) {
      const withSink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
      if (withSink.setSinkId) await withSink.setSinkId(next.id).catch(() => undefined)
    }
    setSpeakerId(next.id)
  }

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-[#0B0B0F] text-white">
      <div className="flex items-center justify-between px-5 pt-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Come w’ me call</p>
          <p className="mt-0.5 text-[14px] font-semibold">{status}{participants.length > 0 ? ` · ${participants.length} here` : ''}</p>
        </div>
        <button type="button" onClick={onLeave} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3B30]" aria-label="End call">
          <PhoneOff size={20} aria-hidden />
        </button>
      </div>

      <div ref={mediaRef} className="grid min-h-0 flex-1 grid-cols-2 content-center gap-3 overflow-y-auto p-4" />

      {participants.length === 0 && (
        <p className="px-6 text-center text-[14px] leading-relaxed text-white/60">
          Waiting for the others to join the activity call…
        </p>
      )}
      {participants.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-4 pb-1">
          {participants.map((p) => (
            <span key={p.id} className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold">
              {p.name}{p.video ? ' · camera on' : ''}
            </span>
          ))}
        </div>
      )}

      <div ref={audioHolderRef} className="hidden" aria-hidden />

      {/* local camera preview */}
      <div className="absolute bottom-28 right-4 h-24 w-24 overflow-hidden rounded-[18px] border-2 border-white/20 bg-white/10">
        <div ref={localPreviewRef} className={camOn ? 'h-full w-full' : 'hidden'} />
        {!camOn && <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white/60">You · camera off</span>}
      </div>

      <div className="flex items-center justify-center gap-3 pb-10 pt-3">
        <button
          type="button"
          onClick={() => void toggleMic()}
          className={`flex h-14 w-14 items-center justify-center rounded-full ${micOn ? 'bg-white/15' : 'bg-white text-[#0B0B0F]'}`}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <Mic size={22} aria-hidden /> : <MicOff size={22} aria-hidden />}
        </button>
        {callType === 'video' && (
          <button
            type="button"
            onClick={() => void toggleCam()}
            className={`flex h-14 w-14 items-center justify-center rounded-full ${camOn ? 'bg-white/15' : 'bg-white text-[#0B0B0F]'}`}
            aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {camOn ? <Video size={22} aria-hidden /> : <VideoOff size={22} aria-hidden />}
          </button>
        )}
        {speakers.length > 0 && (
          <button
            type="button"
            onClick={() => void cycleSpeaker()}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15"
            aria-label="Switch speaker"
            title={speakers.find((s) => s.id === speakerId)?.label}
          >
            <Speaker size={22} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
