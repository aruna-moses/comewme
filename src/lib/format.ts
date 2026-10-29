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
