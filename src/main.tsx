import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { ThemeProvider } from './context/ThemeContext'
import SetupNotice from './components/SetupNotice'
import CallProvider from './components/chat/CallProvider'
import SentryErrorBoundary from './components/SentryErrorBoundary'
import { isSupabaseConfigured } from './lib/supabase'
import { installUpdateRecovery, startUpdateWatcher } from './lib/appUpdate'
import './index.css'

// Recover from stale hashed chunks (a deploy landed while this tab was open)
// before React has a chance to surface a crash.
installUpdateRecovery()
startUpdateWatcher()

// Lazy-load the Sentry SDK only in production with a DSN configured.
// Saves ~100KB from the entry chunk for every regular screen.
if (import.meta.env.PROD && (import.meta.env.VITE_SENTRY_DSN ?? import.meta.env.VITE_SENTRY_DNS)) {
  void import('./lib/sentry').then(({ initSentry }) => initSentry())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        {isSupabaseConfigured ? (
          <AuthProvider>
            <NotificationProvider>
              <CallProvider>
                <SentryErrorBoundary>
                  <App />
                </SentryErrorBoundary>
              </CallProvider>
            </NotificationProvider>
          </AuthProvider>
        ) : (
          <SetupNotice />
        )}
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
