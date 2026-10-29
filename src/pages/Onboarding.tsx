import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { isUsernameTaken } from '../lib/api'
import { AREAS, CATEGORIES } from '../types'
import type { Category, Profile } from '../types'

const STEPS = ['Name', 'Area', 'Interests', 'Rules'] as const

export default function Onboarding() {
  const { session, profile, completeOnboarding } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [area, setArea] = useState(profile?.area ?? 'Yaba')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [interests, setInterests] = useState<Category[]>(profile?.interests ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already onboarded? Nothing to do here.
  useEffect(() => {
    if (profile) navigate('/', { replace: true })
  }, [profile, navigate])

  function toggleInterest(c: Category) {
    setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function finish() {
    if (!session) return
    setError(null)
    setBusy(true)
    try {
      const handle = username.trim().toLowerCase()
      if (handle.length < 3) throw new Error('Your username needs at least 3 characters.')
      if (!/^[a-z0-9_]+$/.test(handle)) {
        throw new Error('Usernames can only use letters, numbers and underscores.')
      }
      if (await isUsernameTaken(handle)) {
        throw new Error('That username is taken. Try another.')
      }

      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          display_name: displayName.trim(),
          username: handle,
          area,
          city: 'Lagos',
          bio: bio.trim() || null,
          interests,
        })
        .select()
        .single()

      if (insertError) throw insertError
      completeOnboarding(data as Profile)
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-5 pb-10 pt-10">
      <div className="mx-auto w-full max-w-[420px]">
        {/* progress */}
        <div className="mb-6 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="h-1.5 flex-1 rounded-full"
              style={{
                backgroundImage:
                  i <= step ? 'linear-gradient(135deg,#FFD93D,#FF9F1C)' : undefined,
                backgroundColor: i <= step ? undefined : '#EDEDE8',
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 className="font-display text-[26px] font-bold leading-tight">
              What should people call you?
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">
              Your real name builds trust. Your username keeps it human.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  Display name
                </label>
                <input
                  id="name"
                  className="field"
                  placeholder="Amaka Balogun"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div>
                <label className="label" htmlFor="handle">
                  Username
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-muted">@</span>
                  <input
                    id="handle"
                    className="field"
                    placeholder="amaka_b"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    maxLength={24}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-[26px] font-bold leading-tight">Where are you based?</h1>
            <p className="mt-1.5 text-[14px] text-muted">
              We use this to show you things nearby. You can change it later.
            </p>

            <div className="mt-6">
              <label className="label" htmlFor="area">
                Area
              </label>
              <select
                id="area"
                className="field"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="bio">
                A line about you
              </label>
              <textarea
                id="bio"
                className="field min-h-[96px] resize-none"
                placeholder="Backend dev. Always up for suya and a long walk."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={240}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-[26px] font-bold leading-tight">
              What are you into?
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">
              Pick a few. This is what the "For you" filter runs on.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => toggleInterest(c.value)}
                  className={`chip ${interests.includes(c.value) ? 'chip-active' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-[26px] font-bold leading-tight">
              Four rules, that's it
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">
              These are not decoration. Break them and you get removed.
            </p>

            <div className="mt-6 space-y-3">
              {[
                {
                  n: '1',
                  t: 'Meet in public',
                  d: 'The first meet is always somewhere busy and well known. Never a house.',
                },
                {
                  n: '2',
                  t: 'No money upfront',
                  d: 'Nobody pays to join. If someone asks for a transfer, report them.',
                },
                {
                  n: '3',
                  t: 'Say when you cannot come',
                  d: 'A message costs nothing. Leaving people waiting is what gets you blocked.',
                },
                {
                  n: '4',
                  t: 'Be the person you would want to meet',
                  d: 'Photos are not taken without asking. Nobody owes you a conversation.',
                },
              ].map((r) => (
                <div key={r.n} className="card flex gap-3 p-4">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold"
                    style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
                  >
                    {r.n}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{r.t}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{r.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>
        )}

        <div className="mt-7 flex gap-3">
          {step > 0 && (
            <button className="btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              className="btn-primary flex-1"
              disabled={
                (step === 0 && (!displayName.trim() || username.trim().length < 3)) ||
                (step === 2 && interests.length === 0)
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button className="btn-primary flex-1" disabled={busy} onClick={finish}>
              {busy ? 'Setting up…' : 'I agree, let me in'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
