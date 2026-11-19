import { useEffect, useRef, useState } from 'react'
import { Bell, Share2, Smartphone, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'

const DISMISSED_KEY = 'comewme:install-prompt-dismissed'

/**
 * Bold on-screen nudge shown on sign-in: if the app isn't on the phone yet,
 * ask to install it; once it is, ask for pop-up notifications. Always
 * dismissible with the X — but surfaces again on the next fresh session.
 */
export default function InstallPrompt() {
  const { session } = useAuth()
  const { status: pushStatus, busy: pushBusy, requestPermissionAndRegister, error: pushError } = usePushNotifications()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const deferredPrompt = useRef<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as unknown as typeof deferredPrompt.current
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())

  // Never interrupt what is already done.
  if (!session || dismissed) return null
  if (isStandalone && pushStatus === 'enabled') return null
  if (!isStandalone && pushStatus === 'enabled') return null

  const isPushConfigured = pushStatus !== 'not-configured'
  // Inside an installed app we only push once push can work; in a browser we always offer install.
  if (isStandalone && !isPushConfigured) return null
  const mode: 'install' | 'push' = isStandalone ? 'push' : 'install'

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Private mode — fine, it lasts this session either way.
    }
    setDismissed(true)
  }

  const handleNativePrompt = async () => {
    const prompt = deferredPrompt.current
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    deferredPrompt.current = null
    dismiss()
  }

  const handleEnablePush = async () => {
    const ok = await requestPermissionAndRegister()
    if (ok) dismiss()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-prompt-title"
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[26px] bg-white shadow-lift"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Dismiss this notice"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50"
        >
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>

        {mode === 'install' ? (
          <>
            <div className="relative w-full overflow-hidden bg-gradient-to-br from-[#fff8e9] via-[#fffdf8] to-[#f8eee3]">
              <div className="absolute -right-7 -top-8 h-36 w-36 rounded-full bg-sun/20 blur-2xl" />
              <div className="absolute -left-5 bottom-2 h-28 w-28 rounded-full bg-amber/10 blur-2xl" />
              <div className="relative flex aspect-[16/10] items-center justify-center gap-5 px-8">
                {/* Stylised phone home screen with the app icon */}
                <svg viewBox="0 0 140 190" className="h-44 w-32 shrink-0 drop-shadow-lg" role="img" aria-label="Come w' me on your home screen">
                  <rect x="4" y="2" width="132" height="186" rx="26" fill="#0b0b0f" />
                  <rect x="10" y="8" width="120" height="174" rx="20" fill="url(#screenGrad)" />
                  <defs>
                    <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#FFD93D" />
                      <stop offset="1" stopColor="#FF9F1C" />
                    </linearGradient>
                  </defs>
                  <rect x="58" y="15" width="24" height="8" rx="4" fill="#0b0b0f" />
                  <rect x="16" y="26" width="14" height="4" rx="1.5" fill="#0b0b0f" opacity="0.65" />
                  <rect x="104" y="26" width="18" height="4" rx="1.5" fill="#0b0b0f" opacity="0.65" />
                  <g transform="translate(35, 96)">
                    <rect width="70" height="70" rx="17" fill="#0b0b0f" />
                    <path d="M22 36c4-6 11-9 18-7 4 2 6 5 11 4 3-1 5-4 10-1" stroke="#FFD93D" strokeWidth="4.4" strokeLinecap="round" fill="none" />
                    <circle cx="24" cy="46" r="3.3" fill="#FFD93D" />
                    <circle cx="46" cy="47" r="3.3" fill="#FFD93D" />
                  </g>
                </svg>
              </div>
            </div>
            <div className="px-5 pb-5 pt-4 text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-amber">
                Install the app
              </p>
              <h2 id="install-prompt-title" className="mt-1.5 font-display text-[24px] font-bold leading-tight text-ink">
                Save Come w&apos; me to your home screen
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                It opens full-screen like a real app, remembers you, and can ping you about chats, join requests and reminders even when it&apos;s closed.
              </p>
              {isIOS ? (
                <ol className="mt-4 space-y-2 rounded-[18px] border border-line bg-canvas p-3.5 text-left">
                  <li className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-canvas">1</span>
                    <span>Tap the <Share2 size={14} className="-mt-0.5 inline text-amber" aria-hidden /> Share button at the bottom of Safari</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-canvas">2</span>
                    <span>Scroll down and tap <span className="text-amber">“Add to Home Screen”</span></span>
                  </li>
                  <li className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-canvas">3</span>
                    <span>Open Come w&apos; me from your home screen — you&apos;re already signed in</span>
                  </li>
                </ol>
              ) : (
                <button type="button" onClick={() => void handleNativePrompt()} className="btn-primary mt-4 w-full">
                  <Smartphone size={18} aria-hidden />
                  Add to Home Screen
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-sun via-[#fff4d1] to-canvas">
              <span className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white shadow-lift">
                <Bell size={44} className="text-amber" strokeWidth={2.1} aria-hidden />
              </span>
            </div>
            <div className="px-5 pb-5 pt-4 text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-amber">
                Pop-up notifications
              </p>
              <h2 id="install-prompt-title" className="mt-1.5 font-display text-[24px] font-bold leading-tight text-ink">
                Never miss a ping again
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Chat messages, join requests and reminders reach your phone even with the app closed — just like a real app.
              </p>
              {pushError ? (
                <p role="alert" className="mt-3 rounded-xl border border-[#edd996] bg-[#fff4d1] px-3.5 py-2 text-left text-[13px] leading-relaxed text-[#7a622f]">
                  {pushError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleEnablePush()}
                disabled={pushBusy}
                className="btn-primary mt-4 w-full"
              >
                {pushBusy ? 'Turning on…' : 'Turn on notifications'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
