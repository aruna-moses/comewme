import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff, Footprints, Phone, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    signInWithPhone,
    verifyPhoneOtp,
    session,
    profile,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const returnTo = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//')
    ? location.state.from
    : '/'

  const [method, setMethod] = useState<'phone' | 'email'>('phone')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [phone, setPhone] = useState('')
  const [phoneSent, setPhoneSent] = useState(false)
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [guidelinesChecked, setGuidelinesChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (session && profile) navigate(location.state?.from ?? '/', { replace: true })
  }, [session, profile, navigate, location.state])

  function normalizedPhone() {
    const value = phone.replace(/[\s()-]/g, '')
    if (!/^\+[1-9]\d{7,14}$/.test(value)) {
      throw new Error('Enter your number with country code, for example +234 803 000 1234.')
    }
    return value
  }

  async function requestPhoneCode() {
    setError(null)
    setNotice(null)
    if (!guidelinesChecked) {
      setError('Please read and agree to the Community Guidelines before continuing.')
      return
    }
    setBusy(true)
    try {
      await signInWithPhone(normalizedPhone())
      setPhoneSent(true)
      setCode('')
      setNotice('A verification code has been sent to your phone.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send verification code.')
    } finally {
      setBusy(false)
    }
  }

  function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    void requestPhoneCode()
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!guidelinesChecked) {
      setError('Please agree to follow the Community Guidelines before signing in.')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your messages.')
      return
    }
    setBusy(true)
    try {
      await verifyPhoneOtp(normalizedPhone(), code)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify this code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!guidelinesChecked) {
      setError('Please agree to follow the Community Guidelines before continuing.')
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
      setError('Please agree to follow the Community Guidelines before continuing.')
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
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white" style={{ backgroundImage: 'linear-gradient(180deg,#f7a233,#ee7b1e)' }}>
              <Footprints size={21} aria-hidden />
            </span>
            <span className="font-display text-[20px] font-bold tracking-tight">Come w&apos; me</span>
          </div>

          {method === 'phone' && (
            <img
              src="/figma/lagos-community.jpg"
              alt="Friends walking together in Lagos"
              className="mt-6 h-[210px] w-full rounded-[16px] object-cover"
            />
          )}

          {method === 'phone' ? (
            <>
              <h1 className="mt-6 font-display text-[24px] font-bold leading-tight">
                {phoneSent ? 'Check your messages' : 'Good company. Real life.'}
              </h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                {phoneSent
                  ? `Enter the 6-digit code sent to ${phone}.`
                  : 'Run an errand, learn something, or make a plan. Find your people in Lagos.'}
              </p>

              <label className="mt-5 flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-muted">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#ff9f1c]"
                  checked={guidelinesChecked}
                  onChange={(event) => setGuidelinesChecked(event.target.checked)}
                />
                <span>
                  I agree to follow the Community Guidelines and understand that violations may lead to a warning,
                  temporary suspension, or permanent ban.
                </span>
              </label>

              {phoneSent ? (
                <form onSubmit={handleVerifyCode} className="mt-6">
                  <label className="label" htmlFor="phone-code">Verification code</label>
                  <div className="relative">
                    <div aria-hidden className="pointer-events-none flex gap-2">
                      {Array.from({ length: 6 }, (_, index) => (
                        <span
                          key={index}
                          className={`flex h-[62px] min-w-0 flex-1 items-center justify-center rounded-[12px] border bg-white text-[22px] font-semibold ${
                            code.length === index ? 'border-amber' : 'border-line'
                          }`}
                        >
                          {code[index] ?? ''}
                        </span>
                      ))}
                    </div>
                    <input
                      id="phone-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="absolute inset-0 h-full w-full cursor-text opacity-0"
                      aria-label="Enter the 6-digit verification code"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-5 text-[14px] font-semibold text-amber"
                    onClick={() => void requestPhoneCode()}
                    disabled={busy}
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    className="mt-4 block text-[12px] text-muted"
                    onClick={() => {
                      setPhoneSent(false)
                      setCode('')
                      setError(null)
                      setNotice(null)
                    }}
                  >
                    Wrong number? Change phone number
                  </button>
                  <div className="mt-5 flex items-start gap-2 rounded-[12px] border border-[#edd996] bg-[#fff4d1] p-3 text-[12px] leading-relaxed text-[#7a622f]">
                    <ShieldCheck size={20} className="shrink-0 text-amber" aria-hidden />
                    <p>Never share your verification code, even with someone claiming to be from Come w&apos; me.</p>
                  </div>
                  {error && <p role="alert" className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>}
                  {notice && <p role="status" className="mt-4 text-[12px] text-verified">{notice}</p>}
                  <button type="submit" className="btn-primary mt-7 w-full rounded-[16px]" disabled={busy || code.length !== 6 || !guidelinesChecked}>
                    <Check size={18} aria-hidden />
                    {busy ? 'Verifying…' : 'Verify phone'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSendCode} className="mt-6">
                  <label className="label" htmlFor="phone">Your phone number</label>
                  <div className="flex min-h-[54px] items-center gap-3 rounded-[12px] bg-white px-4">
                    <Phone size={19} className="text-muted" aria-hidden />
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted/70"
                      placeholder="+234 803 000 1234"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <p className="mt-5 text-[12px] leading-relaxed text-muted">
                    Use your Nigerian number. We&apos;ll text you a one-time code to get started.
                  </p>
                  <div className="mt-5 flex items-start gap-2 rounded-[12px] border border-[#edd996] bg-[#fff4d1] p-3 text-[12px] leading-relaxed text-[#7a622f]">
                    <ShieldCheck size={20} className="shrink-0 text-amber" aria-hidden />
                    <p>Phone verification helps keep the community safer. A quick community check comes next, before you post or join.</p>
                  </div>
                  {error && <p role="alert" className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>}
                  {notice && <p role="status" className="mt-4 text-[12px] text-verified">{notice}</p>}
                  <button type="submit" className="btn-primary mt-7 w-full rounded-[16px]" disabled={busy || !phone.trim() || !guidelinesChecked}>
                    <ArrowRight size={18} aria-hidden />
                    {busy ? 'Sending code…' : 'Send verification code'}
                  </button>
                  <p className="mt-3 text-center text-[12px] text-muted">Your phone number stays private.</p>
                </form>
              )}
              <button
                type="button"
                className="mt-5 w-full py-2 text-[13px] font-semibold text-amber"
                onClick={() => {
                  setMethod('email')
                  setError(null)
                  setNotice(null)
                }}
              >
                Use email instead
              </button>
            </>
          ) : (
            <>
              <h1 className="mt-7 font-display text-[28px] font-bold leading-tight tracking-tight">Come w&apos; me</h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                {mode === 'in'
                  ? 'Find something worth doing today and someone to do it with.'
                  : 'Create an account. It takes a minute.'}
              </p>
              <label className="mt-5 flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-muted">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#ff9f1c]"
                  checked={guidelinesChecked}
                  onChange={(event) => setGuidelinesChecked(event.target.checked)}
                />
                <span>
                  I agree to follow the Community Guidelines and understand that violations may lead to a warning,
                  temporary suspension, or permanent ban.
                </span>
              </label>
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
                {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>}
                {notice && <p role="status" className="rounded-xl bg-verified/10 p-3 text-[13px] font-medium text-verified">{notice}</p>}
                <button type="submit" className="btn-primary w-full" disabled={busy || !guidelinesChecked}>
                  {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">or</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <button type="button" onClick={() => void handleGoogleSignIn()} className="btn-ghost w-full" disabled={busy || !guidelinesChecked}>
                Continue with Google
              </button>
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
              <button
                type="button"
                className="mt-4 w-full py-2 text-[13px] font-semibold text-amber"
                onClick={() => {
                  setMethod('phone')
                  setError(null)
                  setNotice(null)
                }}
              >
                Use phone number instead
              </button>
            </>
          )}
        </div>
      </div>

      <p className="px-8 pb-6 text-center text-[11px] leading-relaxed text-muted">
        Meet in public places. Never send money to someone you have not met.
      </p>
    </div>
  )
}
