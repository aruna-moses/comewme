import { ErrorBoundary } from '@sentry/react'
import type { ReactNode } from 'react'

/**
 * Boundary that catches React render/runtime crashes and forwards them to Sentry.
 * Falls back to a simple retry screen. Safe to render outside production.
 */
export default function SentryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="rounded-2xl bg-alert/10 px-6 py-5 text-[14px] leading-relaxed text-alert">
            <p className="font-bold">Something went wrong</p>
            <p className="mt-1 text-ink/80">{error instanceof Error ? error.message : 'Something went wrong.'}</p>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={resetError}>
            Try again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
