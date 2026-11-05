import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { fetchChatUnreadCounts, fetchNotificationBadgeCounts } from '../lib/api'
import type { NotificationBadgeCounts } from '../lib/api'
import { supabase } from '../lib/supabase'

interface NotificationState extends NotificationBadgeCounts {
  unreadByTask: Record<string, number>
  error: string | null
  refresh: () => Promise<void>
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current
    if (!session?.user.id) {
      setCounts(EMPTY_COUNTS)
      setUnreadByTask({})
      setLoadError(null)
      setRealtimeError(null)
      return
    }

    try {
      const [next, unreadCounts] = await Promise.all([
        fetchNotificationBadgeCounts(),
        fetchChatUnreadCounts(),
      ])
      if (requestId !== requestSequence.current) return
      setCounts(next)
      setUnreadByTask(unreadCounts)
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

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    void refresh()

    return () => {
      active = false
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [session?.user.id, refresh])

  const value = useMemo<NotificationState>(
    () => ({ ...counts, unreadByTask, error: loadError ?? realtimeError, refresh }),
    [counts, unreadByTask, loadError, realtimeError, refresh],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return context
}
