import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Not now',
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-[360px] overflow-hidden rounded-[26px] bg-white shadow-lift"
      >
        <div className={`px-6 pb-5 pt-6 text-center ${destructive ? 'bg-alert/10' : 'bg-sun/20'}`}>
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${destructive ? 'bg-alert/10 text-alert' : 'bg-sun/20 text-amber'}`}>
            <Sparkles size={25} aria-hidden />
          </span>
          <h2 id="confirm-dialog-title" className="mt-3 font-display text-[20px] font-bold">{title}</h2>
          <p id="confirm-dialog-message" className="mt-1.5 text-[13px] leading-relaxed text-muted">{message}</p>
        </div>
        {children && <div className="px-5 pt-4">{children}</div>}
        <div className="grid grid-cols-2 gap-2 p-5 pt-4">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost btn-sm w-full"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${destructive ? 'rounded-full bg-alert px-4 font-semibold text-white hover:brightness-105' : 'btn-primary'} min-h-[38px] w-full`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'One moment…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
