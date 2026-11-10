import { useEffect, useState } from 'react'
import { History, X } from 'lucide-react'
import { clearDraftGroup, latestDraftTime } from '../lib/drafts'

function timeAgo(at: number) {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'a moment ago'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

/**
 * Small bar shown at the top of a form when unpublished work was recovered.
 * "Start over" clears the stored draft and resets the fields.
 */
export default function DraftNotice({
  group,
  what = 'draft',
  onDiscard,
}: {
  group: string
  what?: string
  onDiscard: () => void
}) {
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setSavedAt(latestDraftTime(group))
  }, [group])

  if (!savedAt) return null

  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#edd996] bg-[#fff4d1] p-3 text-[#7a622f]">
      <History size={15} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold">Your {what} was saved</p>
        <p className="text-[11px] leading-snug">
          Picked up where you left off — last edit {savedAt ? timeAgo(savedAt) : ''}.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          clearDraftGroup(group)
          setSavedAt(null)
          onDiscard()
        }}
        className="-mr-1 flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold underline"
      >
        <X size={11} />
        Start over
      </button>
    </div>
  )
}
