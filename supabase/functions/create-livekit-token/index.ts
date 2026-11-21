// Supabase Edge Function: create-livekit-token
// Mints a short-lived participant token for a free LiveKit Cloud room.
// Verifies the caller's Supabase JWT and activity membership first.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function b64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJwt(payload: Record<string, unknown>, apiKey: string, secret: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const unsigned = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${b64url(signature)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401)
  const accessToken = auth.slice(7).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const apiKey = Deno.env.get('LIVEKIT_API_KEY') ?? ''
  const secret = Deno.env.get('LIVEKIT_API_SECRET') ?? ''
  const wsUrl = Deno.env.get('LIVEKIT_URL') ?? ''
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase not configured' }, 500)
  if (!apiKey || !secret || !wsUrl) return json({ error: 'Calling is not configured' }, 503)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
  if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)
  const uid = authData.user.id

  let payload: { chatId?: string; roomName?: string } = {}
  try { payload = await req.json() } catch { return json({ error: 'Invalid body' }, 400) }
  const { chatId, roomName } = payload
  if (!chatId || !UUID.test(chatId) || !roomName || !/^[A-Za-z0-9_-]{6,64}$/.test(roomName)) {
    return json({ error: 'Invalid call request' }, 400)
  }

  const { data: task } = await userClient.from('tasks').select('host_id, status').eq('id', chatId).maybeSingle()
  if (!task || !['open', 'full'].includes(task.status)) return json({ error: 'Activity not found or inactive' }, 404)
  let member = task.host_id === uid
  if (!member) {
    const { data: request } = await userClient
      .from('join_requests').select('id')
      .eq('task_id', chatId).eq('requester_id', uid).eq('status', 'accepted').maybeSingle()
    member = Boolean(request)
  }
  if (!member) return json({ error: 'Only members can join this call' }, 403)

  const { data: profile } = await userClient.from('profiles').select('display_name').eq('id', uid).maybeSingle()
  const now = Math.floor(Date.now() / 1000)
  const token = await signJwt({
    exp: now + 4 * 3600, // 4h — long calls and reconnects stay valid without re-minting
    iss: apiKey,
    sub: `comewme-${uid}`, // participant identity must be unique per member
    name: profile?.display_name || 'Come w’ me member',
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  }, apiKey, secret)

  return json({ url: wsUrl, token })
})
