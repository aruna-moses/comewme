import { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * Phone verification was pulled until the number flows are re-enabled in
 * Supabase (SMS provider, templates, buyers). Email + Google are the only
 * sign-in methods for now — revert to the phone branch when the feature
 * lights up again.
 */
export default function Login() {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    session,
    profile,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const returnTo = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//')
    ? location.state.from
    : '/'

  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [guidelinesChecked, setGuidelinesChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [guidelinesFlash, setGuidelinesFlash] = useState(false)
  const guidelinesRef = useRef<HTMLLabelElement>(null)

  useEffect(() => {
    if (session && profile) navigate(location.state?.from ?? '/', { replace: true })
  }, [session, profile, navigate, location.state])

  // If the user cancels the Google flow and comes back to this page,
  // reset the button so it doesn't look stuck on "One moment…".
  useEffect(() => {
    const resetBusy = () => {
      if (document.visibilityState === 'visible') setBusy(false)
    }
    document.addEventListener('visibilitychange', resetBusy)
    window.addEventListener('pageshow', resetBusy)
    return () => {
      document.removeEventListener('visibilitychange', resetBusy)
      window.removeEventListener('pageshow', resetBusy)
    }
  }, [])

  const flashGuidelinesNotice = (message: string) => {
    setError(message)
    guidelinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setGuidelinesFlash(true)
    window.setTimeout(() => setGuidelinesFlash(false), 2500)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'forgot') {
      if (!email.trim()) return
      setBusy(true)
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (resetError) throw resetError
        setNotice('If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send the reset link. Try again in a minute.')
      } finally {
        setBusy(false)
      }
      return
    }

    if (!guidelinesChecked) {
      flashGuidelinesNotice('Please tick the guidelines first — it takes two seconds.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password)
        navigate(location.state?.from ?? '/', { replace: true })
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, returnTo)
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then come back and sign in.')
          setMode('in')
        } else {
          navigate(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    if (!guidelinesChecked) {
      flashGuidelinesNotice('Please tick the guidelines first — it takes two seconds.')
      return
    }
    setBusy(true)
    try {
      await signInWithGoogle(returnTo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in with Google.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="flex-1 px-5 pb-6 pt-8">
        <div className="mx-auto w-full max-w-[390px]">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Come w' me logo"
              className="h-8 w-8 rounded-[10px] object-cover"
            />
            <span className="font-display text-[20px] font-bold tracking-tight">Come w' me</span>
          </div>

          <img
            src="/signin-banner.png"
            alt="A group of friends meeting for a walk in the park"
            className="mt-6 h-[210px] w-full rounded-[16px] object-cover"
          />

          {mode === 'forgot' ? (
            <>
              <h1 className="mt-7 font-display text-[28px] font-bold leading-tight tracking-tight">Reset password</h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                Enter the email you use to sign in. We&apos;ll send you a link to get back in — it expires after an hour.
              </p>
              <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3">
                <div>
                  <label className="label" htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    className="field"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                )}
                {notice && <p role="status" className="rounded-xl bg-verified/10 p-3 text-[13px] font-medium text-verified">{notice}</p>}
                <button type="submit" className="btn-primary w-full rounded-[16px]" disabled={busy || !email.trim()}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => { setMode('in'); setError(null); setNotice(null) }}
                className="mt-4 w-full py-2 text-[13px] font-semibold text-amber"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-[28px] font-bold leading-tight tracking-tight">Come w&apos; me</h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                {mode === 'in'
                  ? 'Find something worth doing today and someone to do it with.'
                  : 'Create an account. It takes a minute.'}
              </p>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-[16px] bg-ink py-3.5 text-[14px] font-bold text-canvas shadow-card transition enabled:hover:brightness-110 disabled:opacity-50"
                disabled={busy}
                aria-label="Continue with Google"
              >
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.36-2.17 3.56-5.4 3.56-8.82z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.77 12 4.77z" />
                </svg>
                {busy ? 'One moment…' : 'Continue with Google'}
              </button>
              <div className="my-4 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">or continue with email</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3">
                <div>
                  <label className="label" htmlFor="email">Email</label>
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
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                      className="field pr-12"
                      placeholder={mode === 'in' ? 'Your password' : 'At least 6 characters'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      aria-controls="password"
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                    </button>
                  </div>
                </div>
                <label
                  ref={guidelinesRef}
                  className={`flex cursor-pointer items-start gap-2 pt-1 text-[12px] leading-relaxed transition ${
                    guidelinesFlash
                      ? 'rounded-xl border-2 border-alert bg-alert/10 p-2 text-alert ring-4 ring-alert/20'
                      : 'text-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[#ff9f1c]"
                    checked={guidelinesChecked}
                    onChange={(event) => setGuidelinesChecked(event.target.checked)}
                    aria-describedby="guidelines-label"
                  />
                  <span id="guidelines-label">
                    I agree to follow the Community Guidelines and understand that violations may lead to a warning,
                    temporary suspension, or permanent ban.
                  </span>
                  {guidelinesFlash && <AlertTriangle size={22} className="ml-auto shrink-0 text-alert" aria-hidden />}
                </label>
                {mode === 'in' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setNotice(null) }}
                    className="block w-full text-right text-[12px] font-semibold text-amber"
                  >
                    Forgot password?
                  </button>
                )}
                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                )}
                {notice && <p role="status" className="rounded-xl bg-verified/10 p-3 text-[13px] font-medium text-verified">{notice}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy || !guidelinesChecked}>
                  {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <p className="mt-5 text-center text-[13px] text-muted">
                {mode === 'in' ? "Don't have an account?" : 'Already have one?'}{' '}
                <button
                  type="button"
                  className="font-semibold text-amber underline underline-offset-4"
                  onClick={() => {
                    setMode(mode === 'in' ? 'up' : 'in')
                    setError(null)
                    setNotice(null)
                  }}
                >
                  {mode === 'in' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="px-8 pb-6 text-center">
        <p className="text-[11px] leading-relaxed text-muted">
          Meet in public places. Never send money to someone you have not met.
        </p>
        <div className="mt-2 flex justify-center gap-x-4 text-[12px] font-semibold text-amber">
          <Link to="/community-guidelines" className="underline underline-offset-2">Community Guidelines</Link>
          <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
