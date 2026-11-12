import { useCallback, useEffect, useState } from 'react'
import { isPushSupported, isFirebaseConfigured, getFcmToken } from '../lib/firebase'
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

export interface PushNotificationsState {
  status: PushStatus
  busy: boolean
  error: string | null
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
      if (!(await isPushSupported())) {
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
      if (!(await isPushSupported())) {
        setStatus('unsupported')
        setBusy(false)
        return false
      }
      if (!isFirebaseConfigured()) {
        setStatus('not-configured')
        setBusy(false)
        return false
      }

      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        setStatus('denied')
        setBusy(false)
        return false
      }

      await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' })
      const token = await getFcmToken(import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)
      if (!token) {
        setError('Could not register this device for notifications. Please check your connection and try again.')
        setBusy(false)
        return false
      }

      // Tie token to this device type; insert quietly returns on duplicate.
      const deviceType = detectDeviceType()
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('You must be signed in to enable notifications.')
      const { error: upsertError } = await supabase
        .from('user_push_tokens')
        .upsert({ user_id: userId, token, device_type: deviceType, updated_at: new Date().toISOString() }, { onConflict: 'token' })
      if (upsertError) throw upsertError

      try {
        window.localStorage.setItem('comewme-fcm-token', token)
      } catch {
        // best effort — token is in the DB anyway
      }
      setStatus('enabled')
      setBusy(false)
      return true
    } catch (e) {
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

  return { status, busy, error, requestPermissionAndRegister, removePush }
}
