// Ringing feedback for incoming activity calls: a soft repeating tone plus
// vibration where the platform supports it. No audio assets needed.
//
// iOS only allows Web Audio to start inside a real user gesture. We unlock the
// audio context on the first tap/keypress in the app, so when a call arrives
// later (often from the background) the ringtone can actually play.

let ctx: AudioContext | null = null
let toneTimer: number | null = null
let vibrateTimer: number | null = null
let unlocked = false

/** Call once when the app mounts. The first real interaction unlocks audio. */
export function unlockRinger(): void {
  if (unlocked || typeof document === 'undefined') return
  const onGesture = () => {
    try {
      ctx ??= new AudioContext()
      // a silent one-frame buffer is enough to satisfy the autoplay policy
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
      void ctx.resume()
      unlocked = true
    } catch {
      // audio is an enhancement — never break the app
    }
    document.removeEventListener('pointerdown', onGesture)
    document.removeEventListener('touchend', onGesture)
    document.removeEventListener('keydown', onGesture)
  }
  document.addEventListener('pointerdown', onGesture, { passive: true })
  document.addEventListener('touchend', onGesture, { passive: true })
  document.addEventListener('keydown', onGesture)
}

function beep() {
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sine'
    osc.frequency.setValueAtTime(740, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.4)
  } catch {
    // ignore
  }
}

export function startRinging(): void {
  stopRinging()
  try {
    navigator.vibrate?.([350, 180, 350, 180, 350, 1200])
    vibrateTimer = window.setInterval(() => navigator.vibrate?.([350, 180, 350, 1200]), 2500)
  } catch {
    // iOS Safari doesn't expose vibration — the tone still works
  }
  try {
    ctx ??= new AudioContext()
    void ctx.resume().catch(() => undefined)
    beep()
    toneTimer = window.setInterval(beep, 1800)
  } catch {
    // ignore
  }
}

export function stopRinging(): void {
  if (toneTimer !== null) window.clearInterval(toneTimer)
  if (vibrateTimer !== null) window.clearInterval(vibrateTimer)
  toneTimer = null
  vibrateTimer = null
  try { navigator.vibrate?.(0) } catch { /* ignore */ }
  // keep the context running so it stays unlocked for the next call
}
