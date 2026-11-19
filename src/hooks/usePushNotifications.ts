import { useEffect, useState, useCallback } from 'react'
import { isFirebaseConfigured } from '../lib/firebaseConfig'
import { supabase } from '../lib/supabase'

/** The one calm message shown on any failure to turn push on — never raw engine noise. */
const PUSH_ERROR_COPY =
  "That didn't work. Check your internet, tap Enable again — and if this keeps happening, close the app and reopen it."

const PUSH_OFF_ERROR_COPY = 'Could not turn off notifications. Please check your connection and try again.'

export type PushStatus =
  /** No Notification API, no service worker, or browser blocks it entirely. */
  | 'unsupported'
  /** iPhone/iPad on Safari — push only works inside an installed PWA. */
  | 'needs-install'
  /** Permission was denied; user must re-allow it in system/browser settings. */
  | 'denied'
  /** Permission not granted yet — the button can ask. */
  | 'default'
  /** Registered with FCM and row present in Supabase. */
  | 'enabled'
  /** Fires when Firebase env keys aren't wired up yet; the app still works. */
  | 'not-configured'

type PushPhase = 'idle' | 'asking-permission' | 'registering' | 'getting-token'
export interface PushNotificationsState {
  status: PushStatus
  busy: boolean
  error: string | null
  phase: PushPhase
  requestPermissionAndRegister: () => Promise<boolean>
  removePush: () => Promise<boolean>
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase()
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  if (/iphone|ipad|ipod/.test(ua)) return standalone ? 'ios-pwa' : 'ios-browser'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

const PUSH_STATUS_EVENT = 'comewme:push-status'

function broadcastPushStatus(status: PushStatus) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(PUSH_STATUS_EVENT, { detail: { status } }))
  } catch {
    // Older engines without CustomEvent — component stays consistent on reload anyway.
  }
}

export function usePushNotifications(): PushNotificationsState {
  const [status, setStatus] = useState<PushStatus>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<PushPhase>('idle')

  useEffect(() => {
    let alive = true

    async function resolveStatus() {
      if (!isFirebaseConfigured()) {
        if (alive) {
          setStatus('not-configured')
          broadcastPushStatus('not-configured')
        }
        return
      }
      const ua = navigator.userAgent.toLowerCase()
      const isIOS = /iphone|ipad|ipod/.test(ua)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
      if (isIOS && !standalone) {
        if (alive) {
          setStatus('needs-install')
          broadcastPushStatus('needs-install')
        }
        return
      }
      const pushApis = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
      if (!pushApis) {
        if (alive) {
          setStatus('unsupported')
          broadcastPushStatus('unsupported')
          return
        }
      }
      if (Notification.permission === 'denied') {
        if (alive) {
          setStatus('denied')
          broadcastPushStatus('denied')
        }
        return
      }
      const saved = (() => {
        try {
          return window.localStorage.getItem('comewme-fcm-token')
        } catch {
          return null
        }
      })()
      if (Notification.permission === 'granted' && saved) {
        // The server prunes dead tokens (FCM UNREGISTERED). If ours is gone
        // there, "Enabled" would be a lie — ask the user to re-enable.
        const { data: still, error: checkError } = await supabase
          .from('user_push_tokens')
          .select('token')
          .eq('token', saved)
          .maybeSingle()
        if (!checkError && !(still as { token?: string } | null)?.token) {
          try {
            window.localStorage.removeItem('comewme-fcm-token')
          } catch {
            // ignore
          }
          if (alive) {
            setStatus('default')
            broadcastPushStatus('default')
          }
          return
        }
        if (alive) {
          setStatus('enabled')
          broadcastPushStatus('enabled')
        }
        return
      }
      if (alive) {
        setStatus('default')
        broadcastPushStatus('default')
      }
    }

    void resolveStatus()

    // When another component (Settings card, install popup) turns push on/off,
    // pick the change up immediately instead of waiting for a remount.
    const onPushStatusChanged = (event: Event) => {
      if (!alive) return
      const detail = (event as CustomEvent<{ status?: PushStatus }>).detail
      if (detail?.status) setStatus(detail.status)
    }
    window.addEventListener(PUSH_STATUS_EVENT, onPushStatusChanged)

    return () => {
      alive = false
      window.removeEventListener(PUSH_STATUS_EVENT, onPushStatusChanged)
    }
  }, [])

  const requestPermissionAndRegister = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const ua = navigator.userAgent.toLowerCase()
      const isIOS = /iphone|ipad|ipod/.test(ua)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
      if (isIOS && !standalone) {
        setStatus('needs-install')
        broadcastPushStatus('needs-install')
        setBusy(false)
        return false
      }
      if (!isFirebaseConfigured()) {
        setStatus('not-configured')
        broadcastPushStatus('not-configured')
        setBusy(false)
        return false
      }

      setPhase('asking-permission')
      // iOS only honours Notification.requestPermission() inside the tap handler,
      // so we ask synchronously here before any awaits.
      const preRequestedPermission =
        'Notification' in window ? await Notification.requestPermission() : undefined
      const { registerForPush } = await import('../lib/firebase')
      const result = await registerForPush(
        import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined,
        preRequestedPermission,
      )

      if (!result.token) {
        if (result.step === 'unsupported') {
          setStatus('unsupported')
          broadcastPushStatus('unsupported')
        } else if (result.step === 'not-configured') {
          setStatus('not-configured')
          broadcastPushStatus('not-configured')
        } else if (result.error === 'Permission was not granted') {
          setStatus('denied')
          broadcastPushStatus('denied')
        } else setError(PUSH_ERROR_COPY)
        setPhase('idle')
        setBusy(false)
        return false
      }

      setPhase('registering')
      const deviceType = detectDeviceType()
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('You must be signed in to enable notifications.')
      const { error: upsertError } = await supabase
        .from('user_push_tokens')
        .upsert({ user_id: userId, token: result.token, device_type: deviceType, updated_at: new Date().toISOString() }, { onConflict: 'token' })
      if (upsertError) throw upsertError

      try {
        window.localStorage.setItem('comewme-fcm-token', result.token)
      } catch {
        // best effort — token is in the DB anyway
      }
      setStatus('enabled')
      broadcastPushStatus('enabled')
      setBusy(false)
      return true
    } catch {
      setPhase('idle')
      setError(PUSH_ERROR_COPY)
      setBusy(false)
      return false
    }
  }, [])

  const removePush = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const token = (() => {
        try {
          return window.localStorage.getItem('comewme-fcm-token')
        } catch {
          return null
        }
      })()
      if (token) {
        const { error: deleteError } = await supabase.from('user_push_tokens').delete().eq('token', token)
        if (deleteError) throw deleteError
      }
      try {
        window.localStorage.removeItem('comewme-fcm-token')
      } catch {
        // ignore
      }
      setStatus('default')
      broadcastPushStatus('default')
      setBusy(false)
      return true
    } catch {
      setError(PUSH_OFF_ERROR_COPY)
      setBusy(false)
      return false
    }
  }, [])

  return { status, busy, error, phase, requestPermissionAndRegister, removePush }
}
