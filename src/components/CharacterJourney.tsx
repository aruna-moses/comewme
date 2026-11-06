import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronRight, Sparkles, X } from 'lucide-react'
import { MILESTONES } from '../lib/journey'
import { personaDisplayName, personaImageSrc } from '../lib/personas'
import type { Profile } from '../types'

export default function CharacterJourney({
  profile,
  isOwner,
}: {
  profile: Profile
  isOwner: boolean
}) {
  const persona = profile.character_persona
  const completed = Math.max(0, profile.tasks_completed)
  const level = Math.min(Math.floor(completed / 10), 10)
  const remainder = level === 10 ? 10 : completed % 10
  const nextMilestone = Math.min((level + 1) * 10, 100)
  const currentTitle = level === 0 ? 'The First Hello' : MILESTONES[level - 1]
  const nextTitle = level < 10 ? MILESTONES[level] : 'Your next chapter'
  const overallProgress = Math.min(completed, 100)
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const celebrationCloseRef = useRef<HTMLButtonElement>(null)
  const celebrationDialogRef = useRef<HTMLDivElement>(null)
  const storageKey = `comewme-milestone-${profile.id}`

  useEffect(() => {
    if (!isOwner || !persona || level === 0) return
    try {
      const celebrated = Number(window.localStorage.getItem(storageKey) ?? 0)
      if (level > celebrated) setCelebrationOpen(true)
    } catch {
      setCelebrationOpen(true)
    }
  }, [isOwner, level, persona, storageKey])

  useEffect(() => {
    if (!celebrationOpen) return
    celebrationCloseRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCelebration()
        return
      }
      if (event.key !== 'Tab') return
      const buttons = celebrationDialogRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not([disabled])',
      )
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [celebrationOpen, level, storageKey])

  function closeCelebration() {
    try {
      window.localStorage.setItem(storageKey, String(level))
    } catch {
      // The reward remains dismissible even when browser storage is unavailable.
    }
    setCelebrationOpen(false)
  }

  const trackStyle = { '--journey-progress': `${overallProgress}%` } as CSSProperties
  const markerStyle = { left: `${Math.min(Math.max(overallProgress, 4), 96)}%` }

  if (!persona) return null

  const personaName = personaDisplayName(persona)
  const personaImage = personaImageSrc(persona)

  return (
    <>
      <section
        className="mt-4 overflow-hidden rounded-[24px] border border-line bg-white shadow-card"
        aria-labelledby="journey-title"
      >
        <div className="journey-hero relative overflow-hidden bg-gradient-to-br from-[#fff8e9] via-[#fffdf8] to-[#f8eee3] px-4 pb-4 pt-4">
          <div className="pointer-events-none absolute -right-7 -top-10 h-40 w-40 rounded-full bg-sun/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-[138px] w-[108px] shrink-0 items-end justify-center overflow-hidden rounded-[20px] bg-white/70 pb-1 shadow-sm ring-1 ring-white/80">
              <img
                src={personaImage}
                alt={`${personaName}, your journey character`}
                className="h-full w-full object-contain object-bottom"
              />
              {level > 0 && (
                <span className="absolute -right-1 -top-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-amber px-1 text-[10px] font-extrabold text-white shadow">
                  {level}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.15em] text-amber">
                <Sparkles size={13} aria-hidden /> Your social journey
              </p>
              <h2 id="journey-title" className="mt-1 font-display text-[20px] font-bold leading-tight text-ink">
                {currentTitle}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {level === 0
                  ? 'Every great connection starts with one hello.'
                  : `You’ve unlocked the ${currentTitle} chapter. Keep making room for new connections.`}
              </p>
              <p className="mt-3 text-[11px] font-semibold text-ink/75">
                {completed} {completed === 1 ? 'activity' : 'activities'} completed
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[12px] font-bold text-ink">Next up: {nextTitle}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {level === 10
                  ? 'You’ve reached the final milestone!'
                  : `${remainder} of 10 activities · ${10 - remainder} to go`}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-sun/20 px-2.5 py-1 text-[10px] font-bold text-amber">
              {level}/10 levels
            </span>
          </div>

          <div
            className="journey-track relative mt-9 h-2 rounded-full bg-line"
            style={trackStyle}
            role="progressbar"
            aria-label="Progress toward the final social journey milestone"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress}
          >
            <div className="journey-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#f7a233] to-[#ed784f]" />
            {MILESTONES.map((title, index) => {
              const checkpoint = (index + 1) * 10
              const reached = completed >= checkpoint
              return (
                <span
                  key={title}
                  className={`journey-checkpoint absolute top-1/2 flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 ${
                    reached ? 'border-amber bg-amber' : 'border-line bg-white'
                  }`}
                  style={{ left: `${checkpoint}%` }}
                  title={`${checkpoint}: ${title}`}
                  aria-label={`${checkpoint} activities: ${title}${reached ? ', reached' : ''}`}
                />
              )
            })}
            <div className="journey-character absolute bottom-full z-10 -translate-x-1/2" style={markerStyle}>
              <img
                src={personaImage}
                alt={`${personaName} journey character`}
                className="journey-persona-bob h-10 w-8 object-contain object-bottom"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[9px] font-medium text-muted">
            <span>Start</span>
            <span>10 milestones</span>
            <span>100</span>
          </div>
          <ol className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Personality milestones">
            {MILESTONES.map((title, index) => {
              const checkpoint = (index + 1) * 10
              const reached = completed >= checkpoint
              const next = level < 10 && checkpoint === nextMilestone
              const final = level === 10 && checkpoint === 100
              return (
                <li
                  key={title}
                  aria-current={next || final ? 'step' : undefined}
                  className={`min-w-[116px] rounded-[13px] border px-2.5 py-2 ${
                    next || final ? 'border-amber bg-sun/10' : 'border-line bg-canvas'
                  }`}
                >
                  <p className="text-[9px] font-semibold text-muted">{checkpoint} activities</p>
                  <p className={`mt-0.5 text-[10px] font-bold leading-tight ${reached ? 'text-ink' : 'text-muted'}`}>
                    {title}
                  </p>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex items-center gap-2 rounded-[13px] bg-canvas px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sun/20 text-amber">
              <Sparkles size={14} aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted">
              Each 10 completed activities unlocks a new chapter in your journey.
            </p>
            <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
          </div>
        </div>
      </section>

      {celebrationOpen && (
        <div className="milestone-overlay fixed inset-0 z-[70] flex items-center justify-center bg-ink/55 p-5 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-celebration-title"
            ref={celebrationDialogRef}
            className="milestone-card relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white px-6 pb-6 pt-8 text-center shadow-lift"
          >
            <button
              type="button"
              onClick={closeCelebration}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-muted"
              aria-label="Close milestone celebration"
            >
              <X size={18} aria-hidden />
            </button>
            <div className="confetti-burst" aria-hidden>
              {Array.from({ length: 22 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    '--confetti-x': `${Math.cos((index / 22) * Math.PI * 2) * (80 + (index % 4) * 12)}px`,
                    '--confetti-y': `${Math.sin((index / 22) * Math.PI * 2) * (70 + (index % 5) * 11)}px`,
                    '--confetti-color': ['#f7a233', '#ed784f', '#52a99d', '#9272c7', '#f0c85c'][index % 5],
                    '--confetti-delay': `${(index % 8) * 35}ms`,
                  } as CSSProperties}
                />
              ))}
            </div>
            <div className="relative mx-auto flex h-[150px] w-[130px] items-end justify-center overflow-hidden rounded-[24px] bg-gradient-to-br from-[#fff5dd] to-[#f8e6d9]">
              <img
                src={personaImage}
                alt={`${personaName}, your journey character`}
                className="journey-persona-bob h-full w-full object-contain object-bottom"
              />
              <span className="absolute -right-2 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber text-sm font-extrabold text-white shadow">
                {level}
              </span>
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[.18em] text-amber">
              Milestone unlocked
            </p>
            <h2 id="milestone-celebration-title" className="mt-1 font-display text-[25px] font-bold leading-tight">
              {currentTitle}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              You’ve completed {level * 10} activities together. Keep showing up, making memories, and see where your journey goes next.
            </p>
            <button
              type="button"
              ref={celebrationCloseRef}
              onClick={closeCelebration}
              className="btn-primary mt-5 w-full"
            >
              Keep the good times going
            </button>
          </div>
        </div>
      )}
    </>
  )
}
