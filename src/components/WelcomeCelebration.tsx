import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { findPersona } from '../components/PersonalitySelector'
import { personaDisplayName, personaImageSrc } from '../lib/personas'
import { MILESTONES } from '../lib/journey'

const REVEAL_MS = 1800
const CONFETTI_COLORS = ['#f7a233', '#ed784f', '#52a99d', '#9272c7', '#f0c85c']

function WelcomeConfetti() {
  return (
    <>
      {Array.from({ length: 36 }, (_, index) => {
        const fromLeft = index % 2 === 0
        return (
          <span
            key={index}
            className={fromLeft ? 'confetti-piece-left' : 'confetti-piece-right'}
            style={
              {
                '--confetti-x': `${(30 + (index % 6) * 7) * (fromLeft ? 1 : -1)}vw`,
                '--confetti-y': `${25 + (index % 5) * 13}vh`,
                '--confetti-color': CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                '--confetti-delay': `${(index % 9) * 35}ms`,
                '--confetti-top': `${4 + (index * 23) % 88}%`,
              } as CSSProperties
            }
          />
        )
      })}
    </>
  )
}

/**
 * First-run welcome celebration: the new user's default character spins into
 * view with confetti, then hands off to momentum - post or join an activity to
 * level that character up. Dismissible (persisted per user) but never before the
 * spin reveal has played.
 */
export default function WelcomeCelebration() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'reveal' | 'prompt'>('reveal')
  const persona = profile?.character_persona ? findPersona(profile.character_persona) : null
  const dismissKey = profile ? `comewme-welcome-dismissed-${profile.id}` : null
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!dismissKey) return
    try {
      setDismissed(window.localStorage.getItem(dismissKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [dismissKey])

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('prompt'), REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!profile || !persona) return null
  if (dismissed) return null
  if (Math.max(0, profile.tasks_completed) > 0) return null

  const completed = Math.max(0, profile.tasks_completed)
  const level = Math.min(Math.floor(completed / 10), 10)
  const remainder = level === 10 ? 10 : completed % 10
  const nextMilestone = Math.min((level + 1) * 10, 100)
  const currentTitle = level === 0 ? 'The First Hello' : MILESTONES[level - 1]
  const nextTitle = level < 10 ? MILESTONES[level] : 'Your next chapter'
  const personaName = personaDisplayName(persona.id)
  const activitiesToNext = nextMilestone - completed
  const profileId = profile.id

  function close() {
    if (!dismissKey) return
    try {
      window.localStorage.setItem(dismissKey, '1')
    } catch {
      // Best effort only - skip must survive even when storage is unavailable.
    }
    setDismissed(true)
  }

  function handleFindActivity() {
    close()
    navigate('/', { replace: true })
  }

  function handlePickCharacter() {
    close()
    navigate(`/profile/${profileId}`)
  }

  return (
    <>
      <div className="completion-confetti" aria-hidden>
        <WelcomeConfetti />
      </div>

      <div className="milestone-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-character-title"
          className="milestone-card relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white px-6 pb-6 pt-8 text-center shadow-lift"
        >
          <button
            type="button"
            onClick={close}
            disabled={phase === 'reveal'}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-muted transition enabled:hover:bg-line disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Skip the welcome celebration"
          >
            <X size={18} aria-hidden />
          </button>

          <div className="confetti-burst" aria-hidden>
            <WelcomeConfetti />
          </div>

          <div
            className="relative mx-auto flex h-[150px] w-[130px] items-end justify-center overflow-hidden rounded-[24px] bg-sun/20"
            style={{ perspective: '800px' }}
          >
            <img
              src={personaImageSrc(persona.id)}
              alt={`${personaName}, your welcome character`}
              className="character-spin-reveal h-full w-full object-contain object-bottom"
            />
          </div>

          {phase === 'reveal' ? (
            <>
              <p className="mt-5 text-[13px] font-bold uppercase tracking-[.18em] text-amber">
                Welcome to Come w&apos; me
              </p>
              <h2 id="welcome-character-title" className="mt-1 font-display text-[25px] font-bold leading-tight">
                {personaName}
              </h2>
              <p className="mt-2 text-[15px] font-bold text-ink">{currentTitle}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {level === 0
                  ? 'Every great connection starts with one hello.'
                  : `You’ve unlocked the ${currentTitle} chapter. Keep making room for new connections.`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-[13px] font-bold uppercase tracking-[.18em] text-amber">
                Your character · level {level}
              </p>
              <h2 id="welcome-character-title" className="mt-1 font-display text-[25px] font-bold leading-tight">
                {personaName}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Post an activity or join one - every completed activity takes <span className="font-bold text-ink">{personaName}</span> to the next level and unlocks the next milestone badge.
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Next up: <span className="font-bold text-ink">{nextTitle}</span> - {activitiesToNext} {activitiesToNext === 1 ? 'activity' : 'activities'} to go.
              </p>
            </>
          )}

          {phase === 'prompt' && (
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" className="btn-primary" onClick={handleFindActivity}>
                Find an activity to level up
                <ArrowRight size={17} aria-hidden />
              </button>
              <button type="button" className="btn-ghost" onClick={handlePickCharacter}>
                Pick a character that vibes with you
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
