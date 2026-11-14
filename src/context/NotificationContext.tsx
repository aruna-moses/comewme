import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { fetchChatUnreadCounts, fetchNotificationBadgeCounts } from '../lib/api'
import type { NotificationBadgeCounts } from '../lib/api'
import { EMPTY_MODERATION, fetchModerationCounts } from '../lib/moderation'
import type { ModerationCounts } from '../lib/moderation'
import { fetchNotifications, fetchUnreadCount } from '../lib/notifications'
import type { InAppNotification } from '../lib/notifications'
import { supabase } from '../lib/supabase'

interface NotificationState extends NotificationBadgeCounts {
  unreadByTask: Record<string, number>
  moderation: ModerationCounts
  notifications: InAppNotification[]
  unreadNotifications: number
  error: string | null
  refresh: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
}

const EMPTY_COUNTS: NotificationBadgeCounts = {
  pendingApplications: 0,
  unreadMessages: 0,
}

const NotificationContext = createContext<NotificationState | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [unreadByTask, setUnreadByTask] = useState<Record<string, number>>({})
  const [moderation, setModeration] = useState<ModerationCounts>(EMPTY_MODERATION)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current
    if (!session?.user.id) {
      setCounts(EMPTY_COUNTS)
      setUnreadByTask({})
      setModeration(EMPTY_MODERATION)
      setNotifications([])
      setUnreadNotifications(0)
      setLoadError(null)
      setRealtimeError(null)
      return
    }

    try {
      // Moderation is best-effort: if 014 has not been run yet the rest still works.
      const [next, unreadCounts, mod, inbox, unreadInbox] = await Promise.all([
        fetchNotificationBadgeCounts(),
        fetchChatUnreadCounts(),
        fetchModerationCounts().catch(() => EMPTY_MODERATION),
        fetchNotifications(30).catch(() => [] as InAppNotification[]),
        fetchUnreadCount().catch(() => 0),
      ])
      if (requestId !== requestSequence.current) return
      setCounts(next)
      setUnreadByTask(unreadCounts)
      setModeration(mod)
      setNotifications(inbox)
      setUnreadNotifications(unreadInbox)
      setLoadError(null)
    } catch (e) {
      if (requestId === requestSequence.current) {
        setLoadError(e instanceof Error ? e.message : 'Could not refresh notification counts.')
      }
    }
  }, [session?.user.id])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      requestSequence.current += 1
      setCounts(EMPTY_COUNTS)
      setUnreadByTask({})
      setModeration(EMPTY_MODERATION)
      setNotifications([])
      setUnreadNotifications(0)
      setLoadError(null)
      setRealtimeError(null)
      return
    }

    let active = true
    let refreshTimer: number | null = null
    const refreshIfActive = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        if (active) void refresh()
      }, 200)
    }

    const channel = supabase
      .channel(`notification-badges:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refreshIfActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, refreshIfActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, refreshIfActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, refreshIfActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advertisements' }, refreshIfActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refreshIfActive)
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          setRealtimeError(null)
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeError('Live notifications are temporarily unavailable. Counts will refresh when you revisit the app.')
        }
      })

    // Safety net: realtime may be switched off in the project, so poll while visible.
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30_000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    void refresh()

    return () => {
      active = false
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [session?.user.id, refresh])

  const markNotificationRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id)
      setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
      setUnreadNotifications((current) => Math.max(0, current - 1))
    },
    [],
  )

  const markAllNotificationsRead = useCallback(async () => {
    await markAllNotificationsRead()
    setNotifications((current) => current.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    setUnreadNotifications(0)
  }, [])

  const value = useMemo<NotificationState>(
    () => ({ ...counts, unreadByTask, moderation, notifications, unreadNotifications, error: loadError ?? realtimeError, refresh, markNotificationRead, markAllNotificationsRead }),
    [counts, unreadByTask, moderation, notifications, unreadNotifications, loadError, realtimeError, refresh, markNotificationRead, markAllNotificationsRead],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return context
}
