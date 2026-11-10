import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * Tiny draft store backed by localStorage.
 *
 * Every keystroke that matters is written after a short pause, so a refresh,
 * a phone reloading a background tab, or an accidental back-swipe no longer
 * throws away what someone was in the middle of typing.
 */

const PREFIX = 'comewme:draft:'
const MAX_CHARS = 1_500_000 // keep well inside the usual 5MB localStorage budget

interface Envelope<T> {
  value: T
  savedAt: number
}

function storageKey(key: string) {
  return `${PREFIX}${key}`
}

export function readDraft<T>(key: string): Envelope<T> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Envelope<T>
    if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDraft<T>(key: string, value: T) {
  try {
    const payload = JSON.stringify({ value, savedAt: Date.now() })
    if (payload.length > MAX_CHARS) {
      window.localStorage.removeItem(storageKey(key))
      return
    }
    window.localStorage.setItem(storageKey(key), payload)
  } catch {
    // Private mode or a full quota — drafts are best effort, never fatal.
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // ignore
  }
}

/** Remove every draft under a group, e.g. all keys starting `post-task:`. */
export function clearDraftGroup(group: string) {
  try {
    const prefix = storageKey(group)
    const doomed: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(prefix)) doomed.push(key)
    }
    doomed.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // ignore
  }
}

export function clearAllDrafts() {
  clearDraftGroup('')
}

/** When was anything in this group last saved? Used by the "draft restored" bar. */
export function latestDraftTime(group: string): number | null {
  try {
    const prefix = storageKey(group)
    let latest: number | null = null
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(prefix)) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as Envelope<unknown>
        const at = typeof parsed?.savedAt === 'number' ? parsed.savedAt : null
        if (at !== null && (latest === null || at > latest)) latest = at
      } catch {
        // skip unreadable entry
      }
    }
    return latest
  } catch {
    return null
  }
}

/**
 * Drop-in replacement for useState that survives a reload.
 * Clearing back to the initial value removes the draft, so empty forms
 * never show a "restored" bar.
 */
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const initialRef = useRef(initial)
  const [value, setValue] = useState<T>(() => readDraft<T>(key)?.value ?? initial)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (JSON.stringify(value) === JSON.stringify(initialRef.current)) clearDraft(key)
      else writeDraft(key, value)
    }, 400)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [key, value])

  return [value, setValue]
}
