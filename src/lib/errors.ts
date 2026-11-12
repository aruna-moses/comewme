/**
 * Supabase/PostgREST errors are plain objects, not Error instances, so
 * `throw error` leaks a non-Error into every catch block and downstream
 * `e instanceof Error ? e.message : 'fallback'` checks silently swallow the real
 * reason. Convert anything thrown into a real Error with the database's message.
 */
export function toError(error: unknown, fallback = 'Something went wrong'): Error {
  if (error instanceof Error) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      const next = new Error(message)
      const code = (error as { code?: unknown }).code
      if (typeof code === 'string') (next as Error & { code?: string }).code = code
      return next
    }
  }
  if (typeof error === 'string' && error.trim()) return new Error(error)
  try {
    return new Error(JSON.stringify(error))
  } catch {
    return new Error(fallback)
  }
}

/** Use when you want a human sentence, with a last-resort fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
