import { useEffect } from 'react'

/**
 * iOS routes foreground web pushes through the page instead of the service
 * worker, so without an onMessage handler they never appear on screen.
 * Firebase is code-split — most people never run this block, so the SDK
 * loads only when push is actually switched on for this device.
 */
export function useForegroundPush() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      if (!window.localStorage.getItem('comewme-fcm-token')) return
    } catch {
      return // no token stored — nothing to react to
    }

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void (async () => {
      const [{ isSupported, onMessage }, { isFirebaseConfigured, messagingOrNullSafe }] =
        await Promise.all([import('firebase/messaging'), import('../lib/firebase')])
      if (!isFirebaseConfigured() || cancelled) return
      const messaging = messagingOrNullSafe()
      if (!messaging || cancelled) return

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
