import { Link } from 'react-router-dom'
import { Check, HeartHandshake, ShieldCheck, Flag, Info, CalendarDays } from 'lucide-react'
import type { InAppNotification, NotificationType } from '../lib/notifications'

const TYPE_CONFIG: Record<NotificationType, { icon: typeof HeartHandshake; className: string; label: string }> = {
  join_request: { icon: HeartHandshake, className: 'bg-verified/15 text-verified', label: 'Activity' },
  selfie:       { icon: ShieldCheck,    className: 'bg-sun/25 text-amber',      label: 'Selfie' },
  appeal:       { icon: Flag,           className: 'bg-[#eef4fb] text-[#4273a8]', label: 'Appeal' },
  violation:    { icon: Flag,           className: 'bg-alert/10 text-alert',     label: 'Report' },
  info:         { icon: Info,           className: 'bg-line text-muted',         label: 'Info' },
  reminder:     { icon: CalendarDays,   className: 'bg-sun/20 text-amber',       label: 'Reminder' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

export default function NotificationRow({
  item,
  onMarkRead,
}: {
  item: InAppNotification
  onMarkRead: (id: string) => void
}) {
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info
  const Icon = config.icon
  const unread = !item.read_at

  const inner = (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
        unread ? 'border-amber/30 bg-sun/10' : 'border-line bg-white'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.className}`} aria-hidden>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{config.label}</span>
          {unread && <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />}
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-ink">{item.title}</span>
        <span className="mt-1 block text-[12px] leading-snug text-muted">{item.body}</span>
        <span className="mt-1 block text-[10px] text-muted">{timeAgo(item.created_at)}</span>
      </span>
      {unread && (
        <button
          type="button"
          aria-label="Mark as read"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onMarkRead(item.id)
          }}
          className="-mr-1 shrink-0 rounded-full p-1.5 text-muted transition hover:bg-line hover:text-ink"
        >
          <Check size={16} />
        </button>
      )}
    </div>
  )

  return item.link_path ? (
    <Link to={item.link_path} onClick={() => onMarkRead(item.id)}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  )
}
