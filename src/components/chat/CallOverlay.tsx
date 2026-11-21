import { PhoneOff, Video, Phone } from 'lucide-react'
import type { CallSession } from '../../lib/calls'

interface Props {
  incoming: CallSession | null
  callerName: string
  ringSeconds: number
  active: CallSession | null
  error: string | null
  joining: boolean
  onAccept: () => void
  onDecline: () => void
  onLeave: () => void
  onDismissError: () => void
}

/** Purely presentational. The call provider owns the iframe URL; everything
 *  inside the iframe is Jitsi's own UI, isolated from the app's CSS. */
export default function CallOverlay({
  incoming,
  callerName,
  ringSeconds,
  active,
  error,
  joining,
  onAccept,
  onDecline,
  onLeave,
  onDismissError,
}: Props) {
  return (
    <>
      {active && (
        <iframe
          src={active.room_url}
          title="Activity call"
          allow="camera; microphone; autoplay; fullscreen; display-capture"
          referrerPolicy="no-referrer"
          className="fixed inset-0 z-[9998] h-full w-full border-0 bg-[#0B0B0F]"
        />
      )}

      {active && (
        <button
          type="button"
          onClick={onLeave}
          className="fixed right-4 top-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-lg"
          aria-label="End call"
        >
          <PhoneOff size={20} aria-hidden />
        </button>
      )}

      {incoming && !active && (
        <div className="fixed inset-x-0 bottom-4 z-[9997] mx-auto w-[94%] max-w-sm">
          <div className="rounded-[24px] bg-[#1A1A1A] p-4 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F58220]">
                {incoming.call_type === 'video' ? <Video size={20} aria-hidden /> : <Phone size={20} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60">
                  Incoming {incoming.call_type} call · 0:{String(ringSeconds).padStart(2, '0')}
                </p>
                <p className="mt-0.5 truncate text-[17px] font-bold">{callerName}</p>
                <p className="mt-0.5 text-[13px] text-white/60">Answer before it rings out</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onDecline}
                className="flex h-12 items-center justify-center rounded-full bg-[#FF3B30] text-[15px] font-bold text-white active:scale-[0.98]"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={joining}
                className="flex h-12 items-center justify-center rounded-full bg-[#F58220] text-[15px] font-bold text-white active:scale-[0.98] disabled:opacity-60"
              >
                {joining ? 'Joining…' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <button
          type="button"
          onClick={onDismissError}
          className="fixed left-1/2 top-3 z-[9999] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl bg-[#1A1A1A] px-4 py-3 text-center text-[13px] font-semibold leading-snug text-white shadow-lg"
        >
          {error}
          <span className="mt-1 block text-[11px] font-normal text-white/60">Tap to dismiss</span>
        </button>
      )}
    </>
  )
}
