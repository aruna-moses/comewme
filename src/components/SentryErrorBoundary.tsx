import { Component, type ReactNode } from 'react'
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react'

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
type State = { error: Error | null }

/**
 * Outer ErrorBoundary -> Sentry capture + fallback UI with enough detail to
 * screenshot for debugging. @sentry/react is imported lazily the moment an
 * error happens, so people who never crash never pay for the SDK.
 */
export default class SentryErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  state: State = { error: null }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
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
    const { error } = this.state
    if (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const name = stripPrefix(err.name || 'Error')
      const message = stripPrefix(err.message || 'Unknown error')
      const stack = err.stack ?? ''
      const stackPreview = stack.split('\n').slice(0, 7).join('\n')

      return (
        <div role="alert" className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-5 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-alert/10 text-alert">
            <AlertTriangle size={28} aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Something broke</h1>
            <p className="mt-1 text-sm text-muted">Screenshot this and send it on — it has everything needed to fix the bug.</p>
          </div>
          <div className="w-full rounded-2xl border border-line bg-canvas p-4 text-[12px] leading-relaxed font-mono">
            <p className="text-alert">{name}</p>
            <p className="break-words text-ink/90">{message}</p>
          </div>
          <div className="max-h-56 w-full overflow-auto rounded-2xl border border-line bg-canvas p-4 text-[11px] leading-snug font-mono text-ink/70">
            <pre>{stackPreview}</pre>
          </div>
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(`${name}: ${message}\n\n${stack}`).catch(() => undefined)
              }}
              className="btn-ghost inline-flex w-full items-center justify-center gap-2"
            >
              <Copy size={16} aria-hidden /> Copy error details
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="btn-secondary inline-flex w-full items-center justify-center gap-2"
            >
              <RotateCcw size={16} aria-hidden /> Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
