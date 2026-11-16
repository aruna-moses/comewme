import { useEffect } from 'react'
import { isSupported, onMessage } from 'firebase/messaging'
import { isFirebaseConfigured, messagingOrNullSafe } from '../lib/firebase'

/**
 * iOS routes foreground web pushes through the page instead of the service
 * worker, so without an onMessage handler they never appear on screen.
 * This mirrors the service-worker banner — same title, body, icon, the same
 * per-chat tag with renotify — so foreground and background behave alike.
 * Muted groups never reach this (send-push suppresses them server-side).
 */
export function useForegroundPush() {
  useEffect(() => {
    if (!isFirebaseConfigured()) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      if (!window.localStorage.getItem('comewme-fcm-token')) return
    } catch {
      return // no token stored — nothing to react to
    }
    const messaging = messagingOrNullSafe()
    if (!messaging) return

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void (async () => {
      let supported = false
      try {
        supported = await Promise.race([
          isSupported(),
          new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 8000)),
        ])
      } catch {
        supported = false
      }
      if (!supported || cancelled) return
      try {
        unsubscribe = onMessage(messaging, (payload) => {
          if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
          const data = (payload?.data ?? {}) as { title?: string; body?: string; url?: string }
          const url = data.url ?? '/'
          navigator.serviceWorker.ready
            .then((registration) =>
              registration.showNotification(data.title ?? "Come w' me", {
                body: data.body ?? '',
                icon: '/logo.png',
                badge: '/logo.png',
                data: { url },
                tag: url, // one slot per conversation — replaces, never piles up
                renotify: true, // and still re-alerts every message
              } as NotificationOptions & { renotify: boolean }),
            )
            .catch(() => {
              // platform refused the banner — nothing else to surface
            })
        })
      } catch {
        // best effort — foreground banners are an enhancement, not a gate
      }
    })()

    return () => {
      cancelled = true
      try {
        unsubscribe?.()
      } catch {
        // ignore
      }
    }
  }, [])
}
