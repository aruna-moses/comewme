import { useEffect } from 'react'
import { X } from 'lucide-react'

type Props = {
  url: string
  caption?: string
  senderName?: string
  onClose: () => void
}

/** In-app full-screen photo viewer, so tapping a chat photo never leaves the app. */
export default function PhotoLightbox({ url, caption, senderName, onClose }: Props) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[75] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-3 text-white">
        <p className="truncate text-[13px] font-semibold text-white/80">{senderName ?? 'Photo'}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={19} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <img
          src={url}
          alt={caption || 'Photo shared in the group chat'}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full select-none rounded-xl object-contain"
        />
      </div>

      <div className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 text-center">
        {caption && (
          <p className="mx-auto max-w-[440px] whitespace-pre-wrap text-[13px] leading-snug text-white/90">{caption}</p>
        )}
        <p className="mt-2 text-[11px] text-white/40">Tap outside the photo to close</p>
      </div>
    </div>
  )
}
