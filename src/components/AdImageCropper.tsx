import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Check, Loader2, RotateCcw, X } from 'lucide-react'
import { AD_SLOT_ASPECT } from '../lib/adSlot'

type Props = {
  src: string
  onCancel: () => void
  onDone: (file: File, previewUrl: string) => void
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That picture could not be opened. Try another one.'))
    img.src = src
  })
}

/** Cut the chosen band out of the original image and hand back a ready-to-upload file. */
async function cropToFile(src: string, area: Area): Promise<File> {
  const img = await loadImage(src)
  const scale = Math.min(1, 1600 / area.width)
  const width = Math.max(1, Math.round(area.width * scale))
  const height = Math.max(1, Math.round(area.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not crop this picture.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  )
  if (!blob) throw new Error('Your browser could not crop this picture.')
  return new File([blob], 'ad-picture.jpg', { type: 'image/jpeg' })
}

export default function AdImageCropper({ src, onCancel, onDone }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleComplete = useCallback((_area: Area, pixels: Area) => {
    setArea(pixels)
  }, [])

  async function confirm() {
    if (!area) return
    setBusy(true)
    setError(null)
    try {
      const file = await cropToFile(src, area)
      onDone(file, URL.createObjectURL(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not crop this picture.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60">
      <div className="mx-auto w-full max-w-[480px] rounded-t-3xl bg-white px-4 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[17px] font-bold text-ink">Choose the part to show</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              The bright band is exactly what appears in the feed. Drag the picture up or down,
              and zoom in to fill it.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close cropper"
            className="-mr-1 shrink-0 p-1.5 text-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative mt-3 h-[230px] w-full overflow-hidden rounded-2xl bg-ink">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={AD_SLOT_ASPECT}
            objectFit="contain"
            showGrid
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleComplete}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-[11px] font-semibold text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom picture"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 accent-[#FF9F1C]"
          />
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setCrop({ x: 0, y: 0 })
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-[11px] font-medium text-alert">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => void confirm()}
            disabled={busy || !area}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Cropping…
              </>
            ) : (
              <>
                <Check size={15} />
                Use this part
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
