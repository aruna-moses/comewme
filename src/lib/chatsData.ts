import { supabase } from './supabase'
import type { Task } from '../types'

export interface ChatEntry {
  task: Task
  acceptedAt: string | null
  lastEventAt: string | null
  lastMessage: {
    body: string
    type: 'text' | 'image' | 'audio'
    sender_name: string
    sender_id: string
    created_at: string
  } | null
}

/** Tasks where the user is the host or an accepted participant, newest activity first. */
export async function loadChatsForUser(profileId: string): Promise<ChatEntry[]> {
  const [hostRes, joinRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('host_id', profileId)
      .order('date_time', { ascending: false }),
    supabase
      .from('join_requests')
      .select('task_id, status, accepted_at')
      .eq('requester_id', profileId)
      .eq('status', 'accepted'),
  ])

  const hosted = (hostRes.data ?? []) as Task[]
  const joinedIds = (joinRes.data ?? []).map((j) => j.task_id)

  let joined: Task[] = []
  if (joinedIds.length > 0) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .in('id', joinedIds)
      .order('date_time', { ascending: false })
    joined = (data ?? []) as Task[]
  }

  const all = [...hosted, ...joined]
  const seen = new Set<string>()
  const unique = all.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return t.status !== 'cancelled'  // deleted activities leave chat lists immediately
  })

  const acceptedAtByTaskId = new Map<string, string | null>()
  ;(joinRes.data ?? []).forEach((j) => acceptedAtByTaskId.set(j.task_id, j.accepted_at ?? null))

  const tIds = unique.map((t) => t.id)
  const eventsRes = tIds.length > 0
    ? await supabase
        .from('activity_system_events')
        .select('task_id, created_at')
        .in('task_id', tIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ task_id: string; created_at: string }> }

  const lastEventByTaskId = new Map<string, string>()
  for (const row of (eventsRes.data ?? []) as Array<{ task_id: string; created_at: string }>) {
    if (!lastEventByTaskId.has(row.task_id)) lastEventByTaskId.set(row.task_id, row.created_at)
  }

  const enriched = await Promise.all(
    unique.map(async (t) => {
      const { data: msgsRes } = await supabase
        .from('messages')
        .select('body, type, sender_name, sender_id, created_at')
        .eq('task_id', t.id)
        .order('created_at', { ascending: false })
        .limit(1)
      return {
        task: t,
        acceptedAt: acceptedAtByTaskId.get(t.id) ?? null,
        lastEventAt: lastEventByTaskId.get(t.id) ?? null,
        lastMessage: (msgsRes ?? [])[0] ?? null,
      }
    }),
  )

  enriched.sort((a, b) => {
    const compute = (e: { lastMessage?: { created_at: string } | null; lastEventAt: string | null; acceptedAt: string | null; task: { created_at: string } }) => {
      const lastMsg = e.lastMessage ? new Date(e.lastMessage.created_at).getTime() : 0
      const lastEvent = e.lastEventAt ? new Date(e.lastEventAt).getTime() : 0
      const joined = e.acceptedAt ? new Date(e.acceptedAt).getTime() : 0
      const created = new Date(e.task.created_at).getTime()
      return Math.max(lastMsg, lastEvent, joined, created)
    }
    return compute(b) - compute(a)
  })

  return enriched
}
