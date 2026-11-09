import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { submitSOS } from '../lib/sos'

interface Props {
  taskId: string
  onClose: () => void
  onSent: () => void
}

export default function SOSConfirmationSheet({
  taskId,
  onClose,
  onSent,
}: Props) {
  const { profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [locationCaptured, setLocationCaptured] = useState<boolean>(false)
  const [location, setLocation] = useState<{
    latitude: number
    longitude: number
    address?: string
  } | null>(null)

  async function captureLocation() {
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser does not support location services.')
      return
    }
    setLocationError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation!.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      setLocationCaptured(true)
    } catch {
      setLocationError('Could not access your location. Please enable location services and try again.')
    }
  }

  async function handleSend() {
    if (!profile) return
    if (!locationCaptured || !location) {
      setLocationError('Please allow location access before sending.')
      return
    }
    setSubmitting(true)
    try {
      await submitSOS(taskId, profile, location, mediaFile)
      onSent()
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : 'Could not send SOS alert.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sun/20 text-amber-900 font-display font-bold text-xs shrink-0">
          !
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-ink">Emergency SOS</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            This will send your location and any photo/video to our safety team. A human will review it.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Step 1: Location</p>
        <button
          onClick={captureLocation}
          disabled={submitting}
          className={`w-full py-3 rounded-xl border border-line text-left flex items-center justify-between transition ${locationCaptured ? 'bg-sun/20 border-amber text-amber-900' : 'text-muted'}`}
        >
          <span>
            {locationCaptured ? 'Location captured' : 'Send my location'}
          </span>
          <span className="text-[10px]">{locationError ? '⚠' : locationCaptured ? '✓' : ''}</span>
        </button>
        {locationError && (
          <p className="mt-1 text-[11px] text-alert">{locationError}</p>
        )}
        {location && (
          <p className="mt-1 text-[11px] text-muted">
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Step 2: Attach media (optional)</p>
        <label className="flex items-center gap-3 cursor-pointer border border-line rounded-xl bg-canvas p-3">
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setMediaFile(f)
            }}
          />
          <span className="text-[13px] text-ink">{mediaFile ? mediaFile.name : 'Attach photo or video'}</span>
        </label>
        {mediaFile && (
          <p className="mt-1 text-[11px] text-muted">
            This will be sent to our safety team along with your location.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-alert/20 bg-alert/5 p-4">
        <p className="text-[12px] font-semibold text-alert">Important</p>
        <p className="mt-1 text-[12px] text-ink/80 leading-relaxed">
          Come w' me is not a replacement for emergency services.{' '}
          <span className="font-semibold">Call 112 or 199 immediately</span> if you are in danger.
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="btn-ghost flex-1"
          disabled={submitting}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={submitting || !locationCaptured}
          onClick={handleSend}
        >
          {submitting ? 'Sending…' : 'Send SOS alert'}
        </button>
      </div>
    </div>
  )
}
