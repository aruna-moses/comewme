import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

export default function NotificationBell() {
  const { unreadNotifications } = useNotifications()
  const badge = unreadNotifications > 0

  return (
    <Link
      to="/notifications"
      aria-label={badge ? `Notifications, ${unreadNotifications} unread — open your inbox` : 'Notifications — open your inbox'}
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
    </Link>
  )
}
