import { Link } from 'react-router-dom'
import type { Task } from '../types'
import { categoryLabel, CATEGORIES } from '../types'
import { relativeDay, timeOfDay } from '../lib/format'
import Avatar from './Avatar'

function liveSponsor(t: Task) {
  if (!t.is_sponsored) return false
  if (!t.sponsored_until) return true
  return new Date(t.sponsored_until) >= new Date(new Date().toDateString())
}

function categoryEmoji(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.emoji ?? '➕'
}

export default function TaskCard({ task }: { task: Task }) {
  const sponsored = liveSponsor(task)
  const pct = Math.min(100, Math.round((task.spots_filled / task.spots_needed) * 100))
  const isFull = task.status === 'full' || task.spots_filled >= task.spots_needed

  return (
    <Link
      to={`/app/task/${task.id}`}
      className="card block p-4 transition hover:shadow-lift active:scale-[0.995]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="pill bg-sun/25 text-ink">{categoryEmoji(task.category)} {categoryLabel(task.category)}</span>
        {sponsored && (
          <span className="pill" style={{ background: '#FEF3C7', color: '#92400E' }}>
            {task.sponsor_name ? `Sponsored · ${task.sponsor_name}` : 'Sponsored'}
          </span>
        )}
      </div>

      <h3 className="font-display text-[17px] font-bold leading-snug text-ink line-clamp-2">
        {task.title}
      </h3>

      <p className="mt-1.5 text-[13px] text-muted">
        {task.area} · {relativeDay(task.date_time)}, {timeOfDay(task.date_time)}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar src={task.host_avatar_url} name={task.host_name} size={28} />
          <span className="truncate text-[13px] font-semibold text-ink">{task.host_name}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-[12px] font-semibold ${isFull ? 'text-muted' : 'text-ink'}`}>
            {isFull ? 'Full' : `${task.spots_filled} of ${task.spots_needed}`}
          </span>
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)',
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
