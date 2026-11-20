import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { applyUpdate, onUpdateAvailable } from '../lib/appUpdate'

const DISMISS_KEY = 'comewme:update-dismissed'

/**
 * Quiet, one-line notice shown when a new build is live while the app is open.
 * Tapping Refresh is all it takes; if the person tabs away first, the update is
 * applied in the background and they never see this at all.
 */
export default function UpdateNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      // storage blocked — still fine to show the notice
    }
    return onUpdateAvailable(() => setVisible(true))
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-slide-down fixed left-1/2 top-3 z-[75] w-[92%] max-w-sm"
    >
      <div className="glass flex items-center gap-3 rounded-[22px] p-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0B0B0F]"
          style={{ backgroundImage: 'linear-gradient(180deg,#f7a233,#ee7b1e)' }}
        >
          <RefreshCw size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-tight text-ink">New version ready</p>
          <p className="text-[12px] leading-snug text-muted">Refresh to pick up the latest.</p>
        </div>
        <button type="button" onClick={applyUpdate} className="btn-primary btn-sm shrink-0 px-4">
          Refresh
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="-ml-1 shrink-0 rounded-full p-1 text-muted hover:bg-line hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
