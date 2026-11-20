import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCheck } from 'lucide-react'
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
  return date.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
    <div className="page-slide-in min-h-screen bg-canvas pb-28">
      {/* Sticky glass header — matches the bottom nav treatment. */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/70 backdrop-blur-2xl saturate-150">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3 px-5 pt-3">
          <Link to="/" className="-ml-2 inline-flex items-center p-2" aria-label="Back to Discover">
            <ArrowLeft size={21} aria-hidden className="text-ink" />
          </Link>
          {unreadNotifications > 0 && (
            <button
              type="button"
              onClick={() => void markAllNotificationsRead()}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-amber transition hover:bg-sun/15"
            >
              <CheckCheck size={14} aria-hidden />
              Mark all read
            </button>
          )}
        </div>
        <h1 className="mx-auto w-full max-w-[640px] px-5 pb-4 pt-1 font-display text-[28px] font-bold leading-tight">
          Notifications
        </h1>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-5 pt-7">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <h2 className="mt-5 font-display text-[22px] font-bold text-ink">All caught up</h2>
            <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
              Nothing new here yet. When someone accepts your request, or we review something you submitted, it lands on this page.
            </p>
            <Link to="/" className="btn-primary mt-6">
              Back to Discover
            </Link>
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <section key={day} className="mb-8">
              <p className="mb-3 px-2 text-[12px] font-bold uppercase leading-none tracking-[0.18em] text-muted">
                {day}
              </p>
              <div className="space-y-3">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onMarkRead={(id) => void markNotificationRead(id)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {notifications.length > 0 && (
        <footer className="mx-auto max-w-[640px] px-5 pb-10 pt-2 text-center">
          <p className="text-[13px] leading-relaxed text-muted">
            That&apos;s everything — nothing newer than this.
          </p>
        </footer>
      )}
    </div>
  )
}
