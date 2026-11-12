import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brush, Check, Crop, Eraser, Eye, Undo2, X } from 'lucide-react'

type Props = {
  file: File
  onCancel: () => void
  onSend: (file: File, caption: string, viewOnce: boolean) => void
}

type Point = { x: number; y: number }
type Stroke = { points: Point[]; color: string; size: number } // size in image px
type CropRect = { x: number; y: number; w: number; h: number } // image px
type AspectMode = 'free' | 'square' | 'portrait' | 'wide'
type Handle = 'tl' | 'tr' | 'bl' | 'br'
type Tool = 'none' | 'crop' | 'brush'

const PALETTE = ['#ffffff', '#111111', '#ffb703', '#48cae4', '#06d6a0', '#ef476f', '#8338ec', '#ffd166']
const BRUSH_SIZES = [4, 8, 14, 20, 28]
const MAX_BYTES = 700_000
const MAX_DIM = 1280
const MIN_CROP = 40
const HANDLE_HIT = 24

function ratioFor(aspect: AspectMode): number {
  if (aspect === 'square') return 1
  if (aspect === 'portrait') return 4 / 5
  if (aspect === 'wide') return 16 / 9
  return 0
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

export default function ChatPhotoEditor({ file, onCancel, onSend }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const strokeRef = useRef<Stroke | null>(null)
  const dragRef = useRef<{ kind: 'crop-move' | 'crop-resize'; start: Point; handle?: Handle; startCrop: CropRect } | null>(null)

  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<Tool>('none')
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 })
  const [aspect, setAspect] = useState<AspectMode>('free')
  const [color, setColor] = useState('#ffffff')
  const [strokeSize, setStrokeSize] = useState(BRUSH_SIZES[1])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [caption, setCaption] = useState('')
  const [viewOnce, setViewOnce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  /* ---------------------------------------------------------------- */
  /* Load + measure                                                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
      setCrop({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight })
      setReady(true)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setContainerSize({ w: rect.width, h: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale = useMemo(() => {
    if (!natural.w || !natural.h || !containerSize.w || !containerSize.h) return 1
    return Math.min(containerSize.w / natural.w, containerSize.h / natural.h)
  }, [natural, containerSize])

  const dispW = natural.w * scale
  const dispH = natural.h * scale
  const offsetX = (containerSize.w - dispW) / 2
  const offsetY = (containerSize.h - dispH) / 2

  const toDisp = useCallback(
    (p: Point) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale }),
    [offsetX, offsetY, scale],
  )
  const fromDisp = useCallback(
    (p: Point) => ({ x: (p.x - offsetX) / scale, y: (p.y - offsetY) / scale }),
    [offsetX, offsetY, scale],
  )

  /* ---------------------------------------------------------------- */
  /* Canvas rendering                                                  */
  /* ---------------------------------------------------------------- */

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !containerSize.w || !containerSize.h) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(containerSize.w * dpr)
    canvas.height = Math.round(containerSize.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerSize.w, containerSize.h)

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, offsetX, offsetY, dispW, dispH)

    // Brush strokes
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes) {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = Math.max(1, stroke.size * scale)
      ctx.beginPath()
      stroke.points.forEach((p, i) => {
        const d = toDisp(p)
        if (i === 0) ctx.moveTo(d.x, d.y)
        else ctx.lineTo(d.x, d.y)
      })
      ctx.stroke()
    }
    if (currentStroke) {
      ctx.strokeStyle = currentStroke.color
      ctx.lineWidth = Math.max(1, currentStroke.size * scale)
      ctx.beginPath()
      currentStroke.points.forEach((p, i) => {
        const d = toDisp(p)
        if (i === 0) ctx.moveTo(d.x, d.y)
        else ctx.lineTo(d.x, d.y)
      })
      ctx.stroke()
    }
    ctx.restore()

    // Crop overlay — only when the crop tool is on
    if (tool === 'crop' && crop.w > 0 && crop.h > 0) {
      const tl = toDisp({ x: crop.x, y: crop.y })
      const cW = crop.w * scale
      const cH = crop.h * scale
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, containerSize.w, Math.max(0, tl.y))
      ctx.fillRect(0, tl.y + cH, containerSize.w, Math.max(0, containerSize.h - (tl.y + cH)))
      ctx.fillRect(0, tl.y, Math.max(0, tl.x), cH)
      ctx.fillRect(tl.x + cW, tl.y, Math.max(0, containerSize.w - (tl.x + cW)), cH)

      // Rule-of-thirds guides
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 1; i <= 2; i += 1) {
        const gx = tl.x + (cW * i) / 3
        const gy = tl.y + (cH * i) / 3
        ctx.moveTo(gx, tl.y)
        ctx.lineTo(gx, tl.y + cH)
        ctx.moveTo(tl.x, gy)
        ctx.lineTo(tl.x + cW, gy)
      }
      ctx.stroke()

      // Border
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(tl.x, tl.y, cW, cH)

      // Corner handles
      const corners: Point[] = [
        { x: tl.x, y: tl.y },
        { x: tl.x + cW, y: tl.y },
        { x: tl.x, y: tl.y + cH },
        { x: tl.x + cW, y: tl.y + cH },
      ]
      for (const point of corners) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 11, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }
      ctx.restore()
    }

    void tick
  }, [
    containerSize, crop, currentStroke, dispH, dispW, offsetX, offsetY,
    scale, strokes, tool, tick, toDisp,
  ])

  useEffect(() => {
    drawScene()
  }, [drawScene])

  /* ---------------------------------------------------------------- */
  /* Pointer interaction                                               */
  /* ---------------------------------------------------------------- */

  function pointerPos(event: React.PointerEvent<HTMLDivElement>): Point {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!ready || !natural.w) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const disp = pointerPos(event)
    const imgPt = fromDisp(disp)

    if (tool === 'brush') {
      const stroke: Stroke = {
        points: [imgPt],
        color,
        size: strokeSize / scale,
      }
      strokeRef.current = stroke
      setCurrentStroke(stroke)
      return
    }

    if (tool === 'crop' && crop.w > 0 && crop.h > 0) {
      const corners: Array<{ handle: Handle; point: Point }> = [
        { handle: 'tl', point: toDisp({ x: crop.x, y: crop.y }) },
        { handle: 'tr', point: toDisp({ x: crop.x + crop.w, y: crop.y }) },
        { handle: 'bl', point: toDisp({ x: crop.x, y: crop.y + crop.h }) },
        { handle: 'br', point: toDisp({ x: crop.x + crop.w, y: crop.y + crop.h }) },
      ]
      for (const { handle, point } of corners) {
        if (Math.hypot(point.x - disp.x, point.y - disp.y) <= HANDLE_HIT) {
          dragRef.current = { kind: 'crop-resize', handle, start: disp, startCrop: { ...crop } }
          return
        }
      }
      const inside =
        imgPt.x >= crop.x && imgPt.x <= crop.x + crop.w &&
        imgPt.y >= crop.y && imgPt.y <= crop.y + crop.h
      if (inside) {
        dragRef.current = { kind: 'crop-move', start: disp, startCrop: { ...crop } }
        return
      }
      // Outside the frame: do nothing. No collapsing the crop.
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const disp = pointerPos(event)
    const imgPt = fromDisp(disp)

    if (tool === 'brush' && strokeRef.current) {
      const stroke = strokeRef.current
      stroke.points.push(imgPt)
      setCurrentStroke({ ...stroke, points: [...stroke.points] })
      return
    }

    const drag = dragRef.current
    if (!drag) return

    if (drag.kind === 'crop-move') {
      const dx = (disp.x - drag.start.x) / scale
      const dy = (disp.y - drag.start.y) / scale
      const x = clamp(drag.startCrop.x + dx, 0, Math.max(0, natural.w - drag.startCrop.w))
      const y = clamp(drag.startCrop.y + dy, 0, Math.max(0, natural.h - drag.startCrop.h))
      setCrop({ x, y, w: drag.startCrop.w, h: drag.startCrop.h })
      return
    }

    if (drag.kind === 'crop-resize' && drag.handle) {
      setCrop(resizeCrop(drag.startCrop, drag.handle, imgPt, aspect, natural))
    }
  }

  function onPointerUp() {
    if (strokeRef.current) {
      const stroke = strokeRef.current
      strokeRef.current = null
      if (stroke.points.length > 1) setStrokes((prev) => [...prev, stroke])
      setCurrentStroke(null)
    }
    dragRef.current = null
  }

  /* ---------------------------------------------------------------- */
  /* Crop presets                                                      */
  /* ---------------------------------------------------------------- */

  function applyAspect(next: AspectMode) {
    setAspect(next)
    if (!natural.w || !natural.h) return
    const ratio = ratioFor(next)
    if (!ratio) {
      setCrop({ x: 0, y: 0, w: natural.w, h: natural.h })
      return
    }
    let w = natural.w
    let h = w / ratio
    if (h > natural.h) {
      h = natural.h
      w = h * ratio
    }
    setCrop({
      x: Math.round((natural.w - w) / 2),
      y: Math.round((natural.h - h) / 2),
      w: Math.round(w),
      h: Math.round(h),
    })
  }

  function undoLast() {
    setStrokes((prev) => prev.slice(0, -1))
    setTick((n) => n + 1)
  }

  function clearAll() {
    setStrokes([])
    setCurrentStroke(null)
    setTick((n) => n + 1)
  }

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  function send() {
    const img = imageRef.current
    if (!img || !natural.w || busy) return
    const region: CropRect = crop.w >= MIN_CROP && crop.h >= MIN_CROP
      ? crop
      : { x: 0, y: 0, w: natural.w, h: natural.h }

    setBusy(true)
    // Export at chat resolution (max 1280px) instead of the camera's full
    // resolution: identical on a phone screen, 3–10x faster to upload.
    const exportScale = Math.min(1, MAX_DIM / Math.max(region.w, region.h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(region.w * exportScale))
    canvas.height = Math.max(1, Math.round(region.h * exportScale))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setBusy(false)
      return
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.scale(exportScale, exportScale)
    ctx.drawImage(img, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h)

    const offX = -region.x
    const offY = -region.y

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes) {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = Math.max(1, stroke.size)
      ctx.beginPath()
      stroke.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x + offX, p.y + offY)
        else ctx.lineTo(p.x + offX, p.y + offY)
      })
      ctx.stroke()
    }
    ctx.restore()

    const finish = (blob: Blob) => {
      onSend(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), caption.trim(), viewOnce)
      setBusy(false)
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setBusy(false)
          return
        }
        if (blob.size <= MAX_BYTES) {
          finish(blob)
          return
        }
        const factor = Math.sqrt(MAX_BYTES / blob.size)
        const smaller = document.createElement('canvas')
        smaller.width = Math.max(1, Math.round(canvas.width * factor))
        smaller.height = Math.max(1, Math.round(canvas.height * factor))
        const sctx = smaller.getContext('2d')
        if (!sctx) {
          finish(blob)
          return
        }
        sctx.imageSmoothingQuality = 'high'
        sctx.drawImage(canvas, 0, 0, smaller.width, smaller.height)
        smaller.toBlob(
          (smallBlob) => finish(smallBlob ?? blob),
          'image/jpeg',
          0.78,
        )
      },
      'image/jpeg',
      0.82,
    )
  }

  /* ---------------------------------------------------------------- */
  /* UI                                                                */
  /* ---------------------------------------------------------------- */

  const toolButton = (value: Tool, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      aria-pressed={tool === value}
      onClick={() => setTool((current) => (current === value ? 'none' : value))}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition ${
        tool === value ? 'bg-[#FF9F1C] text-[#0B0B0F]' : 'bg-white/10 text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {/* Top: cancel + title + undo/clear, then the tool row */}
      <div className="shrink-0 space-y-2 px-3 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2 text-white">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X size={19} />
          </button>
          <span className="font-display text-[15px] font-bold">Edit photo</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={undoLast}
              disabled={strokes.length === 0}
              aria-label="Undo"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={strokes.length === 0}
              aria-label="Clear drawing"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
            >
              <Eraser size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5">
          {toolButton('crop', <Crop size={16} />, 'Crop')}
          {toolButton('brush', <Brush size={16} />, 'Draw')}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 touch-none select-none overflow-hidden bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
        {tool === 'crop' && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/80">
            Drag corners to resize · drag inside to move
          </p>
        )}
        {!ready && (
          <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/60">Loading photo…</p>
        )}
      </div>

      {/* Bottom: tool options, caption, send */}
      <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#0B0B0F] px-3 pb-4 pt-3">
        {tool === 'crop' && (
          <div className="flex gap-1.5">
            {(['free', 'square', 'portrait', 'wide'] as AspectMode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => applyAspect(value)}
                className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition ${
                  aspect === value ? 'bg-white text-[#0B0B0F]' : 'bg-white/10 text-white'
                }`}
              >
                {value === 'free' ? 'Free' : value === 'square' ? '1:1' : value === 'portrait' ? '4:5' : '16:9'}
              </button>
            ))}
          </div>
        )}

        {tool === 'brush' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Colour ${swatch}`}
                  className={`h-7 w-7 rounded-full border-2 ${color === swatch ? 'border-[#FF9F1C]' : 'border-transparent'}`}
                  style={{ background: swatch }}
                />
              ))}
            </div>
            <input
              type="range"
              min={BRUSH_SIZES[0]}
              max={BRUSH_SIZES[BRUSH_SIZES.length - 1]}
              step={2}
              value={strokeSize}
              aria-label="Brush size"
              onChange={(event) => setStrokeSize(Number(event.target.value))}
              className="h-1 min-w-[90px] flex-1 accent-[#FF9F1C]"
            />
          </div>
        )}

        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Add a caption…"
          maxLength={500}
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-[13px] text-white outline-none placeholder-white/50"
        />

        <button
          type="button"
          onClick={() => setViewOnce((value) => !value)}
          aria-pressed={viewOnce}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
            viewOnce ? 'border-[#FF9F1C] bg-[#FF9F1C]/15' : 'border-white/15 bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Eye size={17} className="shrink-0 text-[#FF9F1C]" />
            <span>
              <span className="block text-[13px] font-semibold text-white">View once</span>
              <span className="block text-[11px] text-white/55">Opens once, then it&apos;s gone</span>
            </span>
          </span>
          <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${viewOnce ? 'bg-[#FF9F1C]' : 'bg-white/25'}`}>
            <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${viewOnce ? 'translate-x-5' : ''}`} />
          </span>
        </button>

        <button
          type="button"
          onClick={send}
          disabled={busy || !ready}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,#f7a233,#ee7b1e)] text-[15px] font-bold text-[#0B0B0F] disabled:opacity-50"
        >
          <Check size={18} />
          {busy ? 'Sending…' : 'Send photo'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Crop maths                                                          */
/* ------------------------------------------------------------------ */

function resizeCrop(start: CropRect, handle: Handle, imgPt: Point, aspect: AspectMode, natural: { w: number; h: number }): CropRect {
  const px = clamp(imgPt.x, 0, natural.w)
  const py = clamp(imgPt.y, 0, natural.h)

  let left = start.x
  let top = start.y
  let right = start.x + start.w
  let bottom = start.y + start.h

  if (handle === 'tl' || handle === 'bl') left = Math.min(px, right - MIN_CROP)
  if (handle === 'tr' || handle === 'br') right = Math.max(px, left + MIN_CROP)
  if (handle === 'tl' || handle === 'tr') top = Math.min(py, bottom - MIN_CROP)
  if (handle === 'bl' || handle === 'br') bottom = Math.max(py, top + MIN_CROP)

  let w = right - left
  let h = bottom - top

  const ratio = ratioFor(aspect)
  if (ratio > 0) {
    h = w / ratio
    if (handle === 'br') {
      if (top + h > natural.h) {
        h = natural.h - top
        w = h * ratio
      }
      right = left + w
      bottom = top + h
    } else if (handle === 'tl') {
      if (bottom - h < 0) {
        h = bottom
        w = h * ratio
      }
      left = right - w
      top = bottom - h
    } else if (handle === 'tr') {
      if (bottom - h < 0) {
        h = bottom
        w = h * ratio
      }
      left = right - w
      top = bottom - h
    } else {
      if (top + h > natural.h) {
        h = natural.h - top
        w = h * ratio
      }
      right = left + w
      bottom = top + h
    }
  }

  return {
    x: clamp(left, 0, Math.max(0, natural.w - MIN_CROP)),
    y: clamp(top, 0, Math.max(0, natural.h - MIN_CROP)),
    w: clamp(right - left, MIN_CROP, natural.w),
    h: clamp(bottom - top, MIN_CROP, natural.h),
  }
}
