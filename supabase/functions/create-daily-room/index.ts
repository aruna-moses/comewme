// Supabase Edge Function: create-daily-room
// Creates a short-lived private Daily room + meeting token for an activity chat.
// Called from the app with the signed-in user's JWT; membership is verified
// against the activity before any Daily resource is created.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401)
  const accessToken = auth.slice(7).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase not configured' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
  if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)
  const uid = authData.user.id

  let payload: { chatId?: string; callType?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid body' }, 400)
  }
  const { chatId, callType } = payload
  if (!chatId || !UUID.test(chatId) || (callType !== 'audio' && callType !== 'video')) {
    return json({ error: 'Invalid chat or call type' }, 400)
  }

  const { data: task, error: taskError } = await userClient
    .from('tasks')
    .select('id, host_id, status')
    .eq('id', chatId)
    .maybeSingle()
  if (taskError || !task) return json({ error: 'Activity not found' }, 404)
  if (!['open', 'full'].includes(task.status)) return json({ error: 'This activity is no longer active' }, 409)

  let member = task.host_id === uid
  if (!member) {
    const { data: request } = await userClient
      .from('join_requests')
      .select('id')
      .eq('task_id', chatId)
      .eq('requester_id', uid)
      .eq('status', 'accepted')
      .maybeSingle()
    member = Boolean(request)
  }
  if (!member) return json({ error: 'Only members can start a call here' }, 403)

  const dailyKey = Deno.env.get('DAILY_API_KEY')
  if (!dailyKey) return json({ error: 'Calling is not configured' }, 503)

  const exp = Math.floor(Date.now() / 1000) + 3600
  const dailyHeaders = {
    Authorization: `Bearer ${dailyKey}`,
    'Content-Type': 'application/json',
  }

  const roomRes = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      privacy: 'private',
      properties: {
        exp,
        start_video_off: callType === 'audio',
        enable_chat: false,
        enable_screenshare: false,
      },
    }),
  })
  if (!roomRes.ok) {
    console.error('Daily room create failed', roomRes.status, (await roomRes.text()).slice(0, 300))
    return json({ error: 'Could not create the call room' }, 502)
  }
  const room = await roomRes.json()

  const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      properties: { room_name: room.name, exp, is_owner: true },
    }),
  })
  if (!tokenRes.ok) {
    console.error('Daily token create failed', tokenRes.status, (await tokenRes.text()).slice(0, 300))
    return json({ error: 'Could not create the call token' }, 502)
  }
  const meeting = await tokenRes.json()

  return json({ url: room.url, token: meeting.token, roomName: room.name })
})
