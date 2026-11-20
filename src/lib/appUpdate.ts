/**
 * Live deployments vs. long-lived sessions.
 *
 * Every screen past the feed is a lazily-loaded chunk with a content hash in
 * its filename. When a deploy replaces those files, a tab that is still open
 * asks the server for a filename that no longer exists — the import rejects
 * and a stack-trace crash screen used to appear. Refreshing "fixed" it, which
 * is exactly what people were being forced to do.
 *
 * This module makes it invisible:
 *  - notices a new build (via /version.json) and offers a one-tap refresh,
 *    applying it automatically if the app is already in the background;
 *  - silently reloads once when a stale chunk fails to load;
 *  - only falls back to asking the person if a refresh genuinely can't help
 *    (offline, or the deploy itself is broken).
 */

export const BUILD_ID = __BUILD_ID__

const UPDATE_EVENT = 'comewme:update-available'
const RECOVERY_KEY = 'comewme:chunk-recovery'
const CHECK_INTERVAL = 5 * 60_000

let announced = false
let pendingUpdate = false
let watcherStarted = false

/** Fires when a newer build is live. Calls back immediately if one already is. */
export function onUpdateAvailable(handler: () => void): () => void {
  const listener = () => handler()
  window.addEventListener(UPDATE_EVENT, listener)
  if (pendingUpdate) handler()
  return () => window.removeEventListener(UPDATE_EVENT, listener)
}

function announce() {
  pendingUpdate = true
  if (announced) return
  announced = true
  window.dispatchEvent(new Event(UPDATE_EVENT))
}

/** True for every flavour of "this chunk file is no longer on the server". */
export function isChunkLoadError(value: unknown): boolean {
  const raw =
    value instanceof Error
      ? `${value.name} ${value.message}`
      : typeof value === 'string'
        ? value
        : String((value as { message?: unknown } | null)?.message ?? '')
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|chunkloaderror|loading chunk \S+ failed|unable to preload (?:css|module)|does not provide an export named|unexpected token ['"]<['"]|is not valid (?:JSON|json)|expected expression|failed to load resource.*assets\//i.test(raw)
}

function isStaleAssetElement(value: unknown): boolean {
  return value instanceof HTMLScriptElement && /(?:^|\/)assets\//.test(value.src)
}

/** Pick up the current deploy with a single reload, bypassing any cached HTML. */
export function applyUpdate(): void {
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // storage blocked — reloading still works
  }
  const target = new URL(window.location.href)
  target.searchParams.set('__v', String(Date.now()))
  window.location.replace(target.toString())
}

/**
 * Reload once to fetch the build that actually exists. A second failure inside
 * the same build means reloading won't help right now, so stop looping and let
 * the person decide instead of hammering their connection.
 */
export function recoverFromChunkError(): boolean {
  try {
    if (sessionStorage.getItem(RECOVERY_KEY) === BUILD_ID) {
      announce()
      return false
    }
    sessionStorage.setItem(RECOVERY_KEY, BUILD_ID)
  } catch {
    // no guard available: the page is already broken, reloading is still right
  }
  window.location.reload()
  return true
}

/** Compare this bundle's id with the one the server is currently serving. */
export async function checkForUpdate(): Promise<boolean> {
  if (!import.meta.env.PROD) return false
  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return false
    const data = (await response.json()) as { buildId?: string }
    if (data.buildId && data.buildId !== BUILD_ID) {
      announce()
      return true
    }
  } catch {
    // offline or blocked — try again on the next check
  }
  return false
}

/** True while someone is in the middle of typing something we can't restore. */
function hasUnfinishedInput(): boolean {
  const isTextField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement

  const active = document.activeElement
  if (active && isTextField(active) && active.value.trim()) return true
  if (active instanceof HTMLElement && active.isContentEditable && active.textContent?.trim()) return true

  // A form can be filled in without anything being focused at this instant.
  for (const field of document.querySelectorAll('input, textarea')) {
    if (!isTextField(field)) continue
    if (field.type === 'hidden' || field.disabled || field.readOnly) continue
    if (field.type === 'checkbox' || field.type === 'radio') continue
    if (field.value.trim()) return true
  }
  return false
}

/** Checks after launch, on every return to the app, and every few minutes. */
export function startUpdateWatcher(): () => void {
  if (watcherStarted) return () => undefined
  watcherStarted = true

  const check = () => {
    void checkForUpdate()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      check()
    } else if (pendingUpdate && !hasUnfinishedInput()) {
      // They just left — apply it now, while there's nothing on screen to lose.
      applyUpdate()
    }
  }

  const onFocus = () => {
    if (document.visibilityState === 'visible') check()
  }

  const onOnline = () => check()
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') check()
  }, CHECK_INTERVAL)
  const initial = window.setTimeout(check, 4000)

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onOnline)

  return () => {
    watcherStarted = false
    window.clearTimeout(initial)
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
  }
}

/** Wires the safety nets. Call once, before React renders. */
export function installUpdateRecovery(): void {
  const handle = (value: unknown): boolean => {
    if (!isChunkLoadError(value)) return false
    return recoverFromChunkError()
  }

  // Fired by Vite when a module preload for a dynamic import 404s.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    recoverFromChunkError()
  })

  window.addEventListener(
    'error',
    (event) => {
      if (isStaleAssetElement(event.target) || handle(event.error ?? event.message)) event.preventDefault()
    },
    true,
  )

  window.addEventListener('unhandledrejection', (event) => {
    if (handle(event.reason)) event.preventDefault()
  })

  // Fifteen seconds alive means this build booted fine — forget the loop guard.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RECOVERY_KEY)
    } catch {
      // ignore
    }
  }, 15_000)
}
