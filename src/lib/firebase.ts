import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** True when the browser will actually run FCM (iOS Safari requires standalone PWA mode). */
export async function isPushSupported(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (!('serviceWorker' in navigator)) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId)
}

function app(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null
  const existing = getApps()[0]
  return existing ?? initializeApp(config)
}

export function getMessagingInstance(): Messaging | null {
  const instance = app()
  if (!instance) return null
  try {
    return getMessaging(instance)
  } catch {
    return null
  }
}

/** Request permission and resolve the FCM registration token, or null when unavailable. */
export async function getFcmToken(vapidKey: string | undefined): Promise<string | null> {
  if (!vapidKey) return null
  if (!isFirebaseConfigured()) return null
  if (!(await isPushSupported())) return null

  const messaging = getMessagingInstance()
  if (!messaging) return null

  const registration = await navigator.serviceWorker.ready
  return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    .then((token) => token || null)
    .catch(() => null)
}
