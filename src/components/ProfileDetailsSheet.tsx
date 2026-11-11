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
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

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

  async function uploadAvatar(file: File) {
    if (!profile?.id) return
    setAvatarBusy(true)
    try {
      const path = `${profile.id}/avatar-${Date.now()}.jpg`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile(profile.id, { avatar_url: data.publicUrl })
      await refreshProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not upload photo.'
      alert(message)
    } finally {
      setAvatarBusy(false)
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
              <div className="rounded-xl border border-amber/25 bg-sun/15 p-3 text-[11px] leading-relaxed text-ink/85">
                <p className="font-bold text-ink">Before you tap — three quick rules</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>Your selfie and your public avatar must be <strong>the same person</strong> — clear face, no sunglasses or hat.</li>
                  <li>Lighting can be whatever you have — just <strong>you, clearly visible</strong> in both.</li>
                  <li>If they don&apos;t match, your review will likely be <strong>declined</strong>. You can edit your avatar first if it&apos;s hard to recognise you.</li>
                </ul>
              </div>
              {profile?.avatar_url ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-canvas p-2">
                  <img src={profile.avatar_url} alt="Current profile photo" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-snug text-muted">
                      This is what moderators will compare your selfie to.
                    </p>
                    <label className="btn-ghost btn-sm mt-1.5 cursor-pointer">
                      {avatarBusy ? (<><Loader2 size={12} className="animate-spin" aria-hidden /> Uploading…</>) : 'Update avatar'}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void uploadAvatar(f)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-canvas p-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-line text-muted" aria-hidden>
                    <Camera size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink">No avatar yet</p>
                    <p className="text-[11px] leading-relaxed text-muted">Upload a clear face photo — this plays the role of your ID for selfie verification.</p>
                  </div>
                  {avatarBusy ? <Loader2 size={16} className="shrink-0 animate-spin text-muted" aria-hidden /> : null}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadAvatar(f)
                    }}
                  />
                </label>
              )}
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
