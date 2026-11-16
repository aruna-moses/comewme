const GOOGLE_ACCOUNTS_KEY = 'comewme:google-accounts'

/**
 * Emails the user has signed in with via Google through the app on this device.
 * Drives the quick-pick list on the login screen so repeat sign-ins never
 * fall back to typing an email + password.
 */
export function readSavedGoogleEmails(): string[] {
  try {
    const raw = window.localStorage.getItem(GOOGLE_ACCOUNTS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .filter((email, index, all) => all.indexOf(email) === index)
      .slice(0, 5)
  } catch {
    return []
  }
}

export function saveGoogleEmail(email: string) {
  try {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return
    const current = readSavedGoogleEmails().filter((entry) => entry !== normalized)
    current.unshift(normalized)
    window.localStorage.setItem(GOOGLE_ACCOUNTS_KEY, JSON.stringify(current.slice(0, 5)))
  } catch {
    // Best effort only - the picker is a convenience, never a blocker.
  }
}

export function clearGoogleEmails() {
  try {
    window.localStorage.removeItem(GOOGLE_ACCOUNTS_KEY)
  } catch {
    // Best effort only.
  }
}
