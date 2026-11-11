import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, CheckCheck } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import NotificationRow from '../components/NotificationRow'
import type { InAppNotification } from '../lib/notifications'

function dayGroup(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Earlier'
  const startOfLocalDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diffDays = Math.round((startOfToday - startOfLocalDay) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NotificationsPage() {
  const { notifications, unreadNotifications, markNotificationRead, markAllNotificationsRead, refresh } = useNotifications()

  // Opening the feed counts as reading — clear the bell badge once the user lands here.
  useEffect(() => {
    if (unreadNotifications === 0) return
    const t = window.setTimeout(() => { void markAllNotificationsRead() }, 1200)
    return () => window.clearTimeout(t)
  }, [unreadNotifications, markAllNotificationsRead])

  // Make sure we always have the freshest list when you land here.
  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, InAppNotification[]>()
    for (const item of notifications) {
      const key = dayGroup(item.created_at)
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [notifications])

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="-ml-1 inline-flex items-center gap-1.5 text-amber" aria-label="Back to Discover">
          <ArrowLeft size={20} aria-hidden />
          <span className="text-[13px] font-semibold">Back</span>
        </Link>
        <h1 className="font-display text-[18px] font-bold">Notifications</h1>
        {unreadNotifications > 0 && (
          <button
            type="button"
            onClick={() => void markAllNotificationsRead()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-sun/20 px-3 py-1.5 text-[11px] font-semibold text-amber"
          >
            <CheckCheck size={13} aria-hidden />
            Mark all read
          </button>
        )}
      </header>

      <main className="mx-auto max-w-[640px] px-4 pt-4">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Sparkles size={32} className="mx-auto text-amber" aria-hidden />
            <p className="mt-4 font-display text-[18px] font-bold">All caught up</p>
            <p className="mt-1 text-[13px] text-muted">
              Nothing new here yet. When someone accepts your request, or we review something you sent, it lands on this page.
            </p>
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <section key={day} className="mb-5">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{day}</p>
              <div className="space-y-2">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onMarkRead={(id) => void markNotificationRead(id)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
