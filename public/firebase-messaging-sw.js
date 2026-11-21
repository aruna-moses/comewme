// Background push handler for "Come w' me".
// Loaded by the browser from the SW scope, so it runs even when the app is closed.
// The config below must match the Firebase project set in .env (VITE_FIREBASE_*).
// For offline safety we load the compat SDK from Google's CDN.

// ---------- set these to your Firebase web app config ----------
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBUwJ2xJIpu1_ANmJTUNCKYFAwNZx4uMhk',
  authDomain: 'comewme-push.firebaseapp.com',
  projectId: 'comewme-push',
  storageBucket: 'comewme-push.firebasestorage.app',
  messagingSenderId: '205882745478',
  appId: '1:205882745478:web:a8d7802e08fe0fcfe62707',
}
// ----------------------------------------------------------------

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

if (FIREBASE_CONFIG.apiKey.startsWith('REPLACE_WITH')) {
  // Messaging not configured yet — acknowledge pushes silently and skip wiring.
  console.info("[Come w' me SW] Firebase messaging not configured yet. Fill FIREBASE_CONFIG in firebase-messaging-sw.js and .env to enable push.")
} else {
  // Self-hosted compat SDK — some mobile networks block gstatic.com; without these,
  // the service worker never activates and pushes silently fail.
  self.importScripts('/sw-compat/firebase-app-compat.js', '/sw-compat/firebase-messaging-compat.js')

  firebase.initializeApp(FIREBASE_CONFIG)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const data = (payload && payload.data) || {}
    const title = data.title || "Come w' me"
    const body = data.body || ''
    const url = data.url || '/'
    const isCall = data.type === 'incoming_call' || /[?&]joinCall=/.test(url)

    // Incoming calls get a persistent, actionable banner where the platform
    // supports it (Android/Chrome). iOS shows the normal sound+lockscreen alert.
    if (isCall) {
      self.registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url, type: 'incoming_call', callId: data.callId || '' },
        tag: `call-${data.callId || url}`,
        renotify: true,
        requireInteraction: true,
        sound: 'default',
        vibrate: [350, 180, 350, 180, 350, 1200],
        actions: [
          { action: 'decline', title: 'Decline' },
          { action: 'accept', title: 'Accept' },
        ],
      })
      return
    }

    // One banner slot per conversation, re-alerted on every message —
    // like WhatsApp. No shared '<app>-push' tag that quietly swallows updates.
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url },
      tag: url,
      renotify: true,
      sound: 'default',
    })
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const stored = (event.notification.data && event.notification.data.url) || '/'
    const action = event.action || ''
    let target = stored
    if (action === 'decline') {
      const u = new URL(stored, self.location.origin)
      const callId = u.searchParams.get('joinCall')
      u.searchParams.delete('joinCall')
      if (callId) u.searchParams.set('declineCall', callId)
      target = u.pathname + u.search
    }

    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of allClients) {
          if (client.url.startsWith(self.location.origin)) {
            try {
              await client.focus()
              if ('navigate' in client) await client.navigate(target)
              return
            } catch {
              // fall through to openWindow
            }
          }
        }
        await self.clients.openWindow(target)
      })(),
    )
  })
}
