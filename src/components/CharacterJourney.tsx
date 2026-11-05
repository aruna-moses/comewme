import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, ChevronRight, Sparkles, WandSparkles, X } from 'lucide-react'
import { updateProfile } from '../lib/api'
import { MILESTONES } from '../lib/journey'
import type { Profile } from '../types'
import Sheet from './Sheet'

type CharacterStyle = 'feminine' | 'masculine'
type SkinTone = 'deep' | 'cocoa' | 'warm' | 'golden' | 'peach' | 'fair'
type ShirtStyle = 'sunset' | 'lagoon' | 'sky' | 'violet' | 'midnight'
type BottomStyle = 'trousers-denim' | 'trousers-sand' | 'skirt-coral' | 'skirt-lilac'
type ShoeStyle = 'sneakers-cream' | 'sneakers-coral'

type CharacterConfig = {
  character_style: CharacterStyle
  character_skin: SkinTone
  character_shirt: ShirtStyle
  character_bottom: BottomStyle
  character_shoes: ShoeStyle
}

const DEFAULT_CHARACTER: CharacterConfig = {
  character_style: 'feminine',
  character_skin: 'cocoa',
  character_shirt: 'sunset',
  character_bottom: 'trousers-denim',
  character_shoes: 'sneakers-cream',
}

const SKIN_TONES: { id: SkinTone; label: string; color: string }[] = [
  { id: 'deep', label: 'Deep', color: '#573326' },
  { id: 'cocoa', label: 'Cocoa', color: '#80513c' },
  { id: 'warm', label: 'Warm brown', color: '#a96f51' },
  { id: 'golden', label: 'Golden', color: '#c88d68' },
  { id: 'peach', label: 'Peach', color: '#e0ad8a' },
  { id: 'fair', label: 'Fair', color: '#f0cdb0' },
]

const SHIRTS: { id: ShirtStyle; label: string; color: string }[] = [
  { id: 'sunset', label: 'Sunset', color: '#ed824f' },
  { id: 'lagoon', label: 'Lagoon', color: '#41a99d' },
  { id: 'sky', label: 'Sky', color: '#638bd5' },
  { id: 'violet', label: 'Violet', color: '#9272c7' },
  { id: 'midnight', label: 'Midnight', color: '#343b50' },
]

const BOTTOMS: { id: BottomStyle; label: string; color: string }[] = [
  { id: 'trousers-denim', label: 'Denim trousers', color: '#526b9a' },
  { id: 'trousers-sand', label: 'Sand trousers', color: '#bd9565' },
  { id: 'skirt-coral', label: 'Coral skirt', color: '#d87379' },
  { id: 'skirt-lilac', label: 'Lilac skirt', color: '#9676bb' },
]

const SHOES: { id: ShoeStyle; label: string; color: string }[] = [
  { id: 'sneakers-cream', label: 'Cream sneakers', color: '#f3e7d0' },
  { id: 'sneakers-coral', label: 'Coral sneakers', color: '#e78b70' },
]

const SKIN_COLORS: Record<SkinTone, string> = Object.fromEntries(
  SKIN_TONES.map(({ id, color }) => [id, color]),
) as Record<SkinTone, string>
const SHIRT_COLORS: Record<ShirtStyle, string> = Object.fromEntries(
  SHIRTS.map(({ id, color }) => [id, color]),
) as Record<ShirtStyle, string>
const BOTTOM_COLORS: Record<BottomStyle, string> = Object.fromEntries(
  BOTTOMS.map(({ id, color }) => [id, color]),
) as Record<BottomStyle, string>
const SHOE_COLORS: Record<ShoeStyle, string> = Object.fromEntries(
  SHOES.map(({ id, color }) => [id, color]),
) as Record<ShoeStyle, string>

function characterConfig(profile: Profile): CharacterConfig {
  return {
    character_style: profile.character_style ?? DEFAULT_CHARACTER.character_style,
    character_skin: profile.character_skin ?? DEFAULT_CHARACTER.character_skin,
    character_shirt: profile.character_shirt ?? DEFAULT_CHARACTER.character_shirt,
    character_bottom: profile.character_bottom ?? DEFAULT_CHARACTER.character_bottom,
    character_shoes: profile.character_shoes ?? DEFAULT_CHARACTER.character_shoes,
  }
}

