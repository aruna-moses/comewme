import { Component, type ReactNode } from 'react'
import { AlertTriangle, Copy, RefreshCw, RotateCcw } from 'lucide-react'
import { applyUpdate, isChunkLoadError, recoverFromChunkError } from '../lib/appUpdate'

const PREFIXES = [
  'Error: ',
  'TypeError: ',
  'ReferenceError: ',
  'RangeError: ',
  'SyntaxError: ',
  'Unhandled Promise Rejection: ',
  'Invariant Violation: ',
]

function stripPrefix(message: string) {
  if (!message) return 'Unknown error'
  for (const p of PREFIXES) {
    if (message.startsWith(p)) return message.slice(p.length)
  }
  return message
}

type Props = { children: ReactNode }
type State = { error: Error | null; stale: boolean; retrying: boolean }

/**
 * Last line of defence.
 *
 * A deploy that replaces hashed chunks is not a crash — it gets a calm
 * "catching up" screen and a silent reload. Real errors get plain language and
 * a retry; the technical detail stays collapsed for support, never front and
 * centre.
 */
export default class SentryErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, stale: isChunkLoadError(error), retrying: true }
  }

  state: State = { error: null, stale: false, retrying: true }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Stale chunk after a deploy: fetch the current build instead of reporting it.
    if (isChunkLoadError(error)) {
      this.setState({ retrying: recoverFromChunkError() })
      return
    }
    if (import.meta.env.PROD && (import.meta.env.VITE_SENTRY_DSN || import.meta.env.VITE_SENTRY_DNS)) {
      void import('@sentry/react')
        .then(({ captureException }) =>
          captureException(error, {
            contexts: { react: { componentStack: info?.componentStack ?? '' } },
          }),
        )
        .catch(() => undefined)
    }
  }

  render() {
    const { error, stale, retrying } = this.state
    if (!error) return this.props.children

    if (stale) {
      return (
        <div role="status" className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
          <img src="/logo.png" alt="" aria-hidden className="h-14 w-14 rounded-2xl object-cover shadow-card" />
          {retrying ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-amber" aria-hidden />
          ) : null}
          <div>
            <h1 className="font-display text-xl font-bold">
              {retrying ? 'Getting the latest version' : 'A new version is ready'}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {retrying
                ? "Come w' me just updated. This takes a second — nothing you did is lost."
                : "Come w' me just updated. One tap and you're on the latest."}
            </p>
          </div>
          <button type="button" onClick={applyUpdate} className="btn-ghost btn-sm mt-1">
            <RefreshCw size={15} aria-hidden /> Refresh now
          </button>
        </div>
      )
    }

    const err = error instanceof Error ? error : new Error(String(error))
    const name = stripPrefix(err.name || 'Error')
    const message = stripPrefix(err.message || 'Unknown error')
    const stack = err.stack ?? ''
    const stackPreview = stack.split('\n').slice(0, 7).join('\n')

    return (
      <div role="alert" className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-start justify-center gap-5 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sun/25 text-ink">
          <AlertTriangle size={26} aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">That screen didn&apos;t load</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Something interrupted it on the way. Try again — if it keeps happening, send us the
            details below and we&apos;ll sort it.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={applyUpdate}
            className="btn-primary inline-flex w-full items-center justify-center gap-2"
          >
            <RotateCcw size={16} aria-hidden /> Try again
          </button>
          <a href="/" className="btn-ghost inline-flex w-full items-center justify-center gap-2">
            Go to Discover
          </a>
        </div>
        <details className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-[13px] text-muted">
          <summary className="cursor-pointer select-none font-semibold text-ink/80">
            Details for support
          </summary>
          <div className="mt-3 space-y-3">
            <div className="text-[12px] leading-relaxed font-mono">
              <p className="text-ink/80">{name}</p>
              <p className="break-words text-ink/70">{message}</p>
            </div>
            <pre className="max-h-40 overflow-auto rounded-xl bg-white p-3 text-[11px] leading-snug font-mono text-ink/60">
              {stackPreview}
            </pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(`${name}: ${message}\n\n${stack}`).catch(() => undefined)
              }}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink hover:underline"
            >
              <Copy size={14} aria-hidden /> Copy error details
            </button>
          </div>
        </details>
      </div>
    )
  }
}
