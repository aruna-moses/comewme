// Supabase Edge Function: push.notify
// Triggered by a Database Webhook on `public.notifications` INSERT.
// Delivery: FCM v1 HTTP API (works for Android Chrome, Desktop Chrome/Brave, and
// iOS PWAs on iOS 16.4+).
//
// Webhook config must have:
//   - Type: HTTP Request
//   - URL: https://<project-ref>.supabase.co/functions/v1/send-push
//   - Method: POST
//   - Headers: Authorization: Bearer <service_role_key>   (use the "Add auth header
//     with service key" checkbox — it fills this in automatically)
//   - Timeout: 1500 ms

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---- FCM v1 service-account JWT -> access token ----

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

function b64url(data: string | ArrayBuffer): string {
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
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
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
  const data = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data),
  )
  const jwt = `${data}.${b64url(signature)}`

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
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
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
          webpush: {
            notification: { icon: '/logo.png', badge: '/logo.png' },
            fcmOptions: { link: url },
            headers: { Urgency: 'high' },
          },
        },
      }),
    },
  )
  if (res.ok) return { ok: true, unregistered: false }

  const errText = await res.text()
  const unregistered =
    errText.includes('UNREGISTERED') || errText.includes('NOT_FOUND')
  console.error('push send failed', { status: res.status, body: errText.slice(0, 300) })
  return { ok: false, unregistered }
}

serve(async (req) => {
  // Webhook authentication: "Add auth header with service key" sets this up.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const incoming = req.headers.get('authorization') ?? ''
  if (!serviceKey || incoming !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Body from Database Webhook:
  // { type: 'INSERT', table: 'notifications', record: { user_id, title, body, link_path } }
  let payload: {
    type?: string
    table?: string
    record?: { user_id?: string; title?: string; body?: string; link_path?: string | null }
    // Also support invoking the function directly:
    userId?: string
    title?: string
    body?: string
    url?: string
  } = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  let userId = payload.record?.user_id ?? payload.userId
  let title = payload.record?.title ?? payload.title ?? "Come w' me"
  let body = payload.record?.body ?? payload.body ?? ''
  let url = payload.record?.link_path ?? payload.url ?? '/'

  if (!userId) {
    return new Response(JSON.stringify({ error: 'No userId in payload' }), { status: 400 })
  }

  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!saRaw) {
    return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT secret is not set' }), { status: 500 })
  }
  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw)
  } catch {
    return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT is not valid JSON' }), { status: 500 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const db = createClient(supabaseUrl, supabaseKey)

  const { data: rows, error } = await db
    .from('user_push_tokens')
    .select('token')
    .eq('user_id', userId)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const tokens = (rows ?? []).map((r: { token: string }) => r.token)
  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, pruned: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const accessToken = await getFcmAccessToken(sa)

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
    headers: { 'content-type': 'application/json' },
  })
})
