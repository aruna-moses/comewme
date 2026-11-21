import { supabase } from './supabase'
import { toError } from './errors'

export type CallType = 'audio' | 'video'
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed'

export interface CallSession {
  id: string
  chat_id: string
  caller_id: string
  call_type: CallType
  room_url: string
  room_token: string
  status: CallStatus
  created_at: string
  ended_at: string | null
}

/**
 * Room identity only — the LiveKit websocket URL and participant token come
 * from the create-livekit-token Edge Function at join time. Stored in
 * call_sessions.room_url for lack of a dedicated column; never exposed in URLs.
 */
export function createCallRoom(): { roomName: string } {
  return { roomName: `comewme-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}` }
}

/** Call milestones appear in the activity chat timeline for everyone to see. */
export async function insertCallEvent(input: {
  taskId: string
  actorId: string
  actorName: string
  eventType: 'call_started' | 'call_ended'
  body?: string | null
}): Promise<void> {
  const { error } = await supabase.from('activity_system_events').insert({
    task_id: input.taskId,
    actor_id: input.actorId,
    actor_name: input.actorName,
    event_type: input.eventType,
    body: input.body ?? null,
  })
  if (error) throw toError(error)
}

/** Server-minted, membership-checked participant token. */
export async function fetchLiveKitToken(input: {
  chatId: string
  roomName: string
}): Promise<{ url: string; token: string }> {
  const { data, error } = await supabase.functions.invoke('create-livekit-token', {
    body: input,
  })
  if (error) throw error
  if (!data?.url || !data?.token) throw new Error('The call token was not created')
  return data as { url: string; token: string }
}

/** Signal a call to the activity's members. RLS restricts this to participants. */
export async function insertCallSession(input: {
  chatId: string
  callerId: string
  callType: CallType
  url: string
}): Promise<CallSession> {
  const { data, error } = await supabase
    .from('call_sessions')
    .insert({
      chat_id: input.chatId,
      caller_id: input.callerId,
      call_type: input.callType,
      room_url: input.url,
      room_token: '', // LiveKit tokens are minted at join time, never stored
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CallSession
}

/** Existing notification + webhook pipeline sends the off-app push for us. */
export async function notifyMembersOfCall(input: {
  chatId: string
  callerId: string
  callerName: string
  sessionId: string
  callType: CallType
}): Promise<void> {
  const [{ data: task }, { data: joins }] = await Promise.all([
    supabase.from('tasks').select('host_id, title').eq('id', input.chatId).maybeSingle(),
    supabase
      .from('join_requests')
      .select('requester_id')
      .eq('task_id', input.chatId)
      .eq('status', 'accepted'),
  ])
  const ids = new Set<string>(
    [task?.host_id as string | undefined, ...(joins ?? []).map((j) => j.requester_id as string)]
      .filter((id): id is string => Boolean(id)),
  )
  ids.delete(input.callerId)
  await Promise.all(
    [...ids].map((userId) =>
      supabase.rpc('push_notification', {
        p_user_id: userId,
        p_type: 'incoming_call',
        p_title: task?.title || 'Group call',
        p_body: `${input.callerName} is calling — join the group call`,
        p_link_path: `/task/${input.chatId}/chat?joinCall=${input.sessionId}`,
      }),
    ),
  )
}

export async function fetchCallSession(id: string): Promise<CallSession | null> {
  const { data } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as CallSession | null) ?? null
}

export async function updateCallSession(
  id: string,
  status: CallStatus,
): Promise<void> {
  const { error } = await supabase
    .from('call_sessions')
    .update({ status, ...(status === 'ended' || status === 'missed' ? { ended_at: new Date().toISOString() } : {}) })
    .eq('id', id)
  if (error) throw error
}
