import { useState } from 'react'
import { ChevronDown, Clock3, MapPin, UsersRound } from 'lucide-react'
import { VerifiedBadge } from './Badges'
import { Link } from 'react-router-dom'
import type { Category, JoinStatus, Task } from '../types'
import { categoryLabel, CATEGORIES } from '../types'
import { formatDateTime } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import ShareTaskButton from './ShareTaskButton'

// Palette slots — all hex values are covered by the dark-theme overrides so tiles
// keep their quiet tints on dark surfaces.
const tileSlots = [
  'bg-[#e4f4ef]',
  'bg-[#e8eef7]',
  'bg-[#ffebdc]',
  'bg-[#f1ecfa]',
  'bg-[#fdeef3]',
  'bg-[#f0efee]',
  'bg-[#eaf6ee]',
  'bg-[#eef4fb]',
  'bg-[#fff3e8]',
  'bg-[#f5f0f8]',
  'bg-[#fcf0f5]',
  'bg-[#f7f6f1]',
  'bg-[#f1f1ef]',
  'bg-[#fff4d1]',
  'bg-[#f1ecfa]',
  'bg-[#fdeef3]',
]

const chipSlots = [
  'bg-[#eef7f5] text-[#16827d]',
  'bg-[#eef4fb] text-[#4273a8]',
  'bg-[#fff3e8] text-[#cc7625]',
  'bg-[#f5f0f8] text-[#8054a6]',
  'bg-[#fcf0f5] text-[#d35d88]',
  'bg-[#f1f1ef] text-[#6b7280]',
]

const tileStyles = {} as Record<Category, string>
const categoryStyles = {} as Record<Category, string>
CATEGORIES.forEach((category, index) => {
  tileStyles[category.value] = tileSlots[index % tileSlots.length]
  categoryStyles[category.value] = chipSlots[index % chipSlots.length]
})

function liveSponsor(t: Task) {
  if (!t.is_sponsored) return false
  if (!t.sponsored_until) return true
  return new Date(t.sponsored_until) >= new Date(new Date().toDateString())
}

function categoryEmoji(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.emoji ?? '➕'
}

function countdownLabel(iso: string): string | null {
  const target = new Date(iso)
  const now = new Date()
  if (target.getTime() < now.getTime()) return null

  const lagosOffsetMs = 60 * 60_000
  const lagosToday = new Date(now.getTime() + lagosOffsetMs)
  const lagosTarget = new Date(target.getTime() + lagosOffsetMs)
  const startOfDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const daysUntil = Math.round((startOfDay(lagosTarget) - startOfDay(lagosToday)) / 86_400_000)
  if (daysUntil < 0) return null
  if (daysUntil > 3) return null
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}

function statusLabel(t: Task): { label: string; tone: string } {
  const isFull = t.status === 'full' || t.spots_filled >= t.spots_needed
  if (isFull || t.status === 'cancelled') {
    return { label: isFull ? 'Full' : 'Cancelled', tone: 'text-muted' }
  }
  return { label: 'Open', tone: 'text-verified' }
}

interface Props {
  /** True when the host has completed selfie verification. */
  verified?: boolean
}

export default function TaskCard({
  task,
  verified,
  applicationStatus,
  reviewBadge,
}: {
  task: Task
  applicationStatus?: JoinStatus
  reviewBadge?: number
} & Props) {
  const { profile } = useAuth()
  const isOwnTask = Boolean(profile && profile.id === task.host_id)
  const [expanded, setExpanded] = useState(false)
  const sponsored = liveSponsor(task)
  const pct = Math.min(100, Math.round((task.spots_filled / task.spots_needed) * 100))
  const status = statusLabel(task)
  const countdown = countdownLabel(task.date_time)
  const emoji = categoryEmoji(task.category)

  return (
    <article className="card relative rounded-[22px] p-3 transition hover:shadow-lift">
      {typeof reviewBadge === 'number' && reviewBadge > 0 && (
        <span
          aria-label={`${reviewBadge} pending join ${reviewBadge === 1 ? 'request' : 'requests'} waiting for review`}
          className="absolute -right-2 -top-2 z-[2] flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-canvas bg-[#e53935] px-1.5 text-[11px] font-bold leading-none text-white shadow-sm"
        >
          {reviewBadge > 99 ? '99+' : reviewBadge}
        </span>
      )}
      <Link to={`/task/${task.id}`} className="block rounded-[18px] active:scale-[0.995]" aria-label={task.title}>
        <div className="flex items-start gap-3">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] text-[30px] ${tileStyles[task.category]}`}>
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink">
                {task.title}
              </h3>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
                {sponsored && (
                  <span className="rounded-full bg-[#fff4d1] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#7a622f]">
                    Sponsored
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <Avatar src={task.host_avatar_url} name={task.host_name} size={18} />
              <span className="truncate max-w-[45%]">{isOwnTask ? 'You' : task.host_name}</span>
              {verified && (
                <VerifiedBadge status="verified" size={13} />
              )}
              <span className="shrink-0 text-[10px] text-line">|</span>
              <span className={`pill shrink-0 ${categoryStyles[task.category]}`}>{categoryLabel(task.category)}</span>
            </p>
          </div>
        </div>

        {applicationStatus && applicationStatus !== 'withdrawn' && (
          <p
            className={`mt-2 w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              applicationStatus === 'accepted'
                ? 'bg-verified/10 text-verified'
                : applicationStatus === 'pending'
                  ? 'bg-amber/10 text-amber'
                  : applicationStatus === 'waitlisted'
                    ? 'bg-[#eef4fb] text-[#4273a8]'
                    : 'bg-line text-muted'
            }`}
          >
            {applicationStatus === 'accepted'
              ? "You're in"
              : applicationStatus === 'pending'
                ? 'Request pending'
                : applicationStatus === 'waitlisted'
                  ? 'Waitlisted'
                  : 'Not selected'}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-[12px] text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <Clock3 size={14} className="shrink-0" aria-hidden />
            <span className={countdown ? 'truncate font-bold text-ink' : 'truncate'}>
              {formatDateTime(task.date_time)}{countdown ? ` · ${countdown}` : ''}
            </span>
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <MapPin size={14} className="shrink-0" aria-hidden />
            <span className="truncate">{task.area}</span>
          </span>
        </div>

        {expanded && task.description && (
          <p className="mt-2 rounded-[14px] bg-canvas p-2.5 text-[12px] leading-[1.45] text-ink/80">
            {task.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f7e9d8]">
            <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
            <UsersRound size={13} aria-hidden />
            {task.spots_filled}/{task.spots_needed} joined
          </span>
        </div>
      </Link>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <ShareTaskButton task={task} />
        <div className="flex items-center gap-2">
          {isOwnTask || applicationStatus === 'accepted' ? (
            <Link
              to={`/task/${task.id}/chat`}
              className="join-task-pill"
            >
              Open chat
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : status.label === 'Full' ? (
            <Link
              to={`/task/${task.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-3 py-1.5 text-[11px] font-semibold text-muted"
            >
              View anyway
            </Link>
          ) : (
            <Link
              to={`/task/${task.id}`}
              className="join-task-pill"
            >
              Join task
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'See details'}
            className="rounded-full p-1.5 text-muted transition hover:bg-line"
          >
            <ChevronDown size={17} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </article>
  )
}
