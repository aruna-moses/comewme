import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { MILESTONES } from '../lib/journey'

export default function TaskCompletionCelebration({
  activityTitle,
  completedCount,
  onClose,
  onFindNext,
}: {
  activityTitle: string
  completedCount: number
  onClose: () => void
  onFindNext: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const progress = Math.min(Math.max(completedCount, 0), 100)
  const level = Math.floor(progress / 10)
  const milestoneReached =
    completedCount > 0 && completedCount <= 100 && completedCount % 10 === 0
  const reachedTitle = milestoneReached ? MILESTONES[level - 1] : null
  const nextTitle = level < MILESTONES.length ? MILESTONES[level] : null
  const activitiesToNext = nextTitle ? (level + 1) * 10 - progress : 0

  useEffect(() => {
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
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
  }, [onClose])

  const confettiColors = ['#f7a233', '#ed784f', '#52a99d', '#9272c7', '#f0c85c']

  return (
    <>
      <div className="completion-confetti" aria-hidden>
        {Array.from({ length: 36 }, (_, index) => {
          const fromLeft = index % 2 === 0
          return (
            <span
              key={index}
              className={fromLeft ? 'confetti-piece-left' : 'confetti-piece-right'}
              style={{
                '--confetti-x': `${(30 + (index % 6) * 7) * (fromLeft ? 1 : -1)}vw`,
                '--confetti-y': `${25 + (index % 5) * 13}vh`,
                '--confetti-color': confettiColors[index % confettiColors.length],
                '--confetti-delay': `${(index % 9) * 35}ms`,
                '--confetti-top': `${4 + (index * 23) % 88}%`,
              } as CSSProperties}
            />
          )
        })}
      </div>
      <div className="milestone-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-completion-title"
          className="milestone-card relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white px-6 pb-6 pt-8 text-center shadow-lift"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-muted"
            aria-label="Close completion celebration"
          >
            <X size={18} aria-hidden />
          </button>
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-verified/10 text-verified">
            <Check size={30} strokeWidth={3} aria-hidden />
          </div>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[.18em] text-amber">
            Activity complete
          </p>
          <h2 id="task-completion-title" className="mt-1 font-display text-[25px] font-bold leading-tight">
            You did it!
          </h2>
          <p className="mt-2 text-[14px] font-semibold text-ink">{activityTitle}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Take a moment to celebrate showing up and making it happen.
          </p>
          {reachedTitle && (
            <p className="mt-4 rounded-2xl bg-sun/15 px-4 py-3 text-[13px] font-bold text-amber">
              Milestone unlocked: {reachedTitle}!
            </p>
          )}
          {nextTitle ? (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Keep the momentum going — {activitiesToNext} more {activitiesToNext === 1 ? 'activity' : 'activities'} to reach your next milestone,{' '}
              <span className="font-bold text-ink">{nextTitle}</span>.
            </p>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              You’ve reached every milestone. Here’s to the next great connection!
            </p>
          )}
          <button type="button" onClick={onFindNext} className="btn-primary mt-5 w-full">
            Find your next activity
            <ArrowRight size={17} aria-hidden />
          </button>
        </div>
      </div>
    </>
  )
}
