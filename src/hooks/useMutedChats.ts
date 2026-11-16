import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchMutedTaskIds, getCachedMutedTaskIds, isTaskMuted, toggleMutedTask } from '../lib/chatMute'

/**
 * React binding over the shared muted_chats cache.
 * Returns a stable `isMuted(taskId)` plus an async `toggleMute(taskId)`.
 */
export function useMutedChats() {
  const { profile } = useAuth()
  const uid = profile?.id ?? null
  const [mutedIds, setMutedIds] = useState<Set<string>>(() => getCachedMutedTaskIds())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!uid) {
      setReady(true)
      return
    }
    fetchMutedTaskIds(uid, true)
      .then((ids) => {
        if (cancelled) return
        setMutedIds(new Set(ids))
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  const isMuted = useCallback(
    (taskId: string) => mutedIds.has(taskId) || isTaskMuted(taskId),
    [mutedIds],
  )

  const toggleMute = useCallback(
    async (taskId: string) => {
      if (!uid) return
      // Optimistic flip — the shared cache is updated by toggleMutedTask.
      const willMute = !isTaskMuted(taskId)
      setMutedIds((prev) => {
        const next = new Set(prev)
        if (willMute) next.add(taskId)
        else next.delete(taskId)
        return next
      })
      await toggleMutedTask(uid, taskId)
      // Re-sync with whatever the server/cache settled on.
      setMutedIds(getCachedMutedTaskIds())
    },
    [uid],
  )

  return { isMuted, toggleMute, ready, mutedCount: mutedIds.size }
}