function Character({
  config,
  level,
  className = '',
}: {
  config: CharacterConfig
  level: number
  className?: string
}) {
  const instanceId = useId().replace(/:/g, '')
  const skin = SKIN_COLORS[config.character_skin]
  const shirt = SHIRT_COLORS[config.character_shirt]
  const bottom = BOTTOM_COLORS[config.character_bottom]
  const shoes = SHOE_COLORS[config.character_shoes]
  const feminine = config.character_style === 'feminine'
  const skirt = config.character_bottom.startsWith('skirt')
  const id = `character-${instanceId}`

  return (
    <svg
      className={className}
      viewBox="0 0 120 160"
      role="img"
      aria-label={`${feminine ? 'Feminine' : 'Masculine'} character, level ${level}`}
    >
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={skin} />
          <stop offset="1" stopColor={skin} stopOpacity=".78" />
        </linearGradient>
        <linearGradient id={`${id}-shirt`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={shirt} />
          <stop offset="1" stopColor={shirt} stopOpacity=".76" />
        </linearGradient>
        <linearGradient id={`${id}-bottom`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={bottom} />
          <stop offset="1" stopColor={bottom} stopOpacity=".78" />
        </linearGradient>
        <linearGradient id={`${id}-shoes`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={shoes} />
          <stop offset="1" stopColor={shoes} stopOpacity=".76" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#32251d" floodOpacity=".16" />
        </filter>
      </defs>
      <ellipse cx="60" cy="151" rx="33" ry="5" fill="#33271f" opacity=".12" />
      {level >= 3 && (
        <path d="M35 64 19 108l14 8 8-29M85 64l16 44-14 8-8-37" fill="#f3a43b" opacity=".78" />
      )}
      <g filter={`url(#${id}-shadow)`}>
        {feminine && (
          <path
            d="M37 43C27 20 38 6 59 5c23-1 35 17 26 41l-2 48q-5 8-11 0l-1-41c-4 3-8 4-12 4s-8-1-12-4l-1 41q-6 8-11 0z"
            fill="#30272a"
          />
        )}
        {feminine ? (
          <>
            <path d="M48 61h24v13H48z" fill={`url(#${id}-skin)`} />
            <path d="M46 64q14-5 28 0l10 34-24 8-24-8z" fill={`url(#${id}-shirt)`} stroke="#493c3c" strokeOpacity=".2" strokeWidth="1.5" />
            <path d="M45 68q-7-4-10 2l-8 23 9 5 10-15M75 68q7-4 10 2l8 23-9 5-10-15" fill={`url(#${id}-shirt)`} stroke="#493c3c" strokeOpacity=".18" strokeWidth="1.5" />
            <path d="M36 94q-3 5 1 9l5 3 6-16M84 94q3 5-1 9l-5 3-6-16" fill={`url(#${id}-skin)`} />
            {skirt ? (
              <>
                <path d="M39 98q21 7 42 0l7 31q-28 9-56 0z" fill={`url(#${id}-bottom)`} stroke="#543e43" strokeOpacity=".2" strokeWidth="1.5" />
                <path d="M40 102q20 6 40 0M48 104l-3 22M60 106v22M72 104l4 22" fill="none" stroke="#fff" strokeOpacity=".34" strokeWidth="1.5" />
                <path d="M47 128v13h11v-13M63 128v13h11v-13" fill={`url(#${id}-skin)`} />
              </>
            ) : (
              <>
                <path d="M40 98h40l3 34q-21 7-46 0z" fill={`url(#${id}-bottom)`} stroke="#394252" strokeOpacity=".2" strokeWidth="1.5" />
                <path d="M60 105v28M46 102l2 27M74 102l-2 27" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.5" />
                <path d="M47 130v11h11v-11M63 130v11h11v-11" fill={`url(#${id}-skin)`} />
              </>
            )}
          </>
        ) : (
          <>
            <path d="M47 61h26v14H47z" fill={`url(#${id}-skin)`} />
            <path d="M37 63q23-13 46 0l11 37q-34 12-68 0z" fill={`url(#${id}-shirt)`} stroke="#493c3c" strokeOpacity=".2" strokeWidth="1.5" />
            <path d="M39 67q-8-4-12 3l-9 24 11 5 14-18M81 67q8-4 12 3l9 24-11 5-14-18" fill={`url(#${id}-shirt)`} stroke="#493c3c" strokeOpacity=".2" strokeWidth="1.5" />
            <path d="M29 94q-3 6 2 10l6 2 7-17M91 94q3 6-2 10l-6 2-7-17" fill={`url(#${id}-skin)`} />
            {skirt ? (
              <>
                <path d="M39 98q21 7 42 0l7 31q-28 9-56 0z" fill={`url(#${id}-bottom)`} stroke="#543e43" strokeOpacity=".2" strokeWidth="1.5" />
                <path d="M40 102q20 6 40 0M48 104l-3 22M60 106v22M72 104l4 22" fill="none" stroke="#fff" strokeOpacity=".34" strokeWidth="1.5" />
                <path d="M47 128v13h11v-13M63 128v13h11v-13" fill={`url(#${id}-skin)`} />
              </>
            ) : (
              <>
                <path d="M40 98h40l4 33-15 3-4-28-3 29-16-3z" fill={`url(#${id}-bottom)`} stroke="#394252" strokeOpacity=".2" strokeWidth="1.5" />
                <path d="M60 105v28M45 101l2 28M76 101l-2 28" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1.5" />
                <path d="M48 130v11h11v-11M63 130v11h11v-11" fill={`url(#${id}-skin)`} />
              </>
            )}
          </>
        )}
        <path d="M43 140h16l2 7H41q-2-4 2-7M63 140h15q5 2 3 7H62z" fill={`url(#${id}-shoes)`} stroke="#483b36" strokeOpacity=".16" strokeWidth="1.5" />
        <path d="M44 145h14M65 145h13M49 141l2 2M70 141l2 2" stroke="#fff" strokeOpacity=".72" strokeWidth="1.5" strokeLinecap="round" />

        {feminine ? (
          <>
            <path d="M47 66q13 8 26 0" fill="none" stroke="#fff7eb" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M60 74v23M52 80h4M64 80h4M52 87h4M64 87h4" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M44 98q16 5 32 0" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth="1.5" />
            <circle cx="60" cy="93" r="2" fill="#ffe1a3" />
            <circle cx="60" cy="99" r="2" fill="#ffe1a3" />
          </>
        ) : (
          <>
            <path d="M51 64q9 9 18 0l-3 12-6 5-6-5z" fill="#fff" fillOpacity=".75" />
            <path d="m60 79 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill={shirt} />
            <path d="M43 96q17 7 34 0M60 90v6" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth="1.5" />
          </>
        )}

        <circle cx="34" cy="43" r="5.5" fill={`url(#${id}-skin)`} />
        <circle cx="86" cy="43" r="5.5" fill={`url(#${id}-skin)`} />
        {feminine ? (
          <path d="M39 39q0-24 21-25 21 1 21 25l-3 17q-3 11-18 15-15-4-18-15z" fill={`url(#${id}-skin)`} />
        ) : (
          <path d="M36 39q0-24 24-25 24 1 24 25l-3 18q-5 13-21 15-16-2-21-15z" fill={`url(#${id}-skin)`} />
        )}
        {feminine ? (
          <path d="M37 42q-3-24 14-31 18-8 31 8 5 7 2 24l-5-12q-13 5-27 0-5 9-15 13z" fill="#30272a" />
        ) : (
          <>
            <path d="M36 40q-3-23 15-30 20-7 32 10l1 14q-7-8-13-15-11 10-30 11l-2 10z" fill="#30272a" />
            <path d="M39 53q3 13 9 17M81 53q-3 13-9 17" fill="none" stroke="#30272a" strokeWidth="5" strokeLinecap="round" />
          </>
        )}
        <path d="M46 44q3-2 6 0M68 44q3-2 6 0" fill="none" stroke="#322727" strokeWidth={feminine ? 1.5 : 2.4} strokeLinecap="round" />
        {feminine && (
          <>
            <path d="m46 42-2-2M50 41l-1-2M70 41l1-2M74 42l2-2" stroke="#322727" strokeWidth="1" strokeLinecap="round" />
            <path d="M41 54q4 2 8 0M71 54q4 2 8 0" fill="none" stroke="#d87970" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        <path d="M59 48q-2 5 1 6" fill="none" stroke="#713e3a" strokeOpacity=".55" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M52 57q8 11 16 0" fill="#8f3d48" stroke="#713e3a" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M54 58q6 4 12 0" fill="none" stroke="#fff3e8" strokeWidth="2" strokeLinecap="round" />
        {level >= 5 && (
          <path d="M40 27q20 8 40-2" fill="none" stroke="#f3bd55" strokeWidth="4" strokeLinecap="round" />
        )}
        {level >= 8 && (
          <path d="m89 20 2.5 5.5 6 1-4.5 4.2 1.2 6-5.2-3-5.2 3 1.2-6-4.5-4.2 6-1z" fill="#ffcc5e" />
        )}
      </g>
    </svg>
  )
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string; color: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-[12px] font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-label={option.label}
            aria-pressed={value === option.id}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
              value === option.id ? 'border-amber ring-2 ring-sun/30' : 'border-line'
            } relative`}
          >
            <span className="h-7 w-7 rounded-full" style={{ backgroundColor: option.color }} />
            {value === option.id && <Check size={14} className="absolute text-white drop-shadow" aria-hidden />}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function CharacterJourney({
  profile,
  isOwner,
  onProfileChange,
}: {
  profile: Profile
  isOwner: boolean
  onProfileChange: (profile: Profile) => void
}) {
  const completed = Math.max(0, profile.tasks_completed)
  const level = Math.min(Math.floor(completed / 10), 10)
  const remainder = level === 10 ? 10 : completed % 10
  const nextMilestone = Math.min((level + 1) * 10, 100)
  const currentTitle = level === 0 ? 'The First Hello' : MILESTONES[level - 1]
  const nextTitle = level < 10 ? MILESTONES[level] : 'Your next chapter'
  const overallProgress = Math.min(completed, 100)
  const config = useMemo(() => characterConfig(profile), [
    profile.character_style,
    profile.character_skin,
    profile.character_shirt,
    profile.character_bottom,
    profile.character_shoes,
  ])
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState(config)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const celebrationCloseRef = useRef<HTMLButtonElement>(null)
  const celebrationDialogRef = useRef<HTMLDivElement>(null)
  const storageKey = `comewme-milestone-${profile.id}`

  useEffect(() => {
    setDraft(config)
  }, [config])

  useEffect(() => {
    if (!isOwner || level === 0) return
    try {
      const celebrated = Number(window.localStorage.getItem(storageKey) ?? 0)
      if (level > celebrated) setCelebrationOpen(true)
    } catch {
      setCelebrationOpen(true)
    }
  }, [isOwner, level, storageKey])

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

  const customizerReady = [
    profile.character_style,
    profile.character_skin,
    profile.character_shirt,
    profile.character_bottom,
    profile.character_shoes,
  ].every((value) => value !== undefined)

  async function saveCharacter() {
    setSaving(true)
    setSaveError('')
    try {
      const updated = await updateProfile(profile.id, draft)
      onProfileChange(updated)
      setEditorOpen(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your character.')
    } finally {
      setSaving(false)
    }
  }

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

  return (
    <>
      <section className="mt-4 overflow-hidden rounded-[24px] border border-line bg-white shadow-card" aria-labelledby="journey-title">
        <div className="journey-hero relative overflow-hidden bg-gradient-to-br from-[#fff8e9] via-[#fffdf8] to-[#f8eee3] px-4 pb-4 pt-4">
          <div className="pointer-events-none absolute -right-7 -top-10 h-40 w-40 rounded-full bg-sun/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-[138px] w-[108px] shrink-0 items-end justify-center rounded-[20px] bg-white/70 pb-1 shadow-sm ring-1 ring-white/80">
              <Character config={config} level={level} className="h-[132px] w-[100px]" />
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
                  : `You’ve unlocked the ${currentTitle} personality. Keep making room for new connections.`}
              </p>
              <p className="mt-3 text-[11px] font-semibold text-ink/75">
                {completed} {completed === 1 ? 'activity' : 'activities'} completed
              </p>
              {isOwner && (
                <button
                  type="button"
                  disabled={!customizerReady}
                  onClick={() => {
                    setDraft(config)
                    setSaveError('')
                    setEditorOpen(true)
                  }}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-bold text-ink shadow-sm ring-1 ring-line transition hover:ring-amber disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <WandSparkles size={14} aria-hidden />
                  Customize character
                </button>
              )}
            </div>
          </div>
          {isOwner && !customizerReady && (
            <p role="status" className="relative mt-3 rounded-xl bg-white/80 px-3 py-2 text-[11px] text-muted">
              Run the profile-character update in Supabase to unlock customization.
            </p>
          )}
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[12px] font-bold text-ink">Next up: {nextTitle}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {level === 10 ? 'You’ve reached the final milestone!' : `${remainder} of 10 activities · ${10 - remainder} to go`}
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
              <Character config={config} level={level} className="h-9 w-7" />
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
              Each 10 completed activities unlocks a new chapter and a little more character.
            </p>
            <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
          </div>
        </div>
      </section>

      <Sheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Make your character yours"
      >
        <div className="max-h-[70vh] overflow-y-auto pb-2">
          <div className="flex items-center justify-center rounded-[18px] bg-canvas py-2">
            <Character config={draft} level={level} className="h-36 w-28" />
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-[12px] font-semibold text-ink">Character style</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['feminine', 'masculine'] as CharacterStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={draft.character_style === style}
                  onClick={() => setDraft((current) => ({ ...current, character_style: style }))}
                  className={`min-h-10 rounded-xl border px-3 text-[12px] font-semibold capitalize transition ${
                    draft.character_style === style ? 'border-amber bg-sun/15 text-ink' : 'border-line bg-white text-muted'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </fieldset>
          <ChoiceRow label="Skin tone" options={SKIN_TONES} value={draft.character_skin} onChange={(character_skin) => setDraft((current) => ({ ...current, character_skin }))} />
          <ChoiceRow label="Shirt · 5 styles" options={SHIRTS} value={draft.character_shirt} onChange={(character_shirt) => setDraft((current) => ({ ...current, character_shirt }))} />
          <ChoiceRow label="Bottoms · trousers and skirts" options={BOTTOMS} value={draft.character_bottom} onChange={(character_bottom) => setDraft((current) => ({ ...current, character_bottom }))} />
          <ChoiceRow label="Shoes · 2 styles" options={SHOES} value={draft.character_shoes} onChange={(character_shoes) => setDraft((current) => ({ ...current, character_shoes }))} />
          {saveError && <p role="alert" className="mt-3 text-[12px] text-alert">{saveError}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost btn-sm w-full" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn-primary btn-sm w-full" onClick={() => void saveCharacter()} disabled={saving}>
              {saving ? 'Saving…' : 'Save my look'}
            </button>
          </div>
        </div>
      </Sheet>

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
            <div className="relative mx-auto flex h-[150px] w-[130px] items-end justify-center rounded-[24px] bg-gradient-to-br from-[#fff5dd] to-[#f8e6d9]">
              <Character config={config} level={level} className="h-[145px] w-[110px]" />
              <span className="absolute -right-2 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber text-sm font-extrabold text-white shadow">
                {level}
              </span>
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[.18em] text-amber">Milestone unlocked</p>
            <h2 id="milestone-celebration-title" className="mt-1 font-display text-[25px] font-bold leading-tight">
              Your new personality: {currentTitle}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              You’ve completed {level * 10} activities together. Keep showing up, making memories, and see who you become next.
            </p>
            <button type="button"             ref={celebrationCloseRef}
            onClick={closeCelebration} className="btn-primary mt-5 w-full">
              Keep the good times going
            </button>
          </div>
        </div>
      )}
    </>
  )
}
