import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import Sheet from './Sheet'
import { useAuth } from '../context/AuthContext'
import { AREAS, CATEGORIES } from '../types'
import type { Category } from '../types'
import { updateProfile } from '../lib/api'

export default function ProfileDetailsSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [area, setArea] = useState(profile?.area ?? 'Yaba')
  const [interests, setInterests] = useState<Category[]>(profile?.interests ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync when the underlying profile refreshes (e.g. after save).
  useEffect(() => {
    if (!profile || !open) return
    setName(profile.display_name ?? '')
    setBio(profile.bio ?? '')
    setArea(profile.area ?? 'Yaba')
    setInterests(profile.interests ?? [])
  }, [profile, open])

  function toggleInterest(category: Category) {
    setInterests((prev) => (prev.includes(category) ? prev.filter((x) => x !== category) : [...prev, category]))
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    try {
      await updateProfile(profile.id, {
        display_name: name.trim(),
        bio: bio.trim() || null,
        area,
        interests,
      })
      await refreshProfile()
      setSaved(true)
      window.setTimeout(() => {
        setSaved(false)
        onClose()
      }, 650)
    } catch {
      // Errors surface via the Saved chip not flipping — caller never needs a blocking alert.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Edit your profile">
      <div className="space-y-4 pb-4">
        <p className="text-[12px] text-muted">
          These details are shown on your profile to other members.
        </p>
        <div>
          <label className="label" htmlFor="name">Display name</label>
          <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="bio">About you</label>
          <textarea id="bio" className="field min-h-[80px] resize-none" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={240} placeholder="Tell people who you are" />
        </div>
        <div>
          <label className="label" htmlFor="area">Area</label>
          <select id="area" className="field" value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Interests</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleInterest(c.value)}
                className={`chip ${interests.includes(c.value) ? 'chip-active' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn-primary w-full" disabled={saving || !name.trim()} onClick={() => void save()}>
          {saving ? (
            <><Loader2 size={16} className="animate-spin" aria-hidden /> Saving…</>
          ) : saved ? (
            <><Check size={16} aria-hidden /> Saved</>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </Sheet>
  )
}
