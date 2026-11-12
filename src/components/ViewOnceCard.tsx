import { Eye, EyeOff } from 'lucide-react'

type Props = {
  mine: boolean
  viewed: boolean
  viewCount: number
  pending: boolean
  onOpen: () => void
}

/** Compact card shown in place of a view-once photo. */
export default function ViewOnceCard({ mine, viewed, viewCount, pending, onOpen }: Props) {
  const disabled = mine || viewed || pending

  let title = 'View once photo'
  let subtitle = 'Tap to open · it can only be viewed once'
  if (pending) {
    subtitle = 'Sending…'
  } else if (mine) {
    subtitle = viewCount > 0 ? `Opened by ${viewCount} ${viewCount === 1 ? 'person' : 'people'}` : 'Not opened yet'
  } else if (viewed) {
    title = 'Opened'
    subtitle = 'This photo can no longer be viewed'
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className={`flex w-[236px] max-w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
        viewed ? 'border-line bg-canvas' : 'border-amber/40 bg-sun/20'
      } ${disabled ? 'cursor-default' : 'active:scale-[0.98]'}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${viewed ? 'bg-ink/10 text-muted' : 'bg-ink/10 text-ink'}`}>
        {viewed ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{subtitle}</span>
      </span>
    </button>
  )
}
