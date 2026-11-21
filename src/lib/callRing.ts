// Ringing feedback for incoming activity calls: a soft repeating tone plus
// vibration where the platform supports it. No audio assets needed.

let ctx: AudioContext | null = null
let toneTimer: number | null = null
let vibrateTimer: number | null = null

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
    // audio is an enhancement — never break the call UI
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
    void ctx.resume()
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
  if (ctx) {
    try { void ctx.suspend() } catch { /* ignore */ }
  }
}
