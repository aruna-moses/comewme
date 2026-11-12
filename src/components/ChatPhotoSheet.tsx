import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Check, RotateCw, Loader2, X } from 'lucide-react'
import { compressImage } from '../lib/images'

type Props = {
  file: File
  onCancel: () => void
  onSend: (file: File) => void
}

/** Image picker sheet — preview, crop, compress, then hand off for send. */
export default function ChatPhotoSheet({ file, onCancel, onSend }: Props) {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [rotation, setRotation] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const url = URL.createObjectURL(file)
    if (active) setImageUrl(url)
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [file])

  const handleComplete = useCallback((_area: Area, pixel: Area) => setPixels(pixel), [])

  const finalEstimate = useMemo(() => {
    // Rough estimate — don't compute yet, just show file size before.
    return file.size
  }, [file])

  async function stageAndSend() {
    setBusy(true)
    try {
      let cropped: File = file
      if (pixels) {
        cropped = await readFileAsFile(imageUrl, pixels, rotation)
      }
      const compressed = await compressImage(cropped)
      const finalFile = new File([compressed.blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onSend(finalFile)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/85 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 text-white">
        <p className="font-display text-[15px] font-bold">Send photo</p>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-full bg-white/15 p-2 text-white">
          <X size={18} />
        </button>
      </div>

      {/* Cropper */}
      <div className="relative mx-auto mt-4 w-full max-w-[420px] flex-1 overflow-hidden rounded-2xl bg-black">
        {imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={4 / 5}
            objectFit="contain"
            showGrid
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleComplete}
          />
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 space-y-3 rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {(finalEstimate / 1_000_000).toFixed(1)} MB original
          </span>
          <button
            type="button"
            aria-label="Rotate"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="rounded-full bg-canvas p-2 text-ink transition active:scale-95"
          >
            <RotateCw size={16} />
          </button>
        </div>
        <label className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 flex-1 accent-[#FF9F1C]"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => void stageAndSend()}>
            {busy ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Check size={15} /> Send photo</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Crop canvas export, returns the cropped region as a JPEG File ready to upload. */
async function readFileAsFile(imageUrl: string, pixels: Area, rotation: number): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = imageUrl
  })
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1600 / Math.max(pixels.width, pixels.height))
  canvas.width = Math.max(1, Math.round(pixels.width * scale))
  canvas.height = Math.max(1, Math.round(pixels.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Your browser can't process this image.")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(
    img,
    pixels.x, pixels.y, pixels.width, pixels.height,
    -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height,
  )
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84))
  if (!blob) throw new Error('Could not process this image.')
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
