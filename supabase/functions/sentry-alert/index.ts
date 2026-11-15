// Sentry issue alert -> moderation inbox, with push via the existing pipeline.
//
// One-time setup:
//   1) supabase secrets set SENTRY_ALERT_SECRET=<random string>
//   2) supabase functions deploy sentry-alert --no-verify-jwt
//   3) Sentry → Project → Alerts → Create Alert → "A new issue is created"
//      → Action: "Send a notification via Webhook" (Internal Integration)
//      → URL: https://<PROJECT_REF>.supabase.co/functions/v1/sentry-alert?secret=<SENTRY_ALERT_SECRET>
//
// On a new issue:
//   1) inserts public.admin_alerts (deduped by sentry_issue_id)
//   2) fans out one 'info' notification per moderator → DB webhook → send-push → phones

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const secret = url.searchParams.get('secret') ?? req.headers.get('x-alert-secret') ?? ''
  const expected = Deno.env.get('SENTRY_ALERT_SECRET') ?? ''
  if (!expected || secret !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: Record<string, unknown> | null = null
  try {
    payload = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const data = (payload?.data ?? payload ?? {}) as Record<string, unknown>
  const event = (data?.event ?? {}) as Record<string, unknown>

  // Defensive extraction — Sentry's issue-alert payload shape has shifted over time.
  const title = String(
    event?.title ?? event?.name ?? event?.message ?? data?.title ?? 'Crash reported',
  ).slice(0, 140)
  const webUrl = (event?.web_url ?? event?.webUrl ?? data?.web_url ?? null) as string | null
  const level = String(event?.level ?? data?.level ?? 'error').toLowerCase()
  const culprit = event?.culprit ? String(event.culprit).slice(0, 140) : null
  const issue = (event?.issue ?? {}) as Record<string, unknown>
  const issueId =
    issue?.id != null ? String(issue.id)
    : event?.group_id != null ? String(event.group_id)
    : event?.event_id != null ? String(event.event_id)
    : null

  // Without an issue id, dedupe on the normalized title instead of spamming the inbox.
  const stableIssueId =
    issueId ?? `title:${title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)}`
  const issueKey = stableIssueId.slice(0, 200)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: inserted, error } = await supabase
    .from('admin_alerts')
    .insert({
      sentry_issue_id: issueKey,
      level,
      title,
      culprit,
      url: webUrl,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // Unique violation = same issue re-fired. Dedupe: ack, but do not re-notify.
    const code = (error as { code?: string }).code ?? ''
    if (code === '23505') {
      return json({ ok: true, deduped: true })
    }
    console.error('admin_alerts insert failed', error)
    return new Response('Database error', { status: 500 })
  }

  const { data: mods, error: modErr } = await supabase.from('moderators').select('user_id')
  if (modErr) {
    console.error('moderators read failed', modErr)
    return json({ ok: true, inserted: inserted?.id ?? null, notified: 0 })
  }

  const rows = (mods ?? []).map((m: { user_id: string }) => ({
    user_id: m.user_id,
    type: 'info',
    title: 'System alert',
    body: level === 'fatal' ? `Fatal: ${title}` : `Crash: ${title}`,
    link_path: '/admin/moderation',
  }))

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('notifications').insert(rows)
    if (insErr) console.error('moderator notifications fanout failed', insErr)
  }

  return json({ ok: true, inserted: inserted?.id ?? null, notified: rows.length })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
