import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, ArrowRight, Footprints, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const QUESTIONS = [
  {
    prompt: "Where's a good place to meet?",
    options: [
      'A busy, public place everyone agrees on',
      "A stranger's home, without telling anyone",
      'Anywhere — no need to plan',
    ],
    correct: 0,
    reassurance: "Meet in public and tell someone where you're going.",
  },
  {
    prompt: 'Someone asks for your OTP. What do you do?',
    options: [
      'Keep it private and report the person',
      'Share it if they seem friendly',
      'Send it to the task group',
    ],
    correct: 0,
    reassurance: 'Your verification code is only for you. Never share it.',
  },
  {
    prompt: "A group member can't make it. How do you respond?",
    options: [
      'Be respectful and let the group know',
      'Post their phone number publicly',
      'Insult them in the chat',
    ],
    correct: 0,
    reassurance: 'Treat people kindly. Keep personal information private.',
  },
]

function getReturnTo(search: string) {
  const requested = new URLSearchParams(search).get('returnTo')
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return '/'
  if (requested.startsWith('/community-check')) return '/'
  return requested
}

export default function CommunityCheck() {
  const { profile, refreshProfile, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)

  if (profile?.community_check_passed_at && !completed) {
    return <Navigate to={getReturnTo(location.search)} replace />
  }

  const question = QUESTIONS[step]
  const isCorrect = selected === question.correct

  function choose(index: number) {
    setSelected(index)
    setError(index === question.correct ? null : 'That is not the safest choice. Please try again.')
  }

  function goBack() {
    if (step === 0) {
      navigate(-1)
      return
    }
    setStep((current) => current - 1)
    setSelected(null)
    setError(null)
  }

  async function continueCheck() {
    if (!isCorrect) return
    if (step < QUESTIONS.length - 1) {
      setStep((current) => current + 1)
      setSelected(null)
      setError(null)
      return
    }

    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ community_check_passed_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (updateError) throw updateError
      setCompleted(true)
      await refreshProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your community check.')
    } finally {
      setBusy(false)
    }
  }

  if (completed) {
    return (
      <div className="flex min-h-[100dvh] flex-col px-5 pb-6 pt-8">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#0B0B0F]" style={{ backgroundImage: 'linear-gradient(180deg,#f7a233,#ee7b1e)' }}>
            <Footprints size={21} aria-hidden />
          </span>
          <span className="font-display text-[20px] font-bold tracking-tight">Come w&apos; me</span>
        </div>
        <main className="flex flex-1 flex-col items-center pt-24 text-center">
          <span className="flex h-[110px] w-[110px] items-center justify-center rounded-full bg-[#eaf6ee] text-[#26815d]">
            <ShieldCheck size={54} strokeWidth={1.5} aria-hidden />
          </span>
          <h1 className="mt-7 font-display text-[24px] font-bold">You&apos;re one of us 🎉</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            3 out of 3. Thanks for looking out for the community. You can now post tasks and join people nearby.
          </p>
          <p role="status" className="mt-6 flex w-full items-center gap-2 rounded-[12px] border border-[#cce4d4] bg-[#eaf6ee] p-3 text-left text-[12px] text-[#26815d]">
            <CheckCircle2 size={20} className="shrink-0" aria-hidden />
            {session?.user.phone ? 'Phone verified · Community check passed' : 'Community check passed'}
          </p>
          <p className="mt-6 text-[12px] text-muted">Meet in public. Be kind. Keep your details safe.</p>
        </main>
        <button
          type="button"
          className="btn-primary w-full rounded-[16px]"
          onClick={() => navigate(getReturnTo(location.search), { replace: true })}
        >
          <ArrowRight size={18} aria-hidden />
          Continue
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-5 pb-6 pt-8">
      <header>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-ink"
            onClick={goBack}
            aria-label="Go back"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
          <h1 className="font-display text-[23px] font-bold">A little care goes far</h1>
        </div>
        <p className="mt-2 text-[14px] text-muted">Our community check takes less than a minute.</p>
        <div className="mt-5 flex gap-1.5" aria-label={`Question ${step + 1} of 3`}>
          {QUESTIONS.map((item, index) => (
            <span
              key={item.prompt}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-amber' : 'bg-[#eae6df]'}`}
            />
          ))}
        </div>
      </header>

      <main className="mt-6 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber">
          Question {step + 1} of {QUESTIONS.length}
        </p>
        <h2 className="mt-3 font-display text-[21px] font-bold leading-snug">{question.prompt}</h2>
        <div className="mt-5 space-y-3">
          {question.options.map((option, index) => {
            const active = selected === index
            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(index)}
                aria-pressed={active}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left text-[14px] ${
                  active && index === question.correct
                    ? 'border-amber bg-[#fff4d1] font-semibold text-ink'
                    : 'border-line bg-white text-ink'
                }`}
              >
                {active && index === question.correct
                  ? <CheckCircle2 size={20} className="shrink-0 text-amber" aria-hidden />
                  : <Circle size={20} className="shrink-0 text-[#9ba3b2]" aria-hidden />}
                <span>{option}</span>
              </button>
            )
          })}
        </div>

        {isCorrect && (
          <p role="status" className="mt-5 flex items-start gap-2 rounded-[12px] border border-[#cce4d4] bg-[#eaf6ee] p-3 text-[12px] leading-relaxed text-[#26815d]">
            <CheckCircle2 size={19} className="shrink-0" aria-hidden />
            {question.reassurance}
          </p>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>}
      </main>

      <footer className="pt-6">
        <button
          type="button"
          className="btn-primary w-full rounded-[16px]"
          onClick={() => void continueCheck()}
          disabled={!isCorrect || busy}
        >
          <ArrowRight size={18} aria-hidden />
          {busy ? 'Saving…' : step === QUESTIONS.length - 1 ? 'Complete community check' : 'Next question'}
        </button>
        <p className="mt-3 text-center text-[12px] text-muted">Complete all 3 questions before posting or joining.</p>
      </footer>
    </div>
  )
}
