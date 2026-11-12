import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Type, Brush, Crop, X, Eraser, Undo2 } from 'lucide-react'

type Props = {
  file: File
  onCancel: () => void
  onSend: (file: File) => void
}

type Point = { x: number; y: number }
type Stroke = { points: Point[]; color: string; size: number }
type Annotation = { id: string; x: number; y: number; text: string; color: string; size: number } // image-space px
type CropRect = { x: number; y: number; w: number; h: number } // image-space px
type AspectMode = 'free' | 'square' | 'portrait' | 'wide'
type Mode = 'crop' | 'text' | 'brush'

const PALETTE = ['#ffffff', '#111111', '#ffb703', '#48cae4', '#06d6a0', '#ef476f', '#8338ec', '#ffd166']
const TEXT_SIZES = [16, 22, 32, 44, 56, 72]
const BRUSH_SIZES = [4, 6, 10, 14, 20, 28]
const MAX_BYTES = 1_500_000 // 1.5MB cap after JPEG export

export default function ChatPhotoEditor({ file, onCancel, onSend }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [aspect, setAspect] = useState<AspectMode>('free')
  const [mode, setMode] = useState<Mode>('crop')
  const [color, setColor] = useState('#ffffff')
  const [strokeSize, setStrokeSize] = useState(BRUSH_SIZES[2])
  const [textSize, setTextSize] = useState(TEXT_SIZES[2])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [textInput, setTextInput] = useState('')
  const [textEditPos, setTextEditPos] = useState<Point | null>(null) // image-space
  const [busy, setBusy] = useState(false)
  const [historyTick, setHistoryTick] = useState(0)

  const dragRef = useRef<{ kind: 'pan' | 'text-drag' | 'create-stroke' | 'crop-move' | 'crop-resize'; start: Point; data?: unknown } | null>(null)

  // Load image file
  useEffect(() => {
    let active = true
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (!active) return
      imageRef.current = img
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
      // Default crop = full image
      const initialAspect: AspectMode = 'free'
      const pad = Math.floor(Math.pow(img.naturalWidth * img.naturalHeight, 0.5) * 0.03)
      setCrop({ x: pad, y: pad, w: img.naturalWidth - pad * 2, h: img.naturalHeight - pad * 2 })
      setAspect(initialAspect)
    }
    img.src = url
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [file])

  // Compute canvas size on resize
  const [containerSize, setContainerSize] = useState({ w: 420, h: 420 })
  useEffect(() => {
    function measure() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setContainerSize({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const fitScale = useMemo(() => {
    if (!natural.w || !natural.h) return 1
    return Math.min(containerSize.w / natural.w, containerSize.h / natural.h)
  }, [containerSize, natural])

  const scale = fitScale * zoom
  const dispW = natural.w * scale
  const dispH = natural.h * scale

  // image-space → display-space
  const toDisp = useCallback(
    (p: Point) => ({ x: (p.x - natural.w / 2) * scale + containerSize.w / 2 + pan.x, y: (p.y - natural.h / 2) * scale + containerSize.h / 2 + pan.y }),
    [containerSize.w, containerSize.h, natural.w, natural.h, scale, pan],
  )
  const fromDisp = useCallback(
    (p: Point) => ({ x: (p.x - containerSize.w / 2 - pan.x) / scale + natural.w / 2, y: (p.y - containerSize.h / 2 - pan.y) / scale + natural.h / 2 }),
    [containerSize.w, containerSize.h, natural.w, natural.h, scale, pan],
  )

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = containerSize.w * dpr
    canvas.height = containerSize.h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, containerSize.w, containerSize.h)

    // Image
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      imageRef.current,
      (containerSize.w - dispW) / 2 + pan.x,
      (containerSize.h - dispH) / 2 + pan.y,
      dispW,
      dispH,
    )

    // Dim outside crop rect
    if (crop) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.48)'
      // Top band
      const cTop = crop.y * scale + (containerSize.h - dispH) / 2 + pan.y
      const cH = crop.h * scale
      const cLeft = crop.x * scale + (containerSize.w - dispW) / 2 + pan.x
      const cW = crop.w * scale
      ctx.fillRect(0, 0, containerSize.w, Math.max(0, cTop))
      ctx.fillRect(0, Math.min(containerSize.h, cTop + cH), containerSize.w, containerSize.h)
      ctx.fillRect(0, Math.max(0, cTop), Math.max(0, cLeft), cH)
      ctx.fillRect(Math.min(containerSize.w, cLeft + cW), Math.max(0, cTop), containerSize.w, cH)
      ctx.restore()

      // Crop border
      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.strokeRect(cLeft, cTop, cW, cH)
      ctx.restore()

      // Corner handles
      const handles: Point[] = [
        { x: cLeft, y: cTop },
        { x: cLeft + cW, y: cTop },
        { x: cLeft, y: cTop + cH },
        { x: cLeft + cW, y: cTop + cH },
      ]
      ctx.save()
      ctx.fillStyle = '#ffffff'
      for (const h of handles) {
        const r = 7
        ctx.beginPath()
        ctx.arc(h.x, h.y, r + 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }
      ctx.restore()
    }

    // Brush strokes
    ctx.save()
    for (const s of strokes) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < s.points.length; i += 1) {
        const p = s.points[i]
        const disp = toDisp(p)
        if (i === 0) ctx.moveTo(disp.x, disp.y)
        else ctx.lineTo(disp.x, disp.y)
      }
      ctx.stroke()
    }
    if (currentStroke) {
      ctx.strokeStyle = currentStroke.color
      ctx.lineWidth = currentStroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < currentStroke.points.length; i += 1) {
        const p = currentStroke.points[i]
        const disp = toDisp(p)
        if (i === 0) ctx.moveTo(disp.x, disp.y)
        else ctx.lineTo(disp.x, disp.y)
      }
      ctx.stroke()
    }
    ctx.restore()

    // Annotations
    ctx.save()
    for (const a of annotations) {
      const disp = toDisp(a)
      ctx.fillStyle = a.color
      ctx.font = `bold ${a.size}px "Plus Jakarta Sans", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Outline for readability on busy photos
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'
      ctx.strokeText(a.text, disp.x, disp.y)
      ctx.fillText(a.text, disp.x, disp.y)
    }
    // Live text position with caret while typing
    if (mode === 'text' && textEditPos) {
      const disp = toDisp(textEditPos)
      if (textInput) {
        ctx.fillStyle = color
        ctx.font = `bold ${textSize}px "Plus Jakarta Sans", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.strokeText(textInput, disp.x, disp.y)
        ctx.fillText(textInput, disp.x, disp.y)
      }

      // Crosshair guiding the position
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(disp.x - 10, disp.y)
      ctx.lineTo(disp.x + 10, disp.y)
      ctx.moveTo(disp.x, disp.y - 10)
      ctx.lineTo(disp.x, disp.y + 10)
      ctx.stroke()
    }
    ctx.restore()
    // Suppress unused-history errors
    void historyTick
  }, [containerSize, dispW, dispH, natural, scale, pan, crop, strokes, currentStroke, annotations, mode, color, textSize, textInput, textEditPos, toDisp, historyTick])

  useEffect(() => {
    drawScene()
  }, [drawScene])

  function updateAspect(next: AspectMode) {
    setAspect(next)
    if (!natural.w || !natural.h) return
    let newW = natural.w
    let newH = natural.h
    if (next === 'square') {
      const s = Math.min(natural.w, natural.h)
      newW = s; newH = s
    } else if (next === 'portrait') {
      newH = Math.min(natural.h, natural.w * 1.25)
      newW = newH * 0.8
    } else if (next === 'wide') {
      newW = Math.min(natural.w, natural.h * 1.777)
      newH = newW / 1.777
    } else {
      newW = natural.w; newH = natural.h
    }
    newW = Math.round(newW); newH = Math.round(newH)
    setCrop({
      x: Math.round((natural.w - newW) / 2),
      y: Math.round((natural.h - newH) / 2),
      w: newW,
      h: newH,
    })
  }

  function pointerPos(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const disp = pointerPos(e)
    const imgPt = fromDisp(disp)

    if (mode === 'brush') {
      setCurrentStroke({ points: [imgPt], color, size: strokeSize })
      dragRef.current = { kind: 'create-stroke', start: disp }
      return
    }

    if (mode === 'text') {
      setTextEditPos({ x: Math.min(Math.max(0, imgPt.x), natural.w), y: Math.min(Math.max(0, imgPt.y), natural.h) })
      dragRef.current = { kind: 'pan', start: disp, data: pan }
      return
    }

    // Crop mode: check if on a corner handle first
    if (crop) {
      const ptDisp = toDisp({ x: crop.x, y: crop.y })
      const tr = toDisp({ x: crop.x + crop.w, y: crop.y })
      const bl = toDisp({ x: crop.x, y: crop.y + crop.h })
      const br = toDisp({ x: crop.x + crop.w, y: crop.y + crop.h })
      const handleHits: Array<{ handle: 'tl' | 'tr' | 'bl' | 'br'; point: Point }> = [
        { handle: 'tl', point: ptDisp },
        { handle: 'tr', point: tr },
        { handle: 'bl', point: bl },
        { handle: 'br', point: br },
      ]
      for (const { handle, point } of handleHits) {
        if (Math.hypot(point.x - disp.x, point.y - disp.y) <= 14) {
          dragRef.current = { kind: 'crop-resize', start: disp, data: { handle, startCrop: { ...crop } } }
          return
        }
      }
      // Otherwise check inside an area
      const inCrop = imgPt.x >= crop.x && imgPt.x <= crop.x + crop.w && imgPt.y >= crop.y && imgPt.y <= crop.y + crop.h
      if (inCrop) {
        dragRef.current = { kind: 'crop-move', start: disp, data: { startCrop: { ...crop } } }
        return
      }
      // Otherwise create a fresh crop region
      setCrop({ x: imgPt.x, y: imgPt.y, w: 10, h: 10 })
      dragRef.current = { kind: 'crop-resize', start: disp, data: { handle: 'br', startCrop: { x: imgPt.x, y: imgPt.y, w: 10, h: 10 } } }
      return
    }

    dragRef.current = { kind: 'pan', start: disp, data: pan }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const disp = pointerPos(e)
    const imgPt = fromDisp(disp)
    const drag = dragRef.current

    if (drag.kind === 'pan') {
      const p = drag.data as Point
      setPan({ x: p.x + (disp.x - drag.start.x), y: p.y + (disp.y - drag.start.y) })
      return
    }

    if (drag.kind === 'create-stroke' && currentStroke) {
      setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, imgPt] })
      return
    }

    if (drag.kind === 'crop-move' && crop) {
      const data = drag.data as { startCrop: CropRect }
      const dx = (disp.x - drag.start.x) / scale
      const dy = (disp.y - drag.start.y) / scale
      const x = Math.min(Math.max(0, data.startCrop.x + dx), natural.w - data.startCrop.w)
      const y = Math.min(Math.max(0, data.startCrop.y + dy), natural.h - data.startCrop.h)
      setCrop({ x, y, w: data.startCrop.w, h: data.startCrop.h })
      return
    }

    if (drag.kind === 'crop-resize' && crop) {
      const data = drag.data as { handle: 'tl' | 'tr' | 'bl' | 'br'; startCrop: CropRect }
      const s = data.startCrop
      const nx = imgPt.x, ny = imgPt.y
      let { x, y, w, h } = s
      switch (data.handle) {
        case 'tl':
          x = Math.min(nx, s.x + s.w - 4)
          y = Math.min(ny, s.y + s.h - 4)
          w = s.x + s.w - x
          h = s.y + s.h - y
          break
        case 'tr':
          y = Math.min(ny, s.y + s.h - 4)
          w = Math.max(4, nx - s.x)
          h = s.y + s.h - y
          x = s.x
          break
        case 'bl':
          x = Math.min(nx, s.x + s.w - 4)
          w = s.x + s.w - x
          h = Math.max(4, ny - s.y)
          y = s.y
          break
        case 'br':
          w = Math.max(4, nx - s.x)
          h = Math.max(4, ny - s.y)
          break
      }
      // enforce aspect
      if (aspect !== 'free') {
        const ar = aspect === 'square' ? 1 : aspect === 'portrait' ? 0.8 : 16 / 9
        const target = w
        const h2 = target / ar
        if (data.handle === 'bl' || data.handle === 'tl') {
          x = s.x + s.w - target
          w = target
          h = h2
          if (data.handle === 'tl') y = s.y + s.h - h2
          else y = s.y
        } else {
          w = target
          h = h2
          if (data.handle === 'tr') y = s.y + s.h - h2
          else y = s.y
        }
      }
      setCrop({ x: Math.max(0, x), y: Math.max(0, y), w: Math.min(w, natural.w), h: Math.min(h, natural.h) })
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.kind === 'create-stroke' && currentStroke && currentStroke.points.length > 1) {
      setStrokes((s) => [...s, currentStroke])
      setCurrentStroke(null)
    } else if (currentStroke) {
      setCurrentStroke(null)
    }
    dragRef.current = null
    setHistoryTick((n) => n + 1)
  }

  function addAnnotation() {
    if (!textInput.trim() || !textEditPos) return
    setAnnotations((a) => [...a, { id: crypto.randomUUID(), x: textEditPos.x, y: textEditPos.y, text: textInput.trim(), color, size: textSize }])
    setTextInput('')
    setHistoryTick((n) => n + 1)
  }

  function commitSend() {
    if (!imageRef.current || !natural.w || !crop) return
    setBusy(true)
    const canvas = document.createElement('canvas')
    canvas.width = crop.w
    canvas.height = crop.h
    const ctx = canvas.getContext('2d')
    if (!ctx) { setBusy(false); return }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(imageRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
    // Strokes & annotations in image coords — translate into crop coords
    const offX = -crop.x, offY = -crop.y
    for (const s of strokes) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < s.points.length; i += 1) {
        const p = s.points[i]
        if (i === 0) ctx.moveTo(p.x + offX, p.y + offY)
        else ctx.lineTo(p.x + offX, p.y + offY)
      }
      ctx.stroke()
    }
    for (const a of annotations) {
      ctx.fillStyle = a.color
      ctx.font = `bold ${a.size}px "Plus Jakarta Sans", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.strokeText(a.text, a.x + offX, a.y + offY)
      ctx.fillText(a.text, a.x + offX, a.y + offY)
    }

    canvas.toBlob((blob) => {
      if (!blob) { setBusy(false); return }
      // Re-encode with size cap: if too big, downscale
      if (blob.size > MAX_BYTES) {
        const minDim = 1600
        const scale = Math.sqrt(MAX_BYTES / blob.size)
        const target = document.createElement('canvas')
        target.width = Math.max(1, Math.round(canvas.width * scale))
        target.height = Math.max(1, Math.round(canvas.height * scale))
        const tctx = target.getContext('2d')
        tctx!.drawImage(canvas, 0, 0, target.width, target.height)
        target.toBlob((smallBlob) => {
          if (!smallBlob) { setBusy(false); return }
          const f = new File([smallBlob], 'photo.jpg', { type: 'image/jpeg' })
          onSend(f)
          setBusy(false)
        }, 'image/jpeg', 0.82)
        return
      }
      onSend(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      setBusy(false)
    }, 'image/jpeg', 0.88)
  }

  function undoLast() {
    if (strokes.length) setStrokes(strokes.slice(0, -1))
    else if (annotations.length) setAnnotations(annotations.slice(0, -1))
    setHistoryTick((n) => n + 1)
  }

  function clearAll() {
    setStrokes([])
    setAnnotations([])
    setCurrentStroke(null)
    setHistoryTick((n) => n + 1)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-3 text-white">
        <button type="button" className="rounded-full bg-white/10 p-2 text-white" onClick={onCancel} aria-label="Cancel">
          <X size={19} />
        </button>
        <span className="font-display text-[15px] font-bold">Edit photo</span>
        <button type="button" className="rounded-full bg-amber p-2 text-ink disabled:opacity-60" onClick={commitSend} disabled={busy || !crop} aria-label="Send">
          <Check size={19} />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
        {mode === 'text' && (
          <input
            autoFocus
            placeholder="Add text…"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAnnotation()
              }
            }}
            className="absolute bottom-2 left-3 right-3 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-white outline-none placeholder-white/50"
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="space-y-2 border-t border-white/10 bg-[#111] px-3 pb-4 pt-2 text-white">
        {/* Mode switcher + undo/clear */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            <button type="button" aria-pressed={mode === 'crop'} onClick={() => setMode('crop')} className={`flex h-10 w-10 items-center justify-center rounded-xl ${mode === 'crop' ? 'bg-amber text-ink' : 'bg-white/10 text-white'}`} aria-label="Crop"><Crop size={19}/></button>
            <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')} className={`flex h-10 w-10 items-center justify-center rounded-xl ${mode === 'text' ? 'bg-amber text-ink' : 'bg-white/10 text-white'}`} aria-label="Text"><Type size={19}/></button>
            <button type="button" aria-pressed={mode === 'brush'} onClick={() => setMode('brush')} className={`flex h-10 w-10 items-center justify-center rounded-xl ${mode === 'brush' ? 'bg-amber text-ink' : 'bg-white/10 text-white'}`} aria-label="Brush"><Brush size={19}/></button>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={undoLast} disabled={strokes.length === 0 && annotations.length === 0} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30" aria-label="Undo"><Undo2 size={19}/></button>
            <button type="button" onClick={clearAll} disabled={strokes.length === 0 && annotations.length === 0} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30" aria-label="Clear all"><Eraser size={19}/></button>
          </div>
        </div>

        {/* Aspect / size / color per mode */}
        {mode === 'crop' && (
          <div className="flex gap-1.5">
            {(['free', 'square', 'portrait', 'wide'] as AspectMode[]).map((a) => (
              <button key={a} type="button" onClick={() => updateAspect(a)} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${aspect === a ? 'bg-white text-ink' : 'bg-white/10 text-white'}`}>
                {a === 'free' ? 'Free' : a === 'square' ? '1:1' : a === 'portrait' ? '4:5' : '16:9'}
              </button>
            ))}
          </div>
        )}

        {mode === 'brush' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-amber' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
            <input type="range" min={4} max={28} step={2} value={strokeSize} aria-label="Brush size" onChange={(e) => setStrokeSize(Number(e.target.value))} className="h-1 flex-1 accent-[#FF9F1C]" />
          </div>
        )}

        {mode === 'text' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-amber' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-1">
              {TEXT_SIZES.map((s) => (
                <button key={s} type="button" onClick={() => setTextSize(s)} className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${textSize === s ? 'bg-white text-ink' : 'bg-white/10 text-white'}`}>{s}</button>
              ))}
            </div>
            <button type="button" onClick={addAnnotation} disabled={!textInput.trim()} className="ml-auto rounded-lg bg-amber px-3 py-1.5 text-[12px] font-bold text-ink disabled:opacity-40">Add text</button>
          </div>
        )}

        {/* Zoom slider for crop */}
        {mode === 'crop' && (
          <label className="flex items-center gap-3">
            <span className="text-[11px] text-white/60">Zoom</span>
            <input type="range" min={1} max={3} step={0.02} value={zoom} aria-label="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="h-1 flex-1 accent-[#FF9F1C]" />
          </label>
        )}
      </div>
    </div>
  )
}
