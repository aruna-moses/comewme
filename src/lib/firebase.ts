import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging'
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebaseConfig'

export { isFirebaseConfigured }

function app(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null
  const existing = getApps()[0]
  return existing ?? initializeApp(FIREBASE_CONFIG)
}

/** Shared handle to the Firebase Messaging instance, so other modules can subscribe. */
export function messagingOrNullSafe(): Messaging | null {
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

/** The exact script path push relies on — used to drop stale copies before reinstalling. */
const PUSH_SW = '/firebase-messaging-sw.js'

export type PushRegisterStep =
  | 'idle'
  | 'not-configured'
  | 'unsupported'
  | 'permission'
  | 'sw-register'
  | 'token'

const FRIENDLY_PUSH_ERROR =
  'The push service could not reach this phone right now. Please check your connection and try again in a minute.'

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
    } catch {
      return {
        token: null,
        step: 'permission',
        error: 'Permission was not granted',
      }
    }
  }
  if (permission !== 'granted') {
    return { token: null, step: 'permission', error: 'Permission was not granted' }
  }

  const messaging = messagingOrNullSafe()
  if (!messaging) {
    return { token: null, step: 'token', error: FRIENDLY_PUSH_ERROR }
  }

  const registerFreshWorker = async () => {
    const registration = await withTimeout(
      navigator.serviceWorker.register(PUSH_SW, { scope: '/' }),
      15000,
      'registering the push service worker',
    )
    // FCM refuses to subscribe until a service worker controls the page.
    await withTimeout(navigator.serviceWorker.ready, 10000, 'waiting for the service worker to activate')
    return registration
  }

  let registration: ServiceWorkerRegistration | null = null
  try {
    registration = await registerFreshWorker()
  } catch {
    return { token: null, step: 'sw-register', error: 'The push service could not start on this phone. Please close the app and try again.' }
  }

  try {
    const token = await withTimeout(
      getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }),
      15000,
      'getting the push token',
    )
    return token
      ? { token, step: 'idle' }
      : { token: null, step: 'token', error: 'The push service could not register this phone. Please close the app and try again.' }
  } catch {
    // One silent healing retry: a stale worker pinned in this browser can keep
    // serving old code — uninstall it, install a fresh one, try once more.
    try {
      const existing = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        existing
          .filter((worker) => worker.active?.scriptURL?.endsWith(PUSH_SW) || worker.installing?.scriptURL?.endsWith(PUSH_SW) || worker.waiting?.scriptURL?.endsWith(PUSH_SW))
          .map((worker) => worker.unregister().catch(() => undefined)),
      )
      registration = await registerFreshWorker()
      const token = await withTimeout(
        getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }),
        15000,
        'getting the push token',
      )
      if (token) return { token, step: 'idle' }
      return { token: null, step: 'token', error: 'The push service could not register this phone. Please close the app and try again.' }
    } catch {
      return { token: null, step: 'token', error: FRIENDLY_PUSH_ERROR }
    }
  }
}
