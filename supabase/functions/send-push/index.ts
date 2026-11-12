// Supabase Edge Function: send a push notification to one user.
// POST { userId, title, body, url? } — requires the service-role bearer token.
// Secrets needed (supabase secrets set ...):
//   FIREBASE_SERVICE_ACCOUNT = <firebase service-account JSON exactly as downloaded>
// Auto-available env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': 'https://comewme.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

type ServiceAccount = {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
}

function base64url(data: string | ArrayBuffer): string {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const data = `${header}.${payload}`

  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const binary = atob(pem)
  const keyBuffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(keyBuffer)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data),
  )
  const jwt = `${data}.${base64url(signature)}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`FCM auth failed: ${tokenRes.status} ${errText}`)
  }
  const tokenJson = await tokenRes.json()
  return tokenJson.access_token as string
}

async function sendToToken(
  sa: ServiceAccount,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  url: string,
): Promise<{ ok: boolean; unregistered: boolean }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url },
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high' },
          notification: { icon: '/logo.png', badge: '/logo.png' },
        },
      },
    }),
  })

  if (res.ok) return { ok: true, unregistered: false }

  const errText = await res.text()
  // UNREGISTERED / NOT_FOUND = dead device token → caller should prune it.
  const unregistered = errText.includes('UNREGISTERED') || errText.includes('NOT_FOUND')
  console.error('push send failed', { status: res.status, body: errText.slice(0, 300) })
  return { ok: false, unregistered }
}

async function handle(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const expected = `Bearer ${serviceKey}`
  if (!serviceKey || authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!saRaw) {
    return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT secret is not set' }), { status: 500, headers: CORS })
  }

  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw)
  } catch {
    return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT is not valid JSON' }), { status: 500, headers: CORS })
  }

  let payload: { userId?: string; title?: string; body?: string; url?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: CORS })
  }

  const { userId, title, body, url } = payload
  if (!userId || !title || !body) {
    return new Response(JSON.stringify({ error: 'userId, title and body are required' }), { status: 400, headers: CORS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const db = createClient(supabaseUrl, service)

  const { data: rows, error } = await db
    .from('user_push_tokens')
    .select('token')
    .eq('user_id', userId)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
  }

  const tokens = (rows ?? []).map((r: { token: string }) => r.token)
  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, pruned: 0 }), { status: 200, headers: { ...CORS, 'content-type': 'application/json' } })
  }

  let accessToken: string
  try {
    accessToken = await getFcmAccessToken(sa)
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'FCM auth failed' }), { status: 500, headers: CORS })
  }

  let sent = 0
  let pruned = 0
  for (const token of tokens) {
    const result = await sendToToken(sa, accessToken, token, title, body, url ?? '/')
    if (result.ok) {
      sent += 1
    } else if (result.unregistered) {
      pruned += 1
      await db.from('user_push_tokens').delete().eq('token', token)
    }
  }

  return new Response(JSON.stringify({ sent, pruned }), {
    status: 200,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  try {
    return await handle(req)
  } catch (e) {
    console.error('send-push edge function error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: CORS,
    })
  }
})
