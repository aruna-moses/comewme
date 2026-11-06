import type { CharacterPersona } from '../types'

const PERSONA_IMAGE_NAMES: Record<CharacterPersona, string> = {
  tari: 'Tari',
  ibrahim: 'Ibrahim',
  zainab: 'Zainab',
  tunde: 'Tunde',
  runo: 'Runo',
  kemi: 'Kemi',
  ese: 'Ese',
  ngozi: 'Ngozi',
  david: 'David',
  maya: 'Maya',
  burna: 'Burna',
  chidi: 'Chidi',
}

export function personaImageSrc(persona: CharacterPersona) {
  return `/avatars/${PERSONA_IMAGE_NAMES[persona]}.png`
}

export function personaDisplayName(persona: CharacterPersona) {
  return PERSONA_IMAGE_NAMES[persona]
}
