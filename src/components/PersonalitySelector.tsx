import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { updateProfile } from '../lib/api'
import { personaImageSrc } from '../lib/personas'
import type { CharacterPersona, Profile } from '../types'

type Gender = 'female' | 'male'

type Persona = {
  id: CharacterPersona
  name: string
  gender: Gender
  look: string
  personality: string
}

const PERSONAS: Persona[] = [
  {
    id: 'tari',
    name: 'Tari',
    gender: 'female',
    look: 'Cream turtleneck sweater and dark pants.',
    personality: 'Warm, refined, and thoughtful. Tari is the comforting presence in the group who loves deep conversations, acoustic playlists, and checking up on everyone to ensure the vibe is always peaceful.',
  },
  {
    id: 'ibrahim',
    name: 'Ibrahim',
    gender: 'male',
    look: 'Green oversized hoodie and tactical cargo pants with glasses.',
    personality: 'The tech-savvy culture curator. Ibrahim is plugged into the latest developments, always sharing cool finds, fixing technical glitches, and bringing sharp humor to the group chat.',
  },
  {
    id: 'zainab',
    name: 'Zainab',
    gender: 'female',
    look: 'Tailored red pantsuit.',
    personality: 'Confident, sharp, and ambitious. Zainab commands attention with her direct communication style, high energy, and natural leadership in organizing group outings or projects.',
  },
  {
    id: 'tunde',
    name: 'Tunde',
    gender: 'male',
    look: 'Dark leather/bomber jacket, layered tee, and jeans with glasses.',
    personality: 'The easygoing street-smart realist. Tunde keeps things practical and grounded, balancing a busy hustle with a laid-back attitude that makes him super approachable.',
  },
  {
    id: 'runo',
    name: 'Runo',
    gender: 'male',
    look: 'Fitted dark athletic tee and shorts with a built physique.',
    personality: 'Disciplined, high-energy, and active. Runo is all about fitness goals, early mornings, and pushing everyone in the community to stay fit and motivated.',
  },
  {
    id: 'kemi',
    name: 'Kemi',
    gender: 'female',
    look: 'Denim-on-denim jacket and jeans combo.',
    personality: 'Youthful, spontaneous, and adventurous. Kemi is always down to explore new spots around town, test out new app features, and bring a burst of fun energy.',
  },
  {
    id: 'ese',
    name: 'Ese',
    gender: 'female',
    look: 'Soft pastel pink hoodie and matching joggers.',
    personality: 'Cozy, relaxed, and friendly. Ese loves comfort, casual hangouts, and sharing relaxed banter without any pressure or drama.',
  },
  {
    id: 'ngozi',
    name: 'Ngozi',
    gender: 'female',
    look: 'Flowing floral sundress.',
    personality: 'Creative, graceful, and artistic. Ngozi has an eye for aesthetics and design, bringing a touch of elegance and imaginative flair to group discussions.',
  },
  {
    id: 'david',
    name: 'David',
    gender: 'male',
    look: 'Sharp navy blue suit and tie with glasses.',
    personality: 'Professional, strategic, and career-focused. David handles business matters and networking with ease, while still knowing how to share a good laugh when the work day is done.',
  },
  {
    id: 'maya',
    name: 'Maya',
    gender: 'female',
    look: 'Elegant, sleek black full-length gown.',
    personality: 'Classy, poised, and impactful. Maya carries an air of quiet confidence and authenticity, making her voice respected whenever she speaks up in the community.',
  },
  {
    id: 'burna',
    name: 'Burna',
    gender: 'male',
    look: 'Black sleeveless athletic top and joggers with red sneakers.',
    personality: 'Confident, energetic, and driven. Burna brings a bold presence, loves staying active, and motivates the people around him.',
  },
  {
    id: 'chidi',
    name: 'Chidi',
    gender: 'male',
    look: 'Coral polo shirt, sand-colored shorts, and red sneakers.',
    personality: 'Approachable, calm, and dependable. Chidi keeps things easygoing, enjoys good company, and is always ready to lend a hand.',
  },
]

function findPersona(id: CharacterPersona | null | undefined) {
  return PERSONAS.find((persona) => persona.id === id)
}

