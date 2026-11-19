import { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertTriangle, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sheet from '../components/Sheet'
import { readSavedGoogleEmails, saveGoogleEmail } from '../lib/googleAccounts'
import { hideGoogleOneTap, showGoogleOneTap } from '../lib/googleOneTap'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

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
    signInWithGoogleCredential,
    session,
    profile,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const returnTo = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//')
    ? location.state.from
    : '/'

  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in')
  // Inside an installed home-screen PWA, the email-code path is the fastest
  // option: it stays entirely within the web view, so no Safari in-app sheet
  // loses the Google session. Detect standalone mode to order the page accordingly.
  const isStandalone = (() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    } catch {
      return false
    }
  })()
  const isIOSDevice = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
  const codeFirst = isStandalone && isIOSDevice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeStage, setCodeStage] = useState<'email' | 'verify'>('email')
  const [showPassword, setShowPassword] = useState(false)
  const [guidelinesChecked, setGuidelinesChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [guidelinesFlash, setGuidelinesFlash] = useState(false)
  const guidelinesRef = useRef<HTMLLabelElement>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleAccounts, setGoogleAccounts] = useState<string[]>([])
  const [googlePickerOpen, setGooglePickerOpen] = useState(false)

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

  // Google accounts this user has signed in with before on this device -
  // powers the one-tap quick picker instead of forcing email + password entry.
  useEffect(() => {
    setGoogleAccounts(readSavedGoogleEmails())
  }, [])

  // Once the guidelines are accepted, let Google offer the account that is
  // already signed in on this device: one tap on Google's chip and the user is
  // in, with no redirect. If Google's script cannot render the prompt (blocked
  // script, in-app webview, unsupported browser) the button below still works.
  //
  // Inside an installed home-screen PWA on iOS, arm One Tap immediately — the
  // installed app has its own storage container separate from Safari, so being
  // "logged in on the browser tab" means nothing in here. One tap is the
  // closest we can get to the browser experience: zero passwords, zero redirects.
  useEffect(() => {
    if (!guidelinesChecked && !codeFirst) return
    let active = true
    void showGoogleOneTap((credential) => {
      if (active) void completeGoogleCredential(credential)
    }).catch(() => {
      // Progressive enhancement only - never surface this failure.
    })
    return () => {
      active = false
      hideGoogleOneTap()
    }
  }, [guidelinesChecked, codeFirst])

  const flashGuidelinesNotice = (message: string, target: 'email' | 'google' = 'email') => {
    if (target === 'google') setGoogleError(message)
    else setError(message)
    guidelinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setGuidelinesFlash(true)
    window.setTimeout(() => setGuidelinesFlash(false), 2500)
  }

  // Passwordless path: send a 6-digit code to the inbox, sign in by typing it.
  // Works identically inside an installed home-screen PWA — no redirect, no password.
  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    setNotice(null)

    if (!guidelinesChecked) {
      flashGuidelinesNotice('Please tick the guidelines first — it takes two seconds.')
      return
    }
    if (!email.trim()) return

    setBusy(true)
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: {
            guidelines_accepted_version: '1.0',
            guidelines_user_agent: navigator.userAgent,
          },
        },
      })
      if (sendError) throw sendError
      setNotice(`We sent a 6-digit code to ${email.trim()} — check your inbox and spam folder.`)
      setCodeStage('verify')
    } catch (err) {
      setError(friendlyError(err, 'Could not send the code. Try again in a minute.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setBusy(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      })
      if (verifyError) throw verifyError
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'That code did not work. Check it and try again.'))
    } finally {
      setBusy(false)
    }
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
        setError(friendlyError(err, 'Could not send the reset link. Try again in a minute.'))
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
      setError(friendlyError(e, 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn(googleEmail?: string) {
    hideGoogleOneTap()
    setGoogleError(null)
    if (!guidelinesChecked) {
      flashGuidelinesNotice('Please tick the guidelines first, then tap Continue with Google.', 'google')
      return
    }
    if (googleEmail) saveGoogleEmail(googleEmail)
    setBusy(true)
    try {
      await signInWithGoogle(returnTo, googleEmail)
    } catch (e) {
      setGoogleError(friendlyError(e, 'Could not sign in with Google.'))
      setBusy(false)
    }
  }

  // Saved Google accounts turn the button into a one-tap picker. First-time
  // users go straight to Google's own account chooser, which already lists the
  // accounts signed in on their phone.
  function handleGoogleTap() {
    setNotice(null)
    setGoogleError(null)
    if (!guidelinesChecked) {
      flashGuidelinesNotice('Please tick the guidelines first, then tap Continue with Google.', 'google')
      return
    }
    if (googleAccounts.length > 0) {
      hideGoogleOneTap()
      setError(null)
      setGooglePickerOpen(true)
      return
    }
    void handleGoogleSignIn()
  }

  // Google One Tap already verified the account with Google, so this path is a
  // single request to Supabase rather than a full redirect dance.
  async function completeGoogleCredential(credential: string) {
    hideGoogleOneTap()
    setBusy(true)
    setGoogleError(null)
    try {
      await signInWithGoogleCredential(credential)
      navigate(returnTo, { replace: true })
    } catch (e) {
      setGoogleError(friendlyError(e, 'Could not sign in with Google.'))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="flex-1 px-5 pb-6 pt-8">
        <div className="mx-auto w-full max-w-[390px]">
          <div className="flex items-center gap-2">
            <img loading="lazy" decoding="async"               src="/logo.png"
              alt="Come w' me logo"
              className="h-8 w-8 rounded-[10px] object-cover"
            />
            <span className="font-display text-[20px] font-bold tracking-tight">Come w' me</span>
          </div>

          <img loading="lazy" decoding="async"             src="/signin-banner.png"
            alt="A group of friends meeting for a walk in the park"
            className="mt-6 h-[210px] w-full rounded-[16px] object-cover"
          />

          {mode === 'forgot' ? (
            <>
              <h1 className="mt-7 font-display text-[28px] font-bold leading-tight tracking-tight">Reset password</h1>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
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
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-alert/10 p-3 text-[15px] font-medium text-alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                )}
                {notice && <p role="status" className="rounded-xl bg-verified/10 p-3 text-[15px] font-medium text-verified">{notice}</p>}
                <button type="submit" className="btn-primary w-full rounded-[16px]" disabled={busy || !email.trim()}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => { setMode('in'); setError(null); setNotice(null) }}
                className="mt-4 w-full py-2 text-[15px] font-semibold text-amber"
              >
                Back to sign in
              </button>
            </>
          ) : codeStage === 'verify' ? (
            <>
              <h1 className="mt-7 font-display text-[28px] font-bold leading-tight tracking-tight">Check your inbox</h1>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>.<br />
                It expires in 5 minutes.
              </p>
              <form onSubmit={handleVerifyCode} className="mt-6 space-y-3">
                <div>
                  <label className="label" htmlFor="code-input">Your code</label>
                  <input
                    id="code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="field text-center text-[22px] font-semibold tracking-[0.45em]"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-alert/10 p-3 text-[15px] font-medium text-alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                )}
                {notice && <p role="status" className="rounded-xl bg-verified/10 p-3 text-[15px] font-medium text-verified">{notice}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy || code.trim().length < 6}>
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center text-[14px] font-semibold text-amber"
                    onClick={() => {
                      setCodeStage('email')
                      setMode('in')
                      setCode('')
                      setError(null)
                      setNotice(null)
                    }}
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center text-[14px] font-semibold text-muted transition hover:text-ink disabled:opacity-50"
                    onClick={() => void handleSendCode()}
                    disabled={busy}
                  >
                    Resend code
                  </button>
                </div>
              </form>
              <button
                type="button"
                onClick={() => { setMode('in'); setError(null); setNotice(null); setCodeStage('email'); setCode('') }}
                className="mt-5 w-full py-2 text-[15px] font-semibold text-amber"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-[28px] font-bold leading-tight tracking-tight">Come w&apos; me</h1>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                {mode === 'in'
                  ? 'Find something worth doing today and someone to do it with.'
                  : 'Create an account. It takes a minute.'}
              </p>
              <label
                ref={guidelinesRef}
                className={`mt-5 flex cursor-pointer items-start gap-2.5 rounded-[16px] border p-3 text-[14px] leading-relaxed transition ${
                  guidelinesFlash
                    ? 'border-alert bg-alert/10 text-alert ring-4 ring-alert/20'
                    : 'border-line bg-white text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff9f1c]"
                  checked={guidelinesChecked}
                  onChange={(event) => {
                    setGuidelinesChecked(event.target.checked)
                    if (event.target.checked) {
                      setGoogleError(null)
                      setError(null)
                      setGuidelinesFlash(false)
                    }
                  }}
                  aria-describedby="guidelines-label"
                />
                <span id="guidelines-label">
                  I agree to follow the{' '}
                  <Link
                    to="/community-guidelines"
                    onClick={(event) => event.stopPropagation()}
                    className="font-semibold text-amber underline underline-offset-2"
                  >
                    Community Guidelines
                  </Link>{' '}
                  and understand that violations may lead to a warning, temporary suspension, or permanent ban.
                </span>
                {guidelinesFlash && <AlertTriangle size={20} className="ml-auto shrink-0 text-alert" aria-hidden />}
              </label>
              {googleError && (
                <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-alert/10 p-3 text-[15px] font-medium text-alert">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{googleError}</span>
                </p>
              )}
              <div className="mt-3 flex flex-col gap-3">
                {/* Inside an installed PWA on iOS, codes are the fast path — put code first */}
                <div className={codeFirst ? 'order-3' : 'order-1'}>
                  <button
                    type="button"
                    onClick={handleGoogleTap}
                    className="flex w-full items-center justify-center gap-3 rounded-[16px] bg-ink py-3.5 text-[15px] font-bold text-canvas shadow-card transition enabled:hover:brightness-110 disabled:opacity-50"
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
                  <p className="mt-1.5 text-center text-[12px] leading-relaxed text-muted">
                    {googleAccounts.length > 0
                      ? 'Your saved Google accounts are one tap away.'
                      : 'You’ll pick from the Google accounts already on this device.'}
                  </p>
                </div>

                <div className="order-2 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                    {codeFirst ? 'or continue with Google' : 'or continue with email code'}
                  </span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <div className={codeFirst ? 'order-1' : 'order-3'}>
                  {codeFirst && (
                    <p className="flex w-fit items-center gap-1.5 rounded-full bg-sun/20 px-2.5 py-1 text-[11px] font-semibold text-amber">
                      <Smartphone size={13} aria-hidden /> Quick 6-digit code — no browser redirect needed
                    </p>
                  )}
                  <form id="email-code-form" onSubmit={handleSendCode} className="mt-2 space-y-2.5">
                    <label className="label" htmlFor="email-code">Your email</label>
                    <input
                      id="email-code"
                      type="email"
                      autoComplete="email"
                      className="field"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      aria-describedby="email-code-hint"
                    />
                    <button
                      type="submit"
                      className="btn-primary w-full"
                      disabled={busy || !email.trim()}
                    >
                      {busy ? 'Sending…' : 'Email me a code'}
                    </button>
                    <p id="email-code-hint" className="text-[13px] leading-relaxed text-muted">
                      We&apos;ll send a 6-digit code. No password, no browser redirect — signed in in seconds.
                    </p>
                  </form>
                </div>
              </div>
              <div className="my-3 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">or continue with password</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <form onSubmit={handleEmailSubmit} className="space-y-3">
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
                {mode === 'in' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setNotice(null) }}
                    className="block w-full text-right text-[14px] font-semibold text-amber"
                  >
                    Forgot password?
                  </button>
                )}
                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-alert/10 p-3 text-[15px] font-medium text-alert">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                )}
                {notice && <p role="status" className="rounded-xl bg-verified/10 p-3 text-[15px] font-medium text-verified">{notice}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy}>
                  {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <Sheet open={googlePickerOpen} onClose={() => setGooglePickerOpen(false)} title="Sign in with Google">
                <p className="pb-4 text-[14px] leading-relaxed text-muted">
                  Pick the Google account you want to sign in with. No email or password needed.
                </p>
                <div className="space-y-2 pb-4">
                  {googleAccounts.map((accountEmail) => (
                    <button
                      key={accountEmail}
                      type="button"
                      onClick={() => {
                        setGooglePickerOpen(false)
                        void handleGoogleSignIn(accountEmail)
                      }}
                      className="flex w-full items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-3 text-left transition hover:border-amber/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun/20 text-[14px] font-extrabold text-amber">
                        {accountEmail.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-ink">{accountEmail}</span>
                        <span className="block text-[13px] text-muted">Google account</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-ghost w-full"
                  onClick={() => {
                    setGooglePickerOpen(false)
                    void handleGoogleSignIn()
                  }}
                >
                  Sign in with a different Google account
                </button>
              </Sheet>
              <p className="mt-5 text-center text-[15px] text-muted">
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
        <p className="text-[13px] leading-relaxed text-muted">
          Meet in public places. Never send money to someone you have not met.
        </p>
        <div className="mt-2 flex justify-center gap-x-4 text-[14px] font-semibold text-amber">
          <Link to="/community-guidelines" className="underline underline-offset-2">Community Guidelines</Link>
          <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
