import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { ThemeProvider } from './context/ThemeContext'
import SetupNotice from './components/SetupNotice'
import { isSupabaseConfigured } from './lib/supabase'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        {isSupabaseConfigured ? (
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        ) : (
          <SetupNotice />
        )}
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
