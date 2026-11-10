import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setReady(true)
    })
    // The recovery link may already have produced a session before this page mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const timer = window.setTimeout(() => setExpired(true), 12_000)
    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password needs at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Those two don't match.")
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      window.setTimeout(() => navigate('/', { replace: true }), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-4">
          <Link to="/login" className="font-display text-[15px] font-bold tracking-[0.16em] text-amber">
            COME W&apos; ME
          </Link>
          <Link to="/login" className="btn-ghost btn-sm">
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] px-6 pt-10">
        {done ? (
          <div className="card p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verified/15">
              <Check size={26} className="text-verified" />
            </div>
            <h1 className="mt-4 font-display text-[24px] font-bold">Password updated</h1>
            <p className="mt-2 text-[13px] text-muted">You&apos;re back in. Redirecting you now…</p>
          </div>
        ) : !ready ? (
          <div className="card p-6 text-center">
            <p className="font-display text-[18px] font-bold">This link isn&apos;t working</p>
            <p className="mt-2 text-[13px] text-muted">
              {expired
                ? 'The reset link is probably expired or has already been used. Request a fresh one below.'
                : 'Waiting for your reset link to confirm…'}
            </p>
            <Link to="/login" className="btn-primary mt-4 w-full">
              Send me a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[28px] font-bold tracking-tight">Pick a new password</h1>
            <p className="mt-1.5 text-[13px] text-muted">Make it something you&apos;ll remember this time.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <div>
                <label className="label" htmlFor="new-password">New password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={show ? 'text' : 'password'}
                    className="field pr-12"
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-ink"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    aria-pressed={show}
                  >
                    {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type={show ? 'text' : 'password'}
                  className="field"
                  placeholder="Type it again"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>}
              <button type="submit" className="btn-primary w-full rounded-[16px]" disabled={busy || !password || !confirm}>
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
