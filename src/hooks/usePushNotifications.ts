import { useEffect, useState, useCallback } from 'react'
import { registerForPush, isFirebaseConfigured } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import { toError } from '../lib/errors'

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

export function usePushNotifications(): PushNotificationsState {
  const [status, setStatus] = useState<PushStatus>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<PushPhase>('idle')

  useEffect(() => {
    let alive = true

    async function resolveStatus() {
      if (!isFirebaseConfigured()) {
        if (alive) setStatus('not-configured')
        return
      }
      const ua = navigator.userAgent.toLowerCase()
      const isIOS = /iphone|ipad|ipod/.test(ua)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
      if (isIOS && !standalone) {
        if (alive) setStatus('needs-install')
        return
      }
      const pushApis = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
      if (!pushApis) {
        if (alive) setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (alive) setStatus('denied')
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
        if (alive) setStatus('enabled')
        return
      }
      if (alive) setStatus('default')
    }

    void resolveStatus()
    return () => {
      alive = false
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
        setBusy(false)
        return false
      }
      if (!isFirebaseConfigured()) {
        setStatus('not-configured')
        setBusy(false)
        return false
      }

      setPhase('asking-permission')
      const result = await registerForPush(import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)

      if (!result.token) {
        if (result.step === 'unsupported') setStatus('unsupported')
        else if (result.step === 'not-configured') setStatus('not-configured')
        else if (result.error === 'Permission was not granted') setStatus('denied')
        else setError(result.error ?? 'Could not set up push notifications.')
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
      setBusy(false)
      return true
    } catch (e) {
      setPhase('idle')
      setError(toError(e, 'Could not register for push.').message)
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
      setBusy(false)
      return true
    } catch (e) {
      setError(toError(e, 'Could not turn off notifications.').message)
      setBusy(false)
      return false
    }
  }, [])

  return { status, busy, error, phase, requestPermissionAndRegister, removePush }
}
