import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Signal, Users, Video, VideoOff, X } from 'lucide-react'
import {
  Room,
  RoomEvent,
  ConnectionState,
  ConnectionQuality,
  isVideoTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalTrackPublication,
  type Participant,
} from 'livekit-client'
import { fetchLiveKitToken, type CallType } from '../../lib/calls'

interface Props {
  sessionId: string
  chatId: string
  callType: CallType
  onLeave: () => void
}

type Tile = {
  id: string
  name: string
  isLocal: boolean
  micOn: boolean
  camOn: boolean
  speaking: boolean
  quality: string
}

const STATUS: Record<ConnectionState, string> = {
  [ConnectionState.Disconnected]: 'Call ended',
  [ConnectionState.Connecting]: 'Connecting…',
  [ConnectionState.Connected]: 'Connected',
  [ConnectionState.Reconnecting]: 'Reconnecting…',
  [ConnectionState.SignalReconnecting]: 'Reconnecting…',
}
const qualityLabel = (q: ConnectionQuality) =>
  q === ConnectionQuality.Excellent ? 'Strong' : q === ConnectionQuality.Good ? 'Good' : q === ConnectionQuality.Poor ? 'Weak' : 'Lost'
const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || '?'

/** Meet-style call surface built on LiveKit. Media elements are attached by the
 *  SDK; React only renders tiles, labels, and controls. */
