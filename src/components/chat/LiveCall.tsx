import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Room, RoomEvent, isVideoTrack, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from 'livekit-client'
import { fetchLiveKitToken, type CallType } from '../../lib/calls'

interface Props {
  sessionId: string
  chatId: string
  callType: CallType
  onLeave: () => void
}

/** Isolated LiveKit call surface: only our three controls are React-rendered;
 *  participant media is attached directly to video elements by the SDK. */
export default function LiveCall({ sessionId, chatId, callType, onLeave }: Props) {
  const roomRef = useRef<Room | null>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Connecting…')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(callType === 'video')
  const [remoteCount, setRemoteCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room

    const attach = (track: RemoteTrack, participant: RemoteParticipant) => {
      if (!isVideoTrack(track)) return
      const el = track.attach() as HTMLVideoElement
      el.autoplay = true
      el.playsInline = true
      el.className = 'h-full w-full rounded-[18px] object-cover'
      const holder = document.createElement('div')
      holder.dataset.participant = participant.identity
      holder.className = 'relative overflow-hidden rounded-[18px] bg-white/10 aspect-square'
      holder.appendChild(el)
      const label = document.createElement('p')
      label.textContent = participant.name || 'Member'
      label.className = 'absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white'
      holder.appendChild(label)
      mediaRef.current?.appendChild(holder)
    }
    const detach = (track: RemoteTrack) => {
      if (!isVideoTrack(track)) return
      const el = track.detach()[0]
      el?.parentElement?.parentElement?.remove()
    }
    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      attach(track, participant)
      setRemoteCount(room.remoteParticipants.size)
    })
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication) => detach(track))
    room.on(RoomEvent.ParticipantDisconnected, () => setRemoteCount(room.remoteParticipants.size))
    room.on(RoomEvent.Disconnected, () => setStatus('Call ended'))

    void (async () => {
      try {
        const { url, token } = await fetchLiveKitToken({ chatId, roomName: sessionId })
        await room.connect(url, token)
        if (cancelled) { await room.disconnect(); return }
        await room.localParticipant.setMicrophoneEnabled(true)
        if (callType === 'video') await room.localParticipant.setCameraEnabled(true)
        setStatus('Connected')
      } catch (e) {
        setStatus(`Could not connect: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()

    return () => {
      cancelled = true
      void room.disconnect().catch(() => undefined)
      roomRef.current = null
      if (mediaRef.current) mediaRef.current.innerHTML = ''
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

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-[#0B0B0F] text-white">
      <div className="flex items-center justify-between px-5 pt-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Come w’ me call</p>
          <p className="mt-0.5 text-[14px] font-semibold">{status}{remoteCount > 0 ? ` · ${remoteCount} here` : ''}</p>
        </div>
        <button type="button" onClick={onLeave} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3B30]" aria-label="End call">
          <PhoneOff size={20} aria-hidden />
        </button>
      </div>

      <div ref={mediaRef} className="grid min-h-0 flex-1 grid-cols-2 content-center gap-3 overflow-y-auto p-4" />

      {remoteCount === 0 && (
        <p className="px-6 text-center text-[14px] leading-relaxed text-white/60">
          Waiting for the others to join the activity call…
        </p>
      )}

      <div className="flex items-center justify-center gap-4 pb-10 pt-3">
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
      </div>
    </div>
  )
}
