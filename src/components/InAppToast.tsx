import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import { markNotificationRead } from '../lib/notifications'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return 'over a day ago'
}

export default function InAppToast() {
  const { notifications } = useNotifications()
  const location = useLocation()
  const [visible, setVisible] = useState<string | null>(null)

  // Show one toast at a time — the newest unread, suppressed on the inbox page and on the matching chat.
  const pathname = location.pathname
  const candidate = notifications.find((n) => !n.read_at) ?? null

  useEffect(() => {
    if (!candidate || pathname === '/notifications' || (candidate.link_path && candidate.link_path === pathname)) return
    const current = candidate
    setVisible((currentId) => (currentId === current.id ? currentId : current.id))
    const timer = window.setTimeout(() => setVisible(null), 6000)
    return () => window.clearTimeout(timer)
  }, [candidate, pathname])

  if (!candidate || visible !== candidate.id) return null
  const n = candidate

  return (
    <div
      aria-live="polite"
      role="status"
      className="toast-slide-down fixed left-1/2 top-3 z-[70] w-[92%] max-w-sm"
      onClick={() => setVisible(null)}
    >
      <Link
        to={n.link_path ?? '/notifications'}
        onClick={() => {
          void markNotificationRead(n.id)
          setVisible(null)
        }}
        className="flex items-start gap-3 rounded-2xl border border-line bg-white/95 p-3.5 shadow-lift backdrop-blur dark:bg-[#1b2029]/95"
      >
        <img src="/logo.png" alt="" aria-hidden className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Come w&apos; me
            </span>
            <span className="text-[10px] text-muted">{timeAgo(n.created_at)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold leading-tight text-ink">
            {n.title}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-muted line-clamp-2">
            {n.body}
          </span>
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void markNotificationRead(n.id)
            setVisible(null)
          }}
          className="shrink-0 rounded-full p-1 text-muted hover:bg-line hover:text-ink"
        >
          <X size={15} />
        </button>
      </Link>
    </div>
  )
}
