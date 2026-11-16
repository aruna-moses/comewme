import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchPinnedTaskIds, getCachedPinnedTaskIds, togglePinnedTask } from '../lib/pinChat'

/**
 * React binding over the shared pinned_chats cache.
 * Returns the current pinned id list (for ordering), a stable `isPinned(taskId)`,
 * and an async `togglePin(taskId)`.
 */
export function usePinnedChats() {
  const { profile } = useAuth()
  const uid = profile?.id ?? null
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => getCachedPinnedTaskIds())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!uid) {
      setReady(true)
      return
    }
    fetchPinnedTaskIds(uid, true)
      .then((ids) => {
        if (cancelled) return
        setPinnedIds(new Set(ids))
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  const isPinned = useCallback((taskId: string) => pinnedIds.has(taskId), [pinnedIds])

  const togglePin = useCallback(
    async (taskId: string) => {
      if (!uid) return
      // Optimistic flip — the shared cache is updated by togglePinnedTask.
      setPinnedIds((prev) => {
        const next = new Set(prev)
        if (next.has(taskId)) next.delete(taskId)
        else next.add(taskId)
        return next
      })
      await togglePinnedTask(uid, taskId)
      setPinnedIds(getCachedPinnedTaskIds())
    },
    [uid],
  )

  return { isPinned, togglePin, pinnedIds, ready, pinnedCount: pinnedIds.size }
}
