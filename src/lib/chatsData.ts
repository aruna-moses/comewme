import { supabase } from './supabase'
import type { Task } from '../types'

export interface ChatEntry {
  task: Task
  lastMessage: {
    body: string
    type: 'text' | 'image' | 'audio'
    sender_name: string
    sender_id: string
    created_at: string
  } | null
  members: Array<{ id: string; name: string; avatar: string | null }>
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
      .select('task_id, status')
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
    return true
  })

  const enriched = await Promise.all(
    unique.map(async (t) => {
      const [msgsRes, membersRes] = await Promise.all([
        supabase
          .from('messages')
          .select('body, type, sender_name, sender_id, created_at')
          .eq('task_id', t.id)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('join_requests')
          .select('requester_id, requester_name, requester_avatar_url')
          .eq('task_id', t.id)
          .eq('status', 'accepted')
          .order('created_at', { ascending: true })
          .limit(4),
      ])
      const last = (msgsRes.data ?? [])[0]
      const members = [
        { id: t.host_id, name: t.host_name, avatar: t.host_avatar_url },
        ...((membersRes.data ?? []) as Array<{ requester_id: string; requester_name: string; requester_avatar_url: string | null }>).map((m) => ({
          id: m.requester_id,
          name: m.requester_name,
          avatar: m.requester_avatar_url,
        })),
      ].slice(0, 4)
      return { task: t, lastMessage: last ?? null, members }
    }),
  )

  enriched.sort((a, b) => {
    const aTime = a.lastMessage?.created_at ?? a.task.date_time
    const bTime = b.lastMessage?.created_at ?? b.task.date_time
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return enriched
}
