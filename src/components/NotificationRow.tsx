import { Link } from 'react-router-dom'
import { HeartHandshake, ShieldCheck, Flag, Info, CalendarDays, MessageCircle, Phone } from 'lucide-react'
import type { InAppNotification, NotificationType } from '../lib/notifications'

const TYPE_CONFIG: Record<NotificationType, { icon: typeof HeartHandshake; tile: string; label: string }> = {
  join_request: { icon: HeartHandshake, tile: 'bg-verified/15 text-verified', label: 'Activity' },
  selfie:       { icon: ShieldCheck,    tile: 'bg-sun/20 text-amber',        label: 'Selfie' },
  appeal:       { icon: Flag,           tile: 'bg-[#eef4fb] text-[#4273a8]', label: 'Appeal' },
  violation:    { icon: Flag,           tile: 'bg-alert/10 text-alert',      label: 'Report' },
  chat:         { icon: MessageCircle,  tile: 'bg-sun/20 text-amber',        label: 'Chat' },
  info:         { icon: Info,           tile: 'bg-line text-muted',          label: 'Note' },
  reminder:     { icon: CalendarDays,   tile: 'bg-sun/20 text-amber',        label: 'Reminder' },
  incoming_call:{ icon: Phone,          tile: 'bg-sun/25 text-amber',        label: 'Call' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d`
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

  const row = (
    <div
      className={`relative flex items-start gap-3.5 rounded-[20px] border p-4 shadow-card transition-all duration-200 active:scale-[0.98] ${
        unread ? 'border-amber/40 bg-white' : 'border-line/60 bg-white'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${config.tile}`}
        aria-hidden
      >
        <Icon size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-muted">
            {config.label}
          </span>
          <span className="h-px flex-1 bg-line/70" aria-hidden />
          <span className="shrink-0 text-[12px] font-medium leading-none text-muted tabular-nums">
            {timeAgo(item.created_at)}
          </span>
          {unread && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-amber" />}
        </span>

        <span className="mt-2 block text-[16px] font-semibold leading-snug text-ink">{item.title}</span>
        <span className="mt-1.5 block text-[14px] leading-snug text-muted line-clamp-2">{item.body}</span>
      </span>
    </div>
  )

  return item.link_path ? (
    <Link to={item.link_path} onClick={() => onMarkRead(item.id)} className="block" aria-label={`${item.title}: ${item.body}`}>
      {row}
    </Link>
  ) : (
    row
  )
}
