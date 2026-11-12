import { Clock3, MapPin, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Sheet from './Sheet'
import { CATEGORIES, categoryLabel } from '../types'
import type { Task } from '../types'
import { formatDateTime } from '../lib/format'

export default function ActivityReminderSheet({
  tasks,
  onClose,
}: {
  tasks: Task[]
  onClose: () => void
}) {
  if (tasks.length === 0) return null
  const count = tasks.length

  return (
    <Sheet open onClose={onClose} title={count === 1 ? 'Tomorrow, you have something to do' : `${count} things on tomorrow`}>
      <div className="px-1 pb-4 pt-1">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber">
          <Sparkles size={14} aria-hidden />
          Friendly reminder
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {count === 1 ? "Don't sleep on it — you promised to show up." : "You'd better charge your phone."}
        </p>

        <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">
          {tasks.map((task) => {
            const emoji = CATEGORIES.find((c) => c.value === task.category)?.emoji ?? '➕'
            return (
              <Link
                key={task.id}
                to={`/task/${task.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl border border-sun/30 bg-sun/10 p-3 transition active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sun/20 text-2xl" aria-hidden>
                  {emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{task.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    <Clock3 size={12} aria-hidden />
                    <span className="truncate">{formatDateTime(task.date_time)}</span>
                    <span aria-hidden>·</span>
                    <MapPin size={12} aria-hidden />
                    <span className="truncate">{task.area}</span>
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-amber">
                    {categoryLabel(task.category)}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>

        <button type="button" className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5" onClick={onClose}>
          <X size={16} aria-hidden />
          I&apos;ve got it — hide for now
        </button>
      </div>
    </Sheet>
  )
}
