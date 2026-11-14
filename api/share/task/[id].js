const DEFAULT_SITE_URL = 'https://comewme.vercel.app'

// Emoji-safe category registry. Uses unicode escapes so the share page renders
// the glyph regardless of transport or filesystem encoding.
const CATEGORY_LABELS = {
  market_run: '\u{1F6D2} Market run',
  ride: '\u{1F697} Rides',
  food: '\u{1F37D} Food',
  study: '\u{1F4DA} Study',
  dev: '\u{1F4BB} Skill meetups',
  event: '\u{1F389} Events',
  errands: '\u{1F4E6} Errands',
  movies: '\u{1F3AC} Movies',
  sports: '\u26BD Sports',
  gym: '\u{1F4AA} Gym & Fitness',
  outdoors: '\u{1F3D5} Outdoors',
  music: '\u{1F3B5} Music',
  arts: '\u{1F3A8} Art & Culture',
  fashion: '\u{1F457} Fashion',
  faith: '\u{1F64F} Faith & Community',
  volunteer: '\u{1F91D} Charity',
  pets: '\u{1F43E} Pets',
  wellness: '\u{1F9D8} Wellness',
  gaming: '\u{1F3AE} Gaming',
  travel: '\u2708\uFE0F Travel & Trips',
  nightlife: '\u{1F303} Nightlife',
  shopping: '\u{1F6CD} Shopping',
  social: '\u{1F37A} Social',
  health: '\u{1FA7A} Health',
  repair: '\u{1F527} Repairs',
  other: '\u2795 Other',
}

function getSiteUrl() {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const configuredUrl = process.env.PUBLIC_SITE_URL
    || (vercelHost ? `${vercelHost.startsWith('http') ? '' : 'https://'}${vercelHost}` : DEFAULT_SITE_URL)
  const url = new URL(configuredUrl)

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('PUBLIC_SITE_URL must use HTTPS.')
  }

  return url.origin
}

function shorten(value, limit) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit - 1).trimEnd()}…`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function htmlPage({ title, description, taskUrl, shareUrl, siteUrl, statusCode = 200 }) {
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  const safeTaskUrl = escapeHtml(taskUrl)
  const safeShareUrl = escapeHtml(shareUrl)
  // Dynamic per-activity OG card — rendered on demand so every share preview
  // looks distinct instead of one banner for every activity.
  const sharePath = safeShareUrl.split('?')[0].split('/').filter(Boolean)
  const taskId = sharePath[sharePath.length - 1] ?? ''
  const imageUrl = taskId
    ? `${siteUrl}/share/task/${taskId}/card.svg?v=1`
    : `${siteUrl}/signin-banner.png?v=2`

  return {
    statusCode,
    body: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle} · Come w' me</title>
    <meta name="description" content="${safeDescription}">
    <link rel="canonical" href="${safeTaskUrl}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Come w' me">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${safeShareUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:type" content="image/svg+xml">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Come w' me — the activity, on one card">
    <meta property="og:locale" content="en_NG">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:image:alt" content="Come w' me — the activity, on one card">
    <meta http-equiv="refresh" content="1;url=${safeTaskUrl}">
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: #fafaf7; color: #0b0b0f; font: 16px system-ui, sans-serif; }
      main { width: min(100%, 440px); padding: 28px; border: 1px solid #ece9e2; border-radius: 22px; background: white; }
      .brand { color: #ee7b1e; font-size: 12px; font-weight: 800; letter-spacing: .16em; }
      h1 { margin: 14px 0 8px; font-size: 24px; line-height: 1.2; }
      p { color: #6b7280; line-height: 1.55; }
      a { display: inline-block; margin-top: 12px; padding: 13px 18px; border-radius: 14px; background: #ee7b1e; color: white; font-weight: 700; text-decoration: none; }
    </style>
    <script>window.location.replace(${JSON.stringify(taskUrl)})</script>
  </head>
  <body>
    <main>
      <div class="brand">COME W' ME</div>
      <h1>${safeTitle}</h1>
      <p>${safeDescription}</p>
      <a href="${safeTaskUrl}">View this activity</a>
    </main>
  </body>
</html>`,
  }
}

export default async function handler(request, response) {
  const taskId = request.query.id
  if (typeof taskId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    const siteUrl = DEFAULT_SITE_URL
    const result = htmlPage({
      title: 'Activity not found',
      description: 'This activity link is not valid. Find more activities on Come w’ me.',
      taskUrl: `${siteUrl}/`,
      shareUrl: `${siteUrl}/`,
      siteUrl,
      statusCode: 404,
    })
    return response.status(result.statusCode).setHeader('Content-Type', 'text/html; charset=utf-8').send(result.body)
  }

  let siteUrl
  try {
    siteUrl = getSiteUrl()
  } catch (error) {
    console.error('Task share preview has an invalid public site URL.', error)
    return response.status(503).send('Activity previews are temporarily unavailable.')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Task share preview is missing Supabase public configuration.')
    return response.status(503).send('Activity previews are temporarily unavailable.')
  }

  try {
    const query = new URLSearchParams({
      id: `eq.${taskId}`,
      select: 'title,description,area,date_time,category,spots_needed,spots_filled',
      limit: '1',
    })
    const result = await fetch(`${supabaseUrl}/rest/v1/tasks?${query}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })
    if (!result.ok) throw new Error(`Supabase returned ${result.status}`)

    const [task] = await result.json()
    if (!task) {
      const missing = htmlPage({
        title: 'Activity not found',
        description: 'This activity may have been removed. Find more activities on Come w’ me.',
        taskUrl: `${siteUrl}/`,
        shareUrl: `${siteUrl}/`,
        siteUrl,
        statusCode: 404,
      })
      return response.status(missing.statusCode).setHeader('Content-Type', 'text/html; charset=utf-8').send(missing.body)
    }

    const date = new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    }).format(new Date(task.date_time))
    const taskUrl = `${siteUrl}/task/${taskId}`
    const shareUrl = `${siteUrl}/share/task/${taskId}`
    const spotsLeft = Math.max(0, Number(task.spots_needed) - Number(task.spots_filled))
    const category = CATEGORY_LABELS[task.category] ?? '➕ Activity'
    const description = `${category} • ${task.area} • ${date} • ${spotsLeft}/${task.spots_needed} left — Come w' me`
    const page = htmlPage({
      title: `${category.split(' ')[0]} ${task.title}`.trim(),
      description: shorten(description, 300),
      taskUrl,
      shareUrl,
      siteUrl,
    })
    return response.status(page.statusCode).setHeader('Content-Type', 'text/html; charset=utf-8').send(page.body)
  } catch (error) {
    console.error('Could not load task share preview.', error)
    return response.status(502).send('Activity previews are temporarily unavailable.')
  }
}
