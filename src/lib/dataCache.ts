/**
 * Tiny in-memory page cache for stale-while-revalidate behaviour.
 * Reads return instantly on mount so the page paints without waiting for the
 * network; every page still re-fetches in the background and overwrites.
 */

const TTL_MS = 90_000

const store = new Map<string, { at: number; value: unknown }>()

export function readCache<T>(key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > TTL_MS) return undefined
  return hit.value as T
}

export function writeCache(key: string, value: unknown): void {
  store.set(key, { at: Date.now(), value })
}

export function cacheFresh(key: string): boolean {
  const hit = store.get(key)
  return Boolean(hit) && Date.now() - (hit as { at: number }).at <= TTL_MS
}

export const cacheKeys = {
  feed: () => 'feed:all',
  myTasks: (profileId: string) => `mytasks:${profileId}`,
  chats: (profileId: string) => `chats:${profileId}`,
  profile: (profileId: string) => `profile:${profileId}`,
}
