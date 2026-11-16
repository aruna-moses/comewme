import { supabase } from './supabase'
import { readDraft, writeDraft, clearDraft } from './drafts'

/**
 * Per-group mute, WhatsApp-style.
 *
 * Source of truth is the server-side `muted_chats` table (see migration 048):
 * - Rows are written through the `mute_chat` / `unmute_chat` RPCs (security definer).
 * - `send-push` reads the same table, so a muted group can't push notifications off-app.
 * - In-app toasts check this cache before rendering.
 *
 * A tiny in-memory cache keeps the UI snappy and lets non-React code (InAppToast)
 * make the same decision synchronously after the first fetch.
 *
 * Until migration 048 is applied, RPCs fail — we fall back to the legacy
 * localStorage flag so the button still responds in-app, and nothing throws.
 */

const TTL_MS = 60_000
const legacyKey = (taskId: string) => `chat:${taskId}:mute`

let cacheIds: Set<string> | null = null
let cacheAt = 0
let cacheUid: string | null = null

export function getCachedMutedTaskIds(): Set<string> {
  return cacheIds ? new Set(cacheIds) : new Set()
}

export async function fetchMutedTaskIds(uid: string, force = false): Promise<Set<string>> {
  if (!force && cacheIds && cacheUid === uid && Date.now() - cacheAt < TTL_MS) {
    return new Set(cacheIds)
  }
  const { data, error } = await supabase.from('muted_chats').select('task_id').eq('user_id', uid)
  if (error) {
    // Table not there yet (or offline) — keep whatever we had, else empty.
    return getCachedMutedTaskIds()
  }
  cacheIds = new Set((data ?? []).map((row: { task_id: string }) => row.task_id))
  cacheAt = Date.now()
  cacheUid = uid
  return new Set(cacheIds)
}

export function isMutedLegacy(taskId: string): boolean {
  return readDraft<boolean>(legacyKey(taskId))?.value === true
}

/** Combined decision used by every surface (DB cache + legacy fallback). */
export function isTaskMuted(taskId: string): boolean {
  if (cacheIds?.has(taskId)) return true
  return isMutedLegacy(taskId)
}

/** Flip the mute for a task. Optimistic cache update; falls back to device-local flag pre-migration. */
export async function toggleMutedTask(uid: string, taskId: string): Promise<void> {
  const wantMuted = !isTaskMuted(taskId)
  const next = new Set(cacheIds ?? [])
  const rpc = wantMuted ? 'mute_chat' : 'unmute_chat'
  const { error } = await supabase.rpc(rpc, { p_task_id: taskId })
  if (error) {
    // Pre-migration behaviour: keep the UI responsive via the legacy flag.
    if (wantMuted) writeDraft(legacyKey(taskId), true)
    else clearDraft(legacyKey(taskId))
    // Still flip the session cache so every surface shows the same state.
    if (wantMuted) next.add(taskId)
    else next.delete(taskId)
    cacheIds = next
    cacheAt = Date.now()
    cacheUid = uid
    return
  }
  if (wantMuted) next.add(taskId)
  else next.delete(taskId)
  cacheIds = next
  cacheAt = Date.now()
  cacheUid = uid
  // Server now owns the state — drop the legacy flag so it can't lie later.
  clearDraft(legacyKey(taskId))
}
