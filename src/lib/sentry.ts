// Production error monitoring via Sentry.
//
// Behaviour:
//   - Dev: no-op (you get the default React error overlay)
//   - Build without VITE_SENTRY_DSN: silently does nothing
//   - Build with VITE_SENTRY_DSN set: captures every uncaught error,
//     every React render crash, and every unhandled promise rejection —
//     tagged with the route and the user's ID when known.

import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
const isProduction = import.meta.env.PROD

export function initSentry() {
  if (!dsn || !isProduction) return

  Sentry.init({
    dsn,
    environment: 'production',
    release: import.meta.env.VITE_SENTRY_RELEASE ?? undefined,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Strip Authorization headers and bodies before anything ever leaves
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['authorization']
      }
      delete event.request?.data
      return event
    },
    integrations: (integrations) =>
      integrations.filter((integration) => integration.name !== 'BrowserTracing'),
    initialScope: {
      tags: {
        app: 'comewme',
      },
    },
  })
}
