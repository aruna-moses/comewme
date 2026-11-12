/**
 * Tiny sound kit — no audio files, everything synthesised on the spot.
 * Browsers block audio until the user interacts with the page, so we lazily
 * create the context and resume it on the first tap/keystroke.
 */

type Ctor = typeof AudioContext

const ctor = (): Ctor | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext

let ctx: AudioContext | null = null

export function unlockAudio(): boolean {
  const Ctor = ctor()
  if (!Ctor) return false
  try {
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx.state !== 'suspended'
  } catch {
    return false
  }
}

function tone(
  frequency: number,
  offsetSec: number,
  duration = 0.24,
  peak = 0.18,
  type: OscillatorType = 'sine',
) {
  if (!unlockAudio()) return
  const c = ctx
  if (!c || c.state !== 'running') return
  const now = c.currentTime
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, now + offsetSec)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, now + offsetSec)
  gain.gain.exponentialRampToValueAtTime(peak, now + offsetSec + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + offsetSec + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(now + offsetSec)
  osc.stop(now + offsetSec + duration + 0.03)
}

/** Soft two-note chime for incoming notifications. */
export function playReceive(): void {
  tone(880, 0)
  tone(1318.5, 0.13)
}

/** Crisp pop for sending a message, plays instantly. */
export function playSend(): void {
  tone(720, 0, 0.07, 0.16, 'triangle')
  tone(1080, 0.06, 0.1, 0.1, 'sine')
}
