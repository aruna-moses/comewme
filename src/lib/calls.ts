import { supabase } from './supabase'

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
 * Free public Jitsi room. The random name is the only access control — never
 * expose it outside call_sessions (RLS limits reads to activity members).
 * Audio calls start with the camera muted, exactly like the Daily flow did.
 */
export function createCallRoom(callType: CallType): { url: string; token: string } {
  const room = `Comewme-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  const hash = new URLSearchParams({
    'config.startWithVideoMuted': callType === 'audio' ? 'true' : 'false',
    'config.startWithAudioMuted': 'false',
    'config.disableDeepLinking': 'true',     // no "Join in app / download the app" interstitial
    'config.prejoinPageEnabled': 'false',   // no prejoin / dial-in PIN screen — go straight in
    'config.prejoinConfig.enabled': 'false', // skip the device-check "Join meeting" gate too
    'interfaceConfig.SHOW_JITSI_WATERMARK': 'false',
  })
  return { url: `https://meet.jit.si/${room}#${hash.toString()}`, token: '' }
}

/** Signal a call to the activity's members. RLS restricts this to participants. */
export async function insertCallSession(input: {
  chatId: string
  callerId: string
  callType: CallType
  url: string
  token: string
}): Promise<CallSession> {
  const { data, error } = await supabase
    .from('call_sessions')
    .insert({
      chat_id: input.chatId,
      caller_id: input.callerId,
      call_type: input.callType,
      room_url: input.url,
      room_token: input.token,
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
    supabase.from('tasks').select('host_id').eq('id', input.chatId).maybeSingle(),
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
        p_title: `${input.callerName} is calling`,
        p_body: input.callType === 'video' ? 'Video call in your activity chat' : 'Audio call in your activity chat',
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
