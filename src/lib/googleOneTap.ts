/**
 * Google Identity Services "One Tap".
 *
 * Shows Google's own account chip/sheet on the login screen so a user who is
 * already signed into Google on the device can get in with a single tap - no
 * email, no password, no account picker detour. Everything here is progressive
 * enhancement: if the script cannot load (offline, ad-blocker, in-app webview,
 * unsupported browser) the caller silently falls back to the normal Google
 * redirect button.
 */

const GIS_SCRIPT_ID = 'google-identity-services'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

/**
 * Same public web client that Supabase already uses for the OAuth redirect.
 * It is not a secret, and the fallback default keeps deploys working without
 * extra environment configuration.
 */
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '440888850991-0sfc50lmicbvkln0u569er5ervsqnhkb.apps.googleusercontent.com'

type CredentialResponse = {
  credential?: string
  select_by?: string
}

type PromptNotification = {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
}

type GoogleIdentityServices = {
  initialize: (config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
    context?: 'signin' | 'signup' | 'use'
    ux_mode?: 'popup' | 'redirect'
  }) => void
  prompt: (listener?: (notification: PromptNotification) => void) => void
  cancel: () => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityServices } }
  }
}

let scriptPromise: Promise<void> | null = null

export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    script.id = GIS_SCRIPT_ID
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Google sign-in could not load.'))
    }
    if (!existing) document.head.appendChild(script)
  })

  return scriptPromise
}

export async function showGoogleOneTap(onCredential: (credential: string) => void): Promise<void> {
  await loadGoogleIdentity()
  const gis = window.google?.accounts?.id
  if (!gis) throw new Error('Google sign-in is unavailable right now.')

  gis.initialize({
    client_id: GOOGLE_CLIENT_ID,
    // Never sign someone in without a tap; the chip is already the shortcut.
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
    context: 'signin',
    callback: (response) => {
      if (response.credential) onCredential(response.credential)
    },
  })
  gis.prompt()
}

export function hideGoogleOneTap() {
  try {
    window.google?.accounts?.id?.cancel()
  } catch {
    // The prompt was not showing - nothing to do.
  }
}
