// Demo data for Come w' me.
//
// Run with:  node --env-file=.env scripts/seed.mjs
//
// Uses the SERVICE ROLE key, which bypasses row-level security. That is the point:
// this script creates auth users directly, which a browser client can never do.
// Delete the demo users before you invite real people.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('\nMissing env vars. Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env\n')
  process.exit(1)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const DAY = 86_400_000
const at = (days, hour) => {
  const d = new Date(Date.now() + days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const avatar = (seed) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=FFD93D,FF9F1C,FAFAF7`

const people = [
  {
    email: 'chidi@comewme.demo',
    display_name: 'Chidi Okonkwo',
    username: 'chidi_o',
    area: 'Yaba',
    bio: 'Always up for a market run or a long walk.',
    interests: ['market_run', 'food', 'event'],
  },
  {
    email: 'amaka@comewme.demo',
    display_name: 'Amaka Balogun',
    username: 'amaka_b',
    area: 'Ikeja',
    bio: 'Food first. Ask me about buffet deals.',
    interests: ['food', 'event', 'errands'],
  },
  {
    email: 'tunde@comewme.demo',
    display_name: 'Tunde Adeyemi',
    username: 'tunde_dev',
    area: 'Surulere',
    bio: 'Backend dev. Building things in public.',
    interests: ['dev', 'study', 'ride'],
  },
  {
    email: 'zainab@comewme.demo',
    display_name: 'Zainab Yusuf',
    username: 'zainab_y',
    area: 'Lekki',
    bio: 'Maths tutor. Will explain differential equations twice.',
    interests: ['study', 'ride', 'food'],
  },
]

const activities = [
  {
    host: 0,
    title: 'Need 2 people for a Balogun market run',
    description:
      'Carrying stock back and I need two pairs of hands plus good company. We go early, we finish before the crowd gets heavy.',
    category: 'market_run',
    area: 'Lagos Island',
    meeting_point: 'Balogun Market main gate, Idumota',
    when: [1, 8],
    spots_needed: 2,
  },
  {
    host: 1,
    title: 'Trying the 3-for-1 buffet in Ikeja on Friday',
    description:
      'The deal is for three people and I have one friend who bailed. Come hungry, come ready to eat your money back.',
    category: 'food',
    area: 'Ikeja',
    meeting_point: 'Ikeja City Mall, main entrance',
    when: [2, 18],
    spots_needed: 2,
  },
  {
    host: 2,
    title: '5 devs to jam on an app idea',
    description:
      'Two hours at a café, no pitch decks, just building. Frontend, backend, design, whatever you do. Bring your laptop.',
    category: 'dev',
    area: 'Yaba',
    meeting_point: 'Yaba tech hub, Herbert Macaulay Way',
    when: [3, 16],
    spots_needed: 4,
  },
  {
    host: 3,
    title: 'Need someone to break down differential equations',
    description:
      'Exam in two weeks and I am stuck on second order ODEs. Happy to pay for the time or buy lunch, your call.',
    category: 'study',
    area: 'Lekki',
    meeting_point: 'Lekki Phase 1, coffee shop by the roundabout',
    when: [4, 11],
    spots_needed: 1,
  },
  {
    host: 0,
    title: 'Ride from Ajah to Yaba tomorrow morning',
    description:
      'Leaving around 7, traffic on that route is brutal alone. Split the fare, share the playlist.',
    category: 'ride',
    area: 'Ajah',
    meeting_point: 'Ajah bus terminal, by the roundabout',
    when: [1, 7],
    spots_needed: 3,
  },
  {
    host: 2,
    title: 'Going for the tech meetup in VI, let us go together',
    description:
      'Doors open at 5. I hate walking into those rooms alone and I know I am not the only one.',
    category: 'event',
    area: 'Victoria Island',
    meeting_point: 'Landmark Centre, main gate',
    when: [5, 17],
    spots_needed: 3,
  },
  {
    host: 1,
    title: 'Need 2 people for a Surulere market run',
    description:
      'Provisions shopping. One hour max if we move fast, then suya on the way back.',
    category: 'market_run',
    area: 'Surulere',
    meeting_point: 'Surulere shopping complex entrance',
    when: [6, 9],
    spots_needed: 2,
  },
  {
    host: 3,
    title: 'Board game evening in Yaba, need 3 more',
    description:
      'Catan, chess, and whatever you bring. Low stakes, good conversation. First timers welcome.',
    category: 'event',
    area: 'Yaba',
    meeting_point: 'Yaba, café on Montgomery Road',
    when: [7, 19],
    spots_needed: 3,
    is_sponsored: true,
    sponsor_name: 'Board Room Lagos',
  },
]

async function upsertPerson(p, index) {
  const email = p.email
  const password = 'password123'

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  let id
  if (error) {
    if (/already/i.test(error.message)) {
      const { data: list } = await db.auth.admin.listUsers()
      id = list?.users?.find((u) => u.email === email)?.id
      if (!id) throw new Error(`User ${email} exists but could not be found`)
    } else {
      throw error
    }
  } else {
    id = created.user.id
  }

  const { error: profileError } = await db.from('profiles').upsert({
    id,
    display_name: p.display_name,
    username: p.username,
    avatar_url: avatar(p.display_name),
    area: p.area,
    city: 'Lagos',
    bio: p.bio,
    interests: p.interests,
    tasks_completed: 3 + index,
    trust_score: 40 + index * 12,
    verification_status: index === 0 ? 'verified' : 'unverified',
  })
  if (profileError) throw profileError

  return { ...p, id }
}

async function main() {
  console.log('\nSeeding Come w\' me...\n')

  const created = []
  for (let i = 0; i < people.length; i++) {
    const person = await upsertPerson(people[i], i)
    created.push(person)
    console.log(`  user  ${person.display_name}  <${person.email}>`)
  }

  const { data: existing } = await db.from('tasks').select('title')
  const have = new Set((existing ?? []).map((t) => t.title))

  let added = 0
  for (const a of activities) {
    if (have.has(a.title)) continue

    const host = created[a.host]
    const { error } = await db.from('tasks').insert({
      host_id: host.id,
      host_name: host.display_name,
      host_avatar_url: avatar(host.display_name),
      title: a.title,
      description: a.description,
      category: a.category,
      area: a.area,
      city: 'Lagos',
      meeting_point: a.meeting_point,
      date_time: at(a.when[0], a.when[1]),
      spots_needed: a.spots_needed,
      is_sponsored: a.is_sponsored ?? false,
      sponsor_name: a.sponsor_name ?? null,
    })
    if (error) throw error
    added++
  }

  console.log(`\n  ${added} activities added, ${activities.length - added} already present`)
  console.log('\nDone. Sign in with any demo email and password: password123')
  console.log('Delete the demo users before inviting real people.\n')
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message, '\n')
  process.exit(1)
})
