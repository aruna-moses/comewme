// Background push handler for "Come w' me".
// Loaded by the browser from the SW scope, so it runs even when the app is closed.
// The config below must match the Firebase project set in .env (VITE_FIREBASE_*).
// For offline safety we load the compat SDK from Google's CDN.

// ---------- set these to your Firebase web app config ----------
const FIREBASE_CONFIG = {
  apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_YOUR_PROJECT.firebaseapp.com',
  projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId: 'REPLACE_WITH_YOUR_APP_ID',
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
  self.importScripts(
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
  )

  firebase.initializeApp(FIREBASE_CONFIG)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const notif = (payload && payload.notification) || {}
    const title = notif.title || "Come w' me"
    const body = notif.body || ''
    const icon = notif.icon || '/logo.png'
    const url = (payload && payload.fcmOptions && payload.fcmOptions.link) || (payload && payload.data && payload.data.url) || '/'

    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/logo.png',
      data: { url },
      tag: notif.tag || 'comewme-push',
    })
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const target = (event.notification.data && event.notification.data.url) || '/'

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
