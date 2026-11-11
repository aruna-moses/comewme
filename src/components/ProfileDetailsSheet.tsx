import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, ShieldCheck, Camera } from 'lucide-react'
import Sheet from './Sheet'
import { useAuth } from '../context/AuthContext'
import { AREAS, CATEGORIES } from '../types'
import type { Category } from '../types'
import { fetchMyVerification, submitVerification, updateProfile } from '../lib/api'
import { supabase } from '../lib/supabase'

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
  const [submitted, setSubmitted] = useState<boolean | null>(null)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile || !open) return
    setName(profile.display_name ?? '')
    setBio(profile.bio ?? '')
    setArea(profile.area ?? 'Yaba')
    setInterests(profile.interests ?? [])
  }, [profile, open])

  useEffect(() => {
    if (!open || !profile?.id) return
    fetchMyVerification(profile.id).then((v) => setSubmitted(Boolean(v))).catch(() => setSubmitted(false))
  }, [open, profile?.id])

  async function sendSelfie(file: File) {
    if (!profile?.id) return
    setVerifyBusy(true)
    setVerifyError(null)
    try {
      await submitVerification(profile.id, file)
      setSubmitted(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not submit.'
      setVerifyError(/duplicate|unique/i.test(message) ? 'We have one already — we are looking at it.' : message)
    } finally {
      setVerifyBusy(false)
    }
  }


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
        {/* Selfie verification */}
        <section className="rounded-2xl border border-line bg-white p-4" aria-labelledby="selfie-heading">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={19} className="shrink-0 text-verified" aria-hidden />
              <div>
                <p id="selfie-heading" className="text-[13px] font-semibold text-ink">Selfie verification</p>
                <p className="text-[10px] text-muted">Green check everywhere once approved</p>
              </div>
            </div>
            {profile?.verification_status === 'verified' ? (
              <span className="pill bg-verified/15 text-verified">Verified</span>
            ) : submitted ? (
              <span className="pill bg-sun/25 text-amber">Under review</span>
            ) : (
              <span className="pill bg-line text-muted">Not verified</span>
            )}
          </div>
          {profile?.verification_status !== 'verified' && (
            <div className="mt-3">
              <p className="text-[11px] leading-relaxed text-muted">
                Send a clear selfie holding anything small in frame. You don't have to post it publicly — only moderators see it.
              </p>
              <label className="btn-ghost btn-sm mt-2 cursor-pointer">
                {verifyBusy ? (<><Loader2 size={14} className="animate-spin" aria-hidden /> Uploading…</>) : submitted ? 'Re-send selfie' : 'Send selfie'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void sendSelfie(f)
                  }}
                />
              </label>
              {verifyError && <p className="mt-2 text-[11px] font-medium text-alert">{verifyError}</p>}
            </div>
          )}
        </section>

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