export default function PersonalitySelector({
  profile,
  isOwner,
  onProfileChange,
}: {
  profile: Profile
  isOwner: boolean
  onProfileChange: (profile: Profile) => void
}) {
  const savedPersona = findPersona(profile.character_persona)
  const [gender, setGender] = useState<Gender>(savedPersona?.gender ?? 'female')
  const [draftPersona, setDraftPersona] = useState<CharacterPersona | null>(
    profile.character_persona ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [chooserOpen, setChooserOpen] = useState(!profile.character_persona)

  useEffect(() => {
    const persona = findPersona(profile.character_persona)
    setDraftPersona(persona?.id ?? null)
    if (persona) setGender(persona.gender)
    setSaved(false)
    if (persona) setChooserOpen(false)
  }, [profile.character_persona])

  const shownPersona = isOwner && chooserOpen
    ? findPersona(draftPersona)
    : savedPersona
  const options = PERSONAS.filter((persona) => persona.gender === gender)

  async function saveSelection() {
    if (!draftPersona || draftPersona === profile.character_persona) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      const updated = await updateProfile(profile.id, { character_persona: draftPersona })
      onProfileChange(updated)
      setSaved(true)
      setChooserOpen(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your personality.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOwner && !savedPersona) return null

  return (
    <section className="card mt-4 overflow-hidden" aria-labelledby="personality-title">
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-amber">
          <Sparkles size={13} aria-hidden />
          Your community vibe
        </p>
        <h2 id="personality-title" className="mt-1 font-display text-[19px] font-bold leading-tight">
          {isOwner ? 'Choose the personality you resonate with' : 'Their community personality'}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {isOwner
            ? savedPersona
              ? 'Your chosen personality is part of your profile.'
              : 'Pick a character that feels like you, then save your choice.'
            : 'This is the personality they resonate with.'}
        </p>

        {isOwner && savedPersona && (
          <button
            type="button"
            aria-expanded={chooserOpen}
            onClick={() => {
              setDraftPersona(profile.character_persona ?? null)
              setGender(savedPersona.gender)
              setSaveError('')
              setChooserOpen((open) => !open)
            }}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-semibold text-ink transition hover:border-amber"
          >
            {chooserOpen ? 'Close chooser' : 'Change personality'}
            {chooserOpen ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </button>
        )}

        {shownPersona && (
          <div className="mt-4 flex overflow-hidden rounded-[18px] border border-line bg-canvas">
            <div className="flex h-[150px] w-[112px] shrink-0 items-end justify-center bg-sun/10">
              <img
                src={personaImageSrc(shownPersona.id)}
                alt={`${shownPersona.name}, ${shownPersona.look}`}
                className="h-full w-full object-contain object-bottom"
              />
            </div>
            <div className="min-w-0 flex-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[16px] font-bold">{shownPersona.name}</h3>
                {!isOwner && <span className="pill bg-sun/20 text-amber">Personality</span>}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{shownPersona.personality}</p>
            </div>
          </div>
        )}

        {isOwner && chooserOpen && (
          <>
            <fieldset className="mt-4">
              <legend className="mb-2 text-[12px] font-semibold">Choose a character</legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Character gender">
                {(['female', 'male'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={gender === option}
                    onClick={() => setGender(option)}
                    className={`min-h-10 rounded-xl border text-[12px] font-semibold capitalize transition ${
                      gender === option
                        ? 'border-amber bg-sun/15 text-ink'
                        : 'border-line bg-white text-muted'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {options.map((persona) => {
                const isSelected = draftPersona === persona.id
                return (
                  <button
                    key={persona.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setDraftPersona(persona.id)
                      setSaved(false)
                      setSaveError('')
                    }}
                    className={`overflow-hidden rounded-[15px] border text-left transition ${
                      isSelected ? 'border-amber ring-2 ring-sun/30' : 'border-line hover:border-amber/60'
                    }`}
                  >
                    <span className="relative flex h-[138px] items-end justify-center bg-canvas">
                      <img
                        src={personaImageSrc(persona.id)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain object-bottom"
                      />
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber text-white">
                          <Check size={14} aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="block p-2.5">
                      <span className="block text-[13px] font-bold text-ink">{persona.name}</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">{persona.personality}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {saveError && <p role="alert" className="mt-3 text-[12px] text-alert">{saveError}</p>}
            {saved && <p role="status" className="mt-3 text-[12px] font-medium text-verified">Personality saved to your profile.</p>}
            <button
              type="button"
              className="btn-primary btn-sm mt-4 w-full"
              onClick={() => void saveSelection()}
              disabled={!draftPersona || draftPersona === profile.character_persona || saving}
            >
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save personality'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
