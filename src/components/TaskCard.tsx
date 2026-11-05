import { CheckCircle2, Clock3, MapPin, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Category, JoinStatus, Task, VerificationStatus } from '../types'
import { categoryLabel, CATEGORIES } from '../types'
import { formatDateTime, relativeDay, timeOfDay } from '../lib/format'
import Avatar from './Avatar'
import ReportButton from './ReportButton'
import ShareTaskButton from './ShareTaskButton'

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
  if (daysUntil < 0 || daysUntil > 3) return null
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}

export default function TaskCard({
  task,
  verificationStatus,
  applicationStatus,
}: {
  task: Task
  verificationStatus?: VerificationStatus
  applicationStatus?: JoinStatus
}) {
  const sponsored = liveSponsor(task)
  const pct = Math.min(100, Math.round((task.spots_filled / task.spots_needed) * 100))
  const isFull = task.status === 'full' || task.spots_filled >= task.spots_needed
  const countdown = countdownLabel(task.date_time)

  return (
    <article className="card rounded-[18px] p-4 transition hover:shadow-lift">
      <Link to={`/task/${task.id}`} className="block rounded-[14px] active:scale-[0.995]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`pill ${categoryStyles[task.category]}`}>
          {categoryEmoji(task.category)} {categoryLabel(task.category).toUpperCase()}
        </span>
        {sponsored ? (
          <span className="pill bg-[#fff4d1] text-[#7a622f]">
            {task.sponsor_name ? `Sponsored · ${task.sponsor_name}` : 'Sponsored'}
          </span>
        ) : (
          <span className={`text-[11px] font-semibold ${isFull ? 'text-muted' : 'text-verified'}`}>
            {isFull ? 'Full' : 'Open'}
          </span>
        )}
      </div>
      {applicationStatus && applicationStatus !== 'withdrawn' && (
        <p
          className={`mb-3 w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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

      <div className="flex items-center gap-2">
        <Avatar src={task.host_avatar_url} name={task.host_name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[12px] font-semibold text-ink">{task.host_name}</p>
            {verificationStatus === 'verified' && (
              <CheckCircle2 size={14} className="shrink-0 text-amber" aria-label="Verified member" />
            )}
          </div>
          <p className="text-[10px] text-muted">
            {verificationStatus === 'verified' ? 'Verified member' : 'Community member'}
          </p>
        </div>
      </div>

      <h3 className="mt-3 line-clamp-2 font-display text-[16px] font-bold leading-snug text-ink">
        {task.title}
      </h3>
      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.45] text-muted">
          {task.description}
        </p>
      )}

      <div className="mt-3 space-y-2 text-[12px] text-muted">
        <p className="flex items-center gap-1.5">
          <MapPin size={15} aria-hidden />
          <span className="truncate">{task.area}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5">
            <Clock3 size={15} className="shrink-0" aria-hidden />
            <span className="truncate">
              {countdown ? `${formatDateTime(task.date_time)}` : `${relativeDay(task.date_time)}, ${timeOfDay(task.date_time)}`}
            </span>
          </p>
          {countdown && (
            <span className="activity-countdown-badge inline-flex shrink-0 items-center rounded-xl px-3 py-1.5 text-[12px] font-bold text-white shadow-sm">
              {countdown}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#f7e9d8]">
        <div
          className="h-full rounded-full bg-amber"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <UsersRound size={15} aria-hidden />
          {task.spots_filled}/{task.spots_needed} joined
        </span>
        <span className="text-[11px] font-semibold text-amber">
          Host reviews
        </span>
      </div>
      </Link>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
        <ShareTaskButton task={task} />
        <ReportButton reportedUserId={task.host_id} taskId={task.id} />
      </div>
    </article>
  )
}
