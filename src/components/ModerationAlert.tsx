import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return 'over a day ago'
}

/**
 * Loud, dismissible banner for moderators when someone presses SOS.
 * Sits above every screen except the moderation pages themselves.
 */
export default function ModerationAlert() {
  const { moderation } = useNotifications()
  const location = useLocation()
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const latest = moderation.latest_sos
  const onAdminPage = location.pathname.startsWith('/admin')

  useEffect(() => {
    setDismissedId(null)
  }, [latest?.id])

  if (
    !moderation.is_moderator
    || moderation.sos === 0
    || !latest
    || onAdminPage
    || dismissedId === latest.id
  ) {
    return null
  }

  const who = latest.display_name || 'A member'
  const where = latest.location_address || latest.task_title || 'location shared'

  return (
    <div className="fixed left-1/2 top-0 z-[70] w-full max-w-[480px] -translate-x-1/2 px-2 pt-2">
      <div className="flex items-start gap-2 rounded-xl bg-[#DC2626] px-3 py-2 text-white shadow-lg">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <Link to="/admin/moderation" className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight">
            SOS alert{moderation.sos > 1 ? ` · ${moderation.sos} waiting` : ''}
          </p>
          <p className="truncate text-[11px] leading-tight text-white/90">
            {who} · {where} · {timeAgo(latest.created_at)}
          </p>
        </Link>
        <button
          type="button"
          onClick={() => setDismissedId(latest.id)}
          aria-label="Dismiss SOS alert"
          className="-mr-1 shrink-0 p-1 text-white/80"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
