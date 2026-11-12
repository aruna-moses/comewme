import { Eye, X } from 'lucide-react'

type Props = {
  url: string
  caption: string
  onClose: () => void
}

/**
 * Full-screen single-view photo.
 *
 * Note on screenshots: browsers cannot block OS screenshots. This viewer only
 * removes the easy escapes (no context menu, no long-press save, no drag-out),
 * and the photo is removed from the chat once you leave.
 */
export default function ViewOnceViewer({ url, caption, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="View once photo"
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

      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <img
          src={url}
          alt="View once photo"
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          className="max-h-full max-w-full select-none rounded-xl object-contain [-webkit-touch-callout:none]"
        />
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
