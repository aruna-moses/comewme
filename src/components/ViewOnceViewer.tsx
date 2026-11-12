import { useEffect } from 'react'
import { Eye, X } from 'lucide-react'

type Props = {
  url: string
  caption: string
  viewerName: string
  onClose: () => void
}

/**
 * Full-screen single-view photo.
 *
 * Screenshots: browsers cannot block OS screenshots — there is no web API for
 * that. This viewer does everything a web app can: it closes the moment the
 * page loses focus (app switch / screenshot overlay), blocks right-click and
 * long-press saving, and stamps the viewer's name across the photo so any
 * leaked capture is traceable.
 */
export default function ViewOnceViewer({ url, caption, viewerName, onClose }: Props) {
  useEffect(() => {
    // Leaving the app (including opening most screenshot tools) closes it.
    const handleBlur = () => onClose()
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') onClose()
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'PrintScreen') onClose()
    }
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black select-none"
      role="dialog"
      aria-modal="true"
      aria-label="View once photo"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-3 text-white">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          <Eye size={14} aria-hidden /> View once
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close view-once photo"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={19} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        <img
          src={url}
          alt="View once photo"
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          className="max-h-full max-w-full select-none rounded-xl object-contain [-webkit-touch-callout:none]"
        />

        {/* Traceable watermark — a screenshot still carries who opened it. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center gap-16 overflow-hidden">
          {[0, 1, 2, 3, 4].map((row) => (
            <p
              key={row}
              className="-rotate-[22deg] whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.28em] text-white/[0.14]"
            >
              Come w&apos; me · {viewerName} · view once
            </p>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 text-center">
        {caption && <p className="mx-auto max-w-[420px] whitespace-pre-wrap text-[13px] leading-snug text-white/90">{caption}</p>}
        <p className="mt-2 text-[11px] text-white/45">This photo closes for good when you leave.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-xl bg-white/10 text-[14px] font-semibold text-white"
        >
          Close
        </button>
      </div>
    </div>
  )
}
