// Dynamic OG image for a task: renders an SVG card unique to the activity.
// Vercel Image / OG generation without dependencies or a headless browser.

const DEFAULT_SITE_URL = 'https://comewme.vercel.app'

const CATEGORY_LABELS = {
  market_run: '🛒 Market run',
  ride: '🚗 Rides',
  food: '🍽️ Food',
  study: '📚 Study',
  dev: '💻 Skill meetups',
  event: '🎉 Events',
  errands: '📦 Errands',
  movies: '🎬 Movies',
  sports: '⚽ Sports',
  gym: '💪 Gym & Fitness',
  outdoors: '🏕️ Outdoors',
  music: '🎵 Music',
  arts: '🎨 Art & Culture',
  fashion: '👗 Fashion',
  faith: '🙏 Faith & Community',
  volunteer: '🤝 Charity',
  pets: '🐾 Pets',
  wellness: '🧘 Wellness',
  gaming: '🎮 Gaming',
  travel: '✈️ Travel & Trips',
  nightlife: '🌃 Nightlife',
  shopping: '🛍️ Shopping',
  social: '🍻 Social',
  health: '🩺 Health',
  repair: '🔧 Repairs',
  other: '➕ Other',
}

const EMOJI_PREFIX = (category) => (CATEGORY_LABELS[category] ?? '➕ Activity').split(' ')[0]
const LABEL_ONLY = (category) => (CATEGORY_LABELS[category] ?? '➕ Activity').split(' ').slice(1).join(' ')

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]))
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
  const s = String(value ?? '').replace(/\s+/g, ' ').trim()
  return s.length <= limit ? s : `${s.slice(0, limit - 1).trimEnd()}…`
}

export default async function handler(request, response) {
  const taskId = request.query.id
  if (typeof taskId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    return response.status(404).setHeader('Content-Type', 'image/svg+xml; charset=utf-8').send(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#FF9F1C"/></svg>`)
  }

  let siteUrl
  try {
    siteUrl = getSiteUrl()
  } catch {
    return response.status(503).send('unavailable')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return response.status(503).send('unavailable')
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
      return response.status(404).setHeader('Content-Type', 'image/svg+xml; charset=utf-8').send(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#FF9F1C"/></svg>`)
    }

    const date = new Intl.DateTimeFormat('en-NG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    }).format(new Date(task.date_time))

    const spotsLeft = Math.max(0, Number(task.spots_needed) - Number(task.spots_filled))
    const emoji = EMOJI_PREFIX(task.category)
    const label = LABEL_ONLY(task.category)
    const title = shorten(task.title, 44)
    const sub = `${label} · ${shorten(task.area || 'Lagos', 28)} · ${date} · ${spotsLeft}/${task.spots_needed} left`
    const safeTitle = escapeXml(title)
    const safeSub = escapeXml(sub)

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFD93D"/>
      <stop offset="0.5" stop-color="#FF9F1C"/>
      <stop offset="1" stop-color="#ee7b1e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="-120" r="420" fill="#ffffff" opacity="0.15"/>
  <circle cx="140" cy="720" r="380" fill="#ffffff" opacity="0.12"/>
  <text x="72" y="120" fill="#0B0B0F" style="font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:0.16em;font-size:26px;font-weight:800;" opacity="0.78">COME W' ME</text>
  <text x="980" y="120" fill="#0B0B0F" style="font-family:system-ui,sans-serif;font-size:24px;font-weight:800;letter-spacing:0.08em;" opacity="0.7" text-anchor="end">${escapeXml(label).toUpperCase().slice(0, 18)}</text>
  <text x="72" y="285" fill="#0B0B0F" style="font-family:system-ui,sans-serif;font-size:132px;">${emoji}</text>
  <text x="72" y="420" fill="#0B0B0F" style="font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:700;font-size:72px;letter-spacing:-1px;">${safeTitle}</text>
  <text x="72" y="500" fill="#0B0B0F" style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-weight:600;font-size:26px;letter-spacing:0.08em;" opacity="0.78">${safeSub}</text>
  <rect x="72" y="520" width="420" height="56" rx="28" fill="#0B0B0F"/>
  <text x="96" y="556" fill="#FFD93D" style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;font-size:24px;letter-spacing:0.04em;">SIGN IN TO JOIN →</text>
</svg>`

    response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=3600')
    return response.status(200).send(svg)
  } catch (error) {
    console.error('Could not render task share card.', error)
    return response.status(502).setHeader('Content-Type', 'image/svg+xml; charset=utf-8').send(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#FF9F1C"/></svg>`)
  }
}