export default function LiveCall({ sessionId, chatId, callType, onLeave }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const audioHolderRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<Room | null>(null)
  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map())
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map())
  const activeSpeakers = useRef<Set<string>>(new Set())
  const [status, setStatus] = useState('Connecting…')
  const [tiles, setTiles] = useState<Tile[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(callType === 'video')
  const [showPeople, setShowPeople] = useState(false)

  useEffect(() => {
    let cancelled = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room

    const refresh = () => {
      const toTile = (p: Participant, isLocal: boolean): Tile => ({
        id: p.identity,
        name: isLocal ? 'You' : (p.name || 'Member'),
        isLocal,
        micOn: p.isMicrophoneEnabled,
        camOn: [...p.videoTrackPublications.values()].some((t) => t.videoTrack && (isLocal || t.isSubscribed)),
        speaking: activeSpeakers.current.has(p.identity),
        quality: qualityLabel(p.connectionQuality),
      })
      setTiles([toTile(room.localParticipant, true), ...[...room.remoteParticipants.values()].map((p) => toTile(p, false))])
    }

    const mountVideo = () => {
      for (const [id, el] of videoEls.current) {
        const holder = rootRef.current?.querySelector(`[data-video-for="${CSS.escape(id)}"]`)
        if (holder && el.parentElement !== holder) holder.appendChild(el)
      }
      refresh()
    }

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (isVideoTrack(track)) {
        const el = track.attach() as HTMLVideoElement
        el.autoplay = true
        el.playsInline = true
        el.className = 'h-full w-full object-cover'
        videoEls.current.set(participant.identity, el)
        mountVideo()
      } else {
        const el = track.attach() as HTMLAudioElement
        el.autoplay = true
        audioEls.current.set(participant.identity, el)
        audioHolderRef.current?.appendChild(el)
        void el.play().catch(() => undefined)
      }
    })
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      const video = videoEls.current.get(participant.identity)
      if (video && isVideoTrack(track)) { video.srcObject = null; video.remove(); videoEls.current.delete(participant.identity) }
      const audio = audioEls.current.get(participant.identity)
      if (audio && !isVideoTrack(track)) { audio.srcObject = null; audio.remove(); audioEls.current.delete(participant.identity) }
      refresh()
    })
    room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
      const track = pub.videoTrack
      if (!track) return
      const el = track.attach() as HTMLVideoElement
      el.autoplay = true
      el.playsInline = true
      el.muted = true
      el.className = 'h-full w-full object-cover'
      videoEls.current.set(room.localParticipant.identity, el)
      mountVideo()
    })
    room.on(RoomEvent.LocalTrackUnpublished, () => {
      const el = videoEls.current.get(room.localParticipant.identity)
      if (el) { el.srcObject = null; el.remove() }
      videoEls.current.delete(room.localParticipant.identity)
      refresh()
    })
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      activeSpeakers.current = new Set(speakers.map((p) => p.identity))
      refresh()
    })
    room.on(RoomEvent.ParticipantConnected, refresh)
    room.on(RoomEvent.ParticipantDisconnected, refresh)
    room.on(RoomEvent.TrackMuted, refresh)
    room.on(RoomEvent.TrackUnmuted, refresh)
    room.on(RoomEvent.ConnectionQualityChanged, refresh)
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      setStatus(STATUS[state] ?? state)
      if (state === ConnectionState.Connected) setElapsed(0)
    })

    void (async () => {
      try {
        const { url, token } = await fetchLiveKitToken({ chatId, roomName: sessionId })
        await room.connect(url, token)
        if (cancelled) { await room.disconnect(); return }
        await room.localParticipant.setMicrophoneEnabled(true)
        if (callType === 'video') await room.localParticipant.setCameraEnabled(true)
        setMicOn(true)
        setCamOn(callType === 'video')
        refresh()
      } catch (e) {
        setStatus('Connection failed — check your internet and try again')
      }
    })()

    return () => {
      cancelled = true
      void room.disconnect().catch(() => undefined)
      roomRef.current = null
      videoEls.current.forEach((el) => { el.srcObject = null; el.remove() })
      audioEls.current.forEach((el) => { el.srcObject = null; el.remove() })
      videoEls.current.clear()
      audioEls.current.clear()
    }
  }, [sessionId, chatId, callType])

  useEffect(() => {
    for (const [id, el] of videoEls.current) {
      const holder = rootRef.current?.querySelector(`[data-video-for="${CSS.escape(id)}"]`)
      if (holder && el.parentElement !== holder) holder.appendChild(el)
    }
  }, [tiles])

  useEffect(() => {
    if (status !== 'Connected') return
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [status])

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

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
  return (
    <div ref={rootRef} className="fixed inset-0 z-[9998] flex flex-col bg-[#0B0B0F] text-white">
      <div className="flex items-start justify-between px-5 pt-7">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Come w’ me · group call</p>
          <p className="mt-1 flex items-center gap-2 text-[15px] font-bold">
            {clock}
            <span className="flex items-center gap-1 text-[12px] font-semibold text-white/60">
              <Signal size={13} aria-hidden /> {status}
            </span>
          </p>
        </div>
        <button type="button" onClick={onLeave} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3B30] shadow-lg" aria-label="End call">
          <PhoneOff size={20} aria-hidden />
        </button>
      </div>

      <div className={`grid min-h-0 flex-1 content-center gap-3 p-4 ${tiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[22px] bg-white/10 ${tile.speaking ? 'ring-2 ring-[#F58220]' : ''}`}
          >
            <div data-video-for={tile.id} className="absolute inset-0" />
            {!tile.camOn && !videoEls.current.has(tile.id) && (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 font-display text-[20px] font-bold">
                {initials(tile.name)}
              </span>
            )}
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
              <span className="truncate rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold backdrop-blur">
                {tile.name}{tile.isLocal ? '' : ` · ${tile.quality}`}
              </span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${tile.micOn ? 'bg-black/45' : 'bg-[#FF3B30]'}`}>
                {tile.micOn ? <Mic size={14} aria-hidden /> : <MicOff size={14} aria-hidden />}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showPeople && (
        <div className="absolute bottom-28 left-4 right-4 z-[9999] rounded-[22px] bg-[#1A1A1A] p-4 shadow-2xl ring-1 ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-bold">In this call · {tiles.length}</p>
            <button type="button" onClick={() => setShowPeople(false)} className="rounded-full p-1 text-white/60" aria-label="Close participant list">
              <X size={17} aria-hidden />
            </button>
          </div>
          <div className="space-y-2">
            {tiles.map((tile) => (
              <div key={tile.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold">{initials(tile.name)}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{tile.name}</span>
                {!tile.micOn && <MicOff size={15} className="text-[#FF3B30]" aria-hidden />}
                {tile.camOn ? <Video size={15} className="text-white/60" aria-hidden /> : <VideoOff size={15} className="text-white/40" aria-hidden />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={audioHolderRef} className="hidden" aria-hidden />

      <div className="flex items-start justify-center gap-3 pb-9 pt-2">
        <Control label={micOn ? 'Mute' : 'Unmute'} active={!micOn} onClick={() => void toggleMic()} icon={micOn ? Mic : MicOff} />
        <Control label={camOn ? 'Camera off' : 'Camera on'} active={!camOn} onClick={() => void toggleCam()} icon={camOn ? Video : VideoOff} />
        <Control label="People" active={showPeople} onClick={() => setShowPeople((v) => !v)} icon={Users} />
      </div>
    </div>
  )
}

function Control({ label, icon: Icon, onClick, active, hidden }: {
  label: string
  icon: typeof Mic
  onClick: () => void
  active?: boolean
  hidden?: boolean
}) {
  if (hidden) return null
  return (
    <button type="button" onClick={onClick} className="flex w-16 flex-col items-center gap-1.5" aria-label={label}>
      <span className={`flex h-14 w-14 items-center justify-center rounded-full transition ${active ? 'bg-white text-[#0B0B0F]' : 'bg-white/15 text-white'}`}>
        <Icon size={21} aria-hidden />
      </span>
      <span className="text-[11px] font-semibold text-white/70">{label}</span>
    </button>
  )
}
