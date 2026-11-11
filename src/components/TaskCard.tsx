import { CheckCircle2, ChevronDown, Clock3, MapPin, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category, JoinStatus, Task, VerificationStatus } from '../types'
import { categoryLabel, CATEGORIES } from '../types'
import { formatDateTime } from '../lib/format'
import Avatar from './Avatar'
import ShareTaskButton from './ShareTaskButton'

const tileStyles: Record<Category, string> = {
  market_run: 'bg-[#e4f4ef]',
  ride: 'bg-[#e8eef7]',
  food: 'bg-[#ffebdc]',
  study: 'bg-[#f1ecfa]',
  dev: 'bg-[#e8eef7]',
  event: 'bg-[#fdeef3]',
  errands: 'bg-[#e4f4ef]',
  other: 'bg-[#f0efee]',
}

const categoryStyles: Record<Category, string> = {
  market_run: 'bg-[#eef7f5] text-[#16827d]',
  ride: 'bg-[#eef4fb] text-[#4273a8]',
  food: 'bg-[#fff3e8] text-[#cc7625]',
  study: 'bg-[#f5f0f8] text-[#8054a6]',
  dev: 'bg-[#eef4fb] text-[#4273a8]',
  event: 'bg-[#fcf0f5] text-[#d35d88]',
  errands: 'bg-[#eef7f5] text-[#16827d]',
  other: 'bg-[#f1f1ef] text-[#6b7280]',
}

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

export default function TaskCard({
  task,
  verificationStatus,
  applicationStatus,
  reviewBadge,
}: {
  task: Task
  verificationStatus?: VerificationStatus
  applicationStatus?: JoinStatus
  /** Number of pending join requests on this task (host view only) — rendered as a red badge. */
  reviewBadge?: number
}) {
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
              <span className="truncate max-w-[45%]">{task.host_name}</span>
              {verificationStatus === 'verified' && (
                <CheckCircle2 size={11} className="shrink-0 text-amber" aria-label="Verified member" />
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
          {status.label === 'Full' ? (
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
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
