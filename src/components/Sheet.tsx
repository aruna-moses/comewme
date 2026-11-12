import { useEffect, useRef, useState } from 'react'
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'

const SNAP_THRESHOLD = 110 // px of downward drag before the sheet fires onClose

export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragState = useRef({ startY: 0, active: false })

  // Escape closes, body lock while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // Reset any leftover drag distance when reopened.
  useEffect(() => {
    if (open) {
      setDragY(0)
      setDragging(false)
      dragState.current.active = false
    }
  }, [open])

  if (!open) return null

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = { startY: event.clientY, active: true }
    setDragging(true)
    // capture so the gesture keeps firing even if the pointer leaves the handle
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return
    const offset = event.clientY - dragState.current.startY
    // downward freely, upward with resistance
    setDragY(offset >= 0 ? offset : offset * 0.25)
  }

  const endGesture = () => {
    if (!dragState.current.active) return
    const shouldClose = dragY >= SNAP_THRESHOLD
    dragState.current.active = false
    setDragging(false)
    if (shouldClose) {
      onClose()
    } else {
      setDragY(0) // snaps back
    }
  }

  const backdropOpacity = 1 - Math.min(0.7, dragY / 300)
  const fading = dragY > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150"
        style={{ opacity: backdropOpacity }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[480px] rounded-t-[24px] bg-white shadow-lift animate-[slideUp_.18s_ease-out]"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : fading ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : undefined,
        }}
      >
        {/* Grab zone — the entire handle row, so users can fling the sheet down without hitting buttons */}
        <div
          role="separator"
          aria-label="Drag down to dismiss"
          className="touch-none select-none pt-2"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
        >
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line transition-colors" aria-hidden />
          {title && <h2 className="px-5 pb-3 font-display text-lg font-bold">{title}</h2>}
        </div>
        <div className="max-h-[82dvh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(16px);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  )
}
