import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { signIn, signUp, signInWithGoogle, session, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // If someone lands here already signed in, send them on.
  if (session && profile) {
    navigate(location.state?.from ?? '/', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password)
        navigate(location.state?.from ?? '/', { replace: true })
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then come back and sign in.')
          setMode('in')
        } else {
          navigate('/onboarding', { replace: true })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-5 pb-10 pt-12">
      <div className="mx-auto w-full max-w-[380px]">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
        >
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
            <circle cx="9" cy="12" r="4.6" stroke="#0B0B0F" strokeWidth="2.6" />
            <circle cx="23" cy="12" r="4.6" stroke="#0B0B0F" strokeWidth="2.6" />
            <path d="M10 25c2-3.4 4-5 6-5s4 1.6 6 5" stroke="#0B0B0F" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">
          Come w' me
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          {mode === 'in'
            ? 'Find something worth doing today and someone to do it with.'
            : 'Create an account. It takes a minute.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              className="field pr-12"
              placeholder={mode === 'in' ? 'Your password' : 'At least 6 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required/>
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
>
  {showPassword ? (
    <EyeOff className="w-5 h-5" />
  ) : (
    <Eye className="w-5 h-5" />
  )}
</button>
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.06A9 9 0 0 0 12 16a9 9 0 0 0 5.94-5.94l1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="1" cy="1" r="2" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  <path d="m18.5 2.5 3.01 3.01M2.5 18.5l3.01 3.01M18.5 18.5l3.01-3.01M5.5 5.5l3.01-3.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>
          )}
          {notice && (
            <p className="rounded-xl bg-verified/10 p-3 text-[13px] font-medium text-verified">
              {notice}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <button onClick={() => void signInWithGoogle()} className="btn-ghost w-full">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M23 12.2c0-.8-.1-1.4-.2-2H12v3.9h6.2c-.1 1-.8 2.6-2.6 3.6l3.9 3c2.3-2.1 3.5-5.2 3.5-8.5Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 5.9-1.1 7.5-2.9l-3.9-3c-1 .7-2.3 1.2-3.6 1.2-2.9 0-5.3-1.9-6.2-4.5l-4 3.1C3.4 21.3 7.4 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.8 14.8A7.3 7.3 0 0 1 5.4 12c0-1 .2-1.9.4-2.8l-4-3.1A12 12 0 0 0 0 12c0 1.9.5 3.8 1.4 5.4l4.4-2.6Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.7c2 0 3.4.9 4.2 1.6l3.4-3.3C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.1l4.4 2.6C6.7 6.1 9.1 4.7 12 4.7Z"
            />
          </svg>
          Continue with Google
        </button>

        <p className="mt-6 text-center text-[13px] text-muted">
          {mode === 'in' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button
            className="font-semibold text-ink underline underline-offset-4"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in')
              setError(null)
              setNotice(null)
            }}
          >
            {mode === 'in' ? 'Create one' : 'Sign in'}
          </button>
        </p>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted">
          Meet in public places. Never send money to someone you have not met.
        </p>
      </div>
    </div>
  )
}
