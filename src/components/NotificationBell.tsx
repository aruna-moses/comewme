import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, Flag, HeartHandshake, ShieldCheck, Sparkles, Info, CalendarDays } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import Sheet from './Sheet'
import type { InAppNotification, NotificationType } from '../lib/notifications'

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; className: string; label: string }> = {
  join_request: { icon: HeartHandshake, className: 'bg-verified/15 text-verified', label: 'Activity' },
  selfie:       { icon: ShieldCheck,    className: 'bg-sun/25 text-amber',      label: 'Verified' },
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

export default function NotificationBell() {
  const { notifications, unreadNotifications, markNotificationRead, markAllNotificationsRead } = useNotifications()
  const [open, setOpen] = useState(false)

  // Opening the sheet = reading the inbox — clear the badge.
  useEffect(() => {
    if (open && unreadNotifications > 0) void markAllNotificationsRead()
  }, [open, unreadNotifications, markAllNotificationsRead])

  const badge = unreadNotifications > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={badge ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
        className="relative -mr-1 flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
      >
        <Bell size={22} aria-hidden />
        {badge && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-canvas bg-[#e53935] px-1 text-[9px] font-bold leading-none text-white shadow-sm"
          >
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {notifications.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <Sparkles size={28} className="mx-auto text-amber" aria-hidden />
            <p className="mt-3 font-display text-[16px] font-bold">Nothing new here</p>
            <p className="mt-1 text-[12px] text-muted">
              When someone accepts your request, or we review something you sent, it lands right here.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pb-4">
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
              const Icon = config.icon
              const unread = !n.read_at
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
                    <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-ink">{n.title}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted">{n.body}</span>
                    <span className="mt-1 block text-[10px] text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                  {unread && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void markNotificationRead(n.id)
                      }}
                      className="-mr-1 shrink-0 rounded-full p-1.5 text-muted transition hover:bg-line hover:text-ink"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              )
              return n.link_path ? (
                <Link
                  key={n.id}
                  to={n.link_path}
                  onClick={() => {
                    void markNotificationRead(n.id)
                    setOpen(false)
                  }}
                  className="block focus-visible:outline-none"
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        )}
      </Sheet>
    </>
  )
}
