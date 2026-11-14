import { CATEGORIES } from '../types'
const WAT_OFFSET_MINUTES = 60 // West Africa Time is UTC+1, no daylight saving

/** Format an ISO timestamp in Lagos local time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const wat = new Date(d.getTime() + WAT_OFFSET_MINUTES * 60_000)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h24 = wat.getUTCHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const mins = String(wat.getUTCMinutes()).padStart(2, '0')
  const suffix = h24 < 12 ? 'AM' : 'PM'
  return `${days[wat.getUTCDay()]}, ${wat.getUTCDate()} ${
    months[wat.getUTCMonth()]
  } · ${h12}:${mins} ${suffix}`
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", or a short date. */
export function relativeDay(iso: string): string {
  const now = new Date()
  const target = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 6) return `In ${diff} days`
  return formatDateTime(iso).split(' · ')[0]
}

export function timeOfDay(iso: string): string {
  return formatDateTime(iso).split(' · ')[1] ?? ''
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

/** Short clock time for chat bubbles, e.g. "8:42 PM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Compact task-type emoji for chat-list avatar chips / previews. */
export function taskEmoji(category: string): string {
  // Read directly from the shared registry so the emoji always matches the chip
  return CATEGORIES.find((c) => c.value === category)?.emoji ?? '📍'
}

const TILE_BG: Record<string, string> = {
  market_run: 'bg-[#e4f4ef]',
  ride: 'bg-[#e8eef7]',
  food: 'bg-[#ffebdc]',
  study: 'bg-[#f1ecfa]',
  dev: 'bg-[#e8eef7]',
  event: 'bg-[#fdeef3]',
  errands: 'bg-[#e4f4ef]',
  other: 'bg-[#f1f1ef]',
  movies: 'bg-[#fdeef3]',
  sports: 'bg-[#eaf6ee]',
  gym: 'bg-[#eef4fb]',
  outdoors: 'bg-[#f5f0f8]',
  music: 'bg-[#fcf0f5]',
  arts: 'bg-[#fff3e8]',
  fashion: 'bg-[#fcf0f5]',
  faith: 'bg-[#eef7f5]',
  volunteer: 'bg-[#eaf6ee]',
  pets: 'bg-[#fff3e8]',
  wellness: 'bg-[#f1ecfa]',
  gaming: 'bg-[#eef4fb]',
  travel: 'bg-[#eaf6ee]',
  nightlife: 'bg-[#fdeef3]',
  shopping: 'bg-[#f5f0f8]',
  social: 'bg-[#fff3e8]',
  health: 'bg-[#eef7f5]',
  repair: 'bg-[#f1f1ef]',
}

/** Deterministic pastel background for the circular chat-list thumbnail. */
export function categoryTileBg(category: string): string {
  return TILE_BG[category] ?? 'bg-[#f1f1ef]'
}

/** Same-day check for chat date separators. */
export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const t = new Date()
  d.setHours(0, 0, 0, 0)
  t.setHours(0, 0, 0, 0)
  return d.getTime() === t.getTime()
}
export function isSameDay(a: string, b: string): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export function isWithin24h(iso: string): boolean {
  const t = new Date(iso).getTime()
  return t > Date.now() && t < Date.now() + 86_400_000
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
