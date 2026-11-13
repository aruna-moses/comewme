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

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId)
}

function app(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null
  const existing = getApps()[0]
  return existing ?? initializeApp(config)
}

function messagingOrNull(): Messaging | null {
  const instance = app()
  if (!instance) return null
  try {
    return getMessaging(instance)
  } catch {
    return null
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error(`Timed out while ${step}`)), ms),
    ),
  ])
}

export type PushRegisterStep =
  | 'idle'
  | 'not-configured'
  | 'unsupported'
  | 'permission'
  | 'sw-register'
  | 'token'

/** Full iOS-safe registration flow. Never hangs forever; always settles. */
export async function registerForPush(
  vapidKey: string | undefined,
  preRequestedPermission?: NotificationPermission,
): Promise<{
  token: string | null
  step: PushRegisterStep
  error?: string
}> {
  if (!isFirebaseConfigured()) {
    return { token: null, step: 'not-configured' }
  }

  // iOS may refuse permission outside a direct tap handler, so when permission
  // is provided up front we skip the support/permission prologue entirely.
  let permissionSupported = true
  if (preRequestedPermission !== 'granted') {
    try {
      permissionSupported = await withTimeout(Promise.resolve(isSupported()), 8000, 'checking push support')
    } catch {
      permissionSupported = false
    }
  }
  if (!permissionSupported || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { token: null, step: 'unsupported' }
  }

  // Ask permission (returns instantly if already granted or denied).
  let permission: NotificationPermission = preRequestedPermission ?? Notification.permission
  if (preRequestedPermission !== 'granted') {
    try {
      permission = await withTimeout(Notification.requestPermission(), 10000, 'waiting for permission')
    } catch (error) {
      return {
        token: null,
        step: 'permission',
        error: error instanceof Error ? error.message : 'Permission request timed out',
      }
    }
  }
  if (permission !== 'granted') {
    return { token: null, step: 'permission', error: 'Permission was not granted' }
  }

  const messaging = messagingOrNull()
  if (!messaging) {
    return { token: null, step: 'token', error: 'Firebase messaging could not start' }
  }

  let registration: ServiceWorkerRegistration
  try {
    registration = await withTimeout(
      navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }),
      15000,
      'registering the push service worker',
    )
  } catch (error) {
    return {
      token: null,
      step: 'sw-register',
      error: error instanceof Error ? error.message : 'Service worker registration timed out',
    }
  }

  try {
    const token = await withTimeout(
      getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }),
      15000,
      'getting the FCM registration token',
    )
    return { token: token || null, step: token ? 'idle' : 'token', error: token ? undefined : 'FCM returned an empty token' }
  } catch (error) {
    return {
      token: null,
      step: 'token',
      error: error instanceof Error ? error.message : 'Could not get the push token',
    }
  }
}
