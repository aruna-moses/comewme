import { useEffect, useState } from 'react'

/**
 * Full-screen check rollers are jarring — they flash for 30-100ms on every
 * fast network and shout "please wait" to the user for nothing. Delaying the
 * visual by ~150ms means sub-second loads never show it. Slower loads show
 * the exact same spinner, just a little later.
 */
export default function Spinner({ full = false }: { full?: boolean }) {
  const [visible, setVisible] = useState(!full) // inline spinners keep showing immediately

  useEffect(() => {
    if (!full) return
    const t = window.setTimeout(() => setVisible(true), 150)
    return () => window.clearTimeout(t)
  }, [full])

  const dot = (
    <span className="block h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-amber" />
  )

  if (!full) return <div className="flex justify-center py-8">{dot}</div>

  // The background canvas is painted immediately; the spinner only appears
  // for loads slower than ~150ms.
  if (!visible) return <div className="min-h-screen bg-canvas" aria-hidden />

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        {dot}
        <p className="font-display text-sm font-semibold text-muted">Come w' me</p>
      </div>
    </div>
  )
}
