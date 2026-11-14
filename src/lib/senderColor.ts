/**
 * Stable per-person colour so group chats read at a glance, WhatsApp-style.
 * Same id always maps to the same hue; dark enough to sit on light bubbles.
 */
const PALETTE = [
  '#B91C1C', // red
  '#C2410C', // deep orange
  '#A16207', // dark yellow
  '#15803D', // green
  '#0F766E', // teal
  '#0369A1', // sky
  '#4338CA', // indigo
  '#7C3AED', // violet
  '#9D174D', // rose
  '#3F4A8A', // slate blue
] as const

export function senderColorHex(id: string | null | undefined): string {
  if (!id) return '#6B6B76'
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** Translucent tint of the same hue, for the WhatsApp-style reply highlight. */
export function senderColorTint(id: string | null | undefined): string {
  return `${senderColorHex(id)}1A` // ~10% alpha
}
