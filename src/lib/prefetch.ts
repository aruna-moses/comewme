import { fetchFeed, fetchVerificationStatuses, fetchProfile, fetchReviews } from './api'
import { loadChatsForUser } from './chatsData'
import { loadMyTasksForUser } from './myTasksData'
import { cacheFresh, cacheKeys, writeCache } from './dataCache'

/** Fire-and-forget prefetches triggered from hover/press on navigation items. */

export async function prefetchDiscoverFeed(): Promise<void> {
  if (cacheFresh(cacheKeys.feed())) return
  try {
    const rows = await fetchFeed({ category: 'all', area: 'all', forYou: null, limit: 20, offset: 0 })
    const hostVerification = await fetchVerificationStatuses(rows.map((r) => r.host_id))
    writeCache(cacheKeys.feed(), { tasks: rows, statuses: {}, verifiedMap: hostVerification })
  } catch {
    /* best effort — first render will fetch anyway */
  }
}

export async function prefetchMyTasks(profileId: string): Promise<void> {
  const key = cacheKeys.myTasks(profileId)
  if (cacheFresh(key)) return
  try {
    writeCache(key, await loadMyTasksForUser(profileId))
  } catch {
    /* best effort */
  }
}

export async function prefetchChats(profileId: string): Promise<void> {
  const key = cacheKeys.chats(profileId)
  if (cacheFresh(key)) return
  try {
    writeCache(key, await loadChatsForUser(profileId))
  } catch {
    /* best effort */
  }
}

export async function prefetchProfile(profileId: string): Promise<void> {
  const key = cacheKeys.profile(profileId)
  if (cacheFresh(key)) return
  try {
    const [profile, reviews] = await Promise.all([
      fetchProfile(profileId),
      fetchReviews(profileId),
    ])
    if (profile) writeCache(key, { profile, reviews })
  } catch {
    /* best effort */
  }
}
