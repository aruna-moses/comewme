import { supabase } from './supabase'
import { readDraft, writeDraft, clearDraft } from './drafts'

/**
 * Per-group pin, WhatsApp-style.
 *
 * Source of truth is the server-side `pinned_chats` table (see migration 049):
 * - Rows are written through the `pin_chat` / `unpin_chat` RPCs (security definer).
 * - Pinned chats always float to the top of the chat list regardless of activity.
 * - Syncs across devices.
 *
 * Legacy device-local pins (`chats:pinned` localStorage array) are merged into
 * the table automatically on first load after the migration runs.
 * Until then, RPCs fail and we fall back to the localStorage array so pin still
 * works on this device.
 */

const TTL_MS = 60_000
const legacyKey = 'chats:pinned'

let cacheIds: Set<string> | null = null
let cacheAt = 0
let cacheUid: string | null = null

export function getCachedPinnedTaskIds(): Set<string> {
  return cacheIds ? new Set(cacheIds) : new Set()
}

function readLegacyPinned(): string[] {
  const value = readDraft<string[]>(legacyKey)?.value
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

/** One-time best-effort merge of legacy localStorage pins into the server table. */
async function mergeLegacyPins(uid: string, serverIds: Set<string>): Promise<Set<string>> {
  const legacy = readLegacyPinned()
  if (legacy.length === 0) return serverIds
  const missing = legacy.filter((id) => !serverIds.has(id))
  if (missing.length === 0) {
    clearDraft(legacyKey)
    return serverIds
  }
  const merged = new Set(serverIds)
  for (const id of missing) {
    const { error } = await supabase.rpc('pin_chat', { p_task_id: id })
    if (!error) merged.add(id)
  }
  clearDraft(legacyKey)
  return merged
}

export async function fetchPinnedTaskIds(uid: string, force = false): Promise<Set<string>> {
  if (!force && cacheIds && cacheUid === uid && Date.now() - cacheAt < TTL_MS) {
    return new Set(cacheIds)
  }
  const { data, error } = await supabase.from('pinned_chats').select('task_id').eq('user_id', uid)
  if (error) {
    // Table not there yet (or offline) — legacy array keeps the UI alive on this device.
    if (!cacheIds) cacheIds = new Set(readLegacyPinned())
    return new Set(cacheIds)
  }
  let next = new Set((data ?? []).map((row: { task_id: string }) => row.task_id))
  next = await mergeLegacyPins(uid, next)
  cacheIds = next
  cacheAt = Date.now()
  cacheUid = uid
  return new Set(cacheIds)
}

/** Flip the pin for a task. Optimistic cache update; falls back to localStorage pre-migration. */
export async function togglePinnedTask(uid: string, taskId: string): Promise<void> {
  const next = new Set(cacheIds ?? readLegacyPinned())
  const wantPinned = !next.has(taskId)
  const rpc = wantPinned ? 'pin_chat' : 'unpin_chat'
  const { error } = await supabase.rpc(rpc, { p_task_id: taskId })
  if (error) {
    // Pre-migration behaviour: keep the UI responsive via the legacy array.
    const legacy = new Set(readLegacyPinned())
    if (wantPinned) legacy.add(taskId)
    else legacy.delete(taskId)
    writeDraft(legacyKey, [...legacy])
    cacheIds = legacy
    cacheAt = Date.now()
    cacheUid = uid
    return
  }
  if (wantPinned) next.add(taskId)
  else next.delete(taskId)
  cacheIds = next
  cacheAt = Date.now()
  cacheUid = uid
}
