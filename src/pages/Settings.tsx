import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Moon, Sun, Megaphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { fetchMyVerification, submitVerification, updateProfile } from '../lib/api'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import { AREAS, CATEGORIES } from '../types'
import type { Category, Profile } from '../types'

export default function Settings() {
  const { profile, session, signOut, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [area, setArea] = useState(profile?.area ?? 'Yaba')
  const [interests, setInterests] = useState<Category[]>(profile?.interests ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [avatarBusy, setAvatarBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { moderation } = useNotifications()

  useEffect(() => {
    if (!profile?.id) return
    fetchMyVerification(profile.id).then((v) => setSubmitted(Boolean(v)))
  }, [profile?.id])

  if (!profile || !session) return null

  function toggleInterest(c: Category) {
    setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile(profile.id, {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        area,
        interests,
      })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(file: File) {
    if (!profile) return
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
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not upload photo')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function uploadSelfie(file: File) {
    if (!profile) return
    setVerifyError(null)
    setVerifyBusy(true)
    try {
      await submitVerification(profile.id, file)
      setSubmitted(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not submit'
      setVerifyError(
        /duplicate|unique/i.test(message)
          ? 'You have already sent one. We are still looking at it.'
          : message,
      )
    } finally {
      setVerifyBusy(false)
    }
  }

  async function confirmSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      window.location.href = '/'
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not sign out. Please try again.')
      setSigningOut(false)
      setSignOutOpen(false)
    }
  }

  const verificationCopy: Record<string, { title: string; body: string }> = {
    unverified: submitted
      ? {
          title: 'Under review',
          body: 'We have your photo. Most checks are done within a day.',
        }
      : {
          title: 'Get verified',
          body: 'Send a selfie holding a note with your username. We check it by hand and flip the badge.',
        },
    pending: {
      title: 'Under review',
      body: "We've got your photo. Most checks are done within a day.",
    },
    verified: {
      title: 'Verified',
      body: 'People can see the green badge on your profile and your activities.',
    },
  }
  const vc = verificationCopy[profile.verification_status]

  return (
    <div className="px-4 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <Link to={`/profile/${profile.id}`} className="p-1" aria-label="Back to profile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="font-display text-base font-bold">Settings</h1>
        <span className="w-6" />
      </div>

      <SectionLabel>Account</SectionLabel>

      {/* photo */}
      <div className="card mt-2 flex items-center gap-4 p-4">
        <img
          src={
            profile.avatar_url ??
            `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(profile.display_name)}&backgroundColor=F7A233`
          }
          alt=""
          className="h-16 w-16 rounded-full bg-line object-cover"
        />
        <div className="flex-1">
          <p className="text-[14px] font-semibold">Profile photo</p>
          <p className="mt-0.5 text-[12px] text-muted">A clear face photo gets you accepted faster.</p>
          <label className="btn-ghost btn-sm mt-2 cursor-pointer">
            {avatarBusy ? 'Uploading…' : 'Change photo'}
            <input
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

      <section className="card mt-3 space-y-4 p-4" aria-labelledby="details-heading">
        <p id="details-heading" className="text-[13px] font-semibold">Profile details</p>
        <div>
          <label className="label" htmlFor="dn">Display name</label>
          <input
            id="dn"
            className="field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </div>

        <div>
          <label className="label" htmlFor="b">About you</label>
          <textarea
            id="b"
            className="field min-h-[88px] resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={240}
          />
        </div>

        <div>
          <label className="label" htmlFor="a">Area</label>
          <select id="a" className="field" value={area} onChange={(e) => setArea(e.target.value)}>
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
                onClick={() => toggleInterest(c.value)}
                className={`chip ${interests.includes(c.value) ? 'chip-active' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary w-full" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
        </button>
      </section>

      <SectionLabel className="mt-5">Appearance</SectionLabel>

      <section className="card mt-2 p-4" aria-labelledby="theme-heading">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sun/20 text-amber">
            {theme === 'dark' ? <Moon size={19} aria-hidden /> : <Sun size={19} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="theme-heading" className="text-[14px] font-semibold">Appearance</h2>
            <p className="mt-0.5 text-[12px] text-muted">Choose the look that feels right. Saved on this device.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-[14px] bg-canvas p-1" role="group" aria-label="App theme">
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-[11px] px-3 text-[13px] font-semibold transition ${
                  theme === 'light' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Sun size={16} aria-hidden />
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-[11px] px-3 text-[13px] font-semibold transition ${
                  theme === 'dark' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Moon size={16} aria-hidden />
                Dark
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* verification */}
      <SectionLabel className="mt-5">Verification</SectionLabel>
      <div className="card mt-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">{vc.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{vc.body}</p>
          </div>
          {profile.verification_status === 'verified' && (
            <span className="pill bg-verified/15 text-verified">Verified</span>
          )}
        </div>

        {profile.verification_status === 'unverified' && !submitted && (
          <label className="btn-ghost btn-sm mt-3 cursor-pointer">
            {verifyBusy ? 'Uploading…' : 'Send selfie'}
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadSelfie(f)
              }}
            />
          </label>
        )}

        {verifyError && <p className="mt-2 text-[12px] font-medium text-alert">{verifyError}</p>}
      </div>

      <SectionLabel className="mt-5">For business</SectionLabel>

      <div className="card mt-2 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun/20 text-amber">
            <Megaphone size={15} aria-hidden />
          </div>
          <div>
            <p className="text-[14px] font-semibold">Advertise Your Business</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              Run a sponsored ad at the top of Discover. Reach Lagosians looking for things to do.
            </p>
          </div>
        </div>
        <Link to="/advertise" className="btn-primary w-full mt-3 text-sm font-bold">
          Create an Ad
        </Link>
      </div>

      {/* account details — sits directly under the photo */}


      {moderation.is_moderator && (
        <>
          <SectionLabel className="mt-5">Moderation</SectionLabel>
          <div className="card mt-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-semibold">Moderation</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                SOS alerts, member reports and advertiser ads all land in one inbox.
              </p>
            </div>
            {moderation.sos + moderation.reports + moderation.appeals + moderation.ads > 0 && (
              <span className="shrink-0 rounded-full bg-[#e53935] px-2 py-0.5 text-[10px] font-bold text-white">
                {moderation.sos + moderation.reports + moderation.appeals + moderation.ads}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/admin/moderation" className="btn-primary btn-sm">
              Open inbox
            </Link>
            <Link to="/admin/ads" className="btn-ghost btn-sm">
              Ad review
            </Link>
          </div>
          </div>
        </>
      )}

      <SectionLabel className="mt-5">Support</SectionLabel>
      <div className="mt-2 space-y-2">
        <div className="card p-4">
          <p className="text-[14px] font-semibold">Help &amp; support</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            A bug, a complaint, or a suggestion? A human reads every message. Tell us here, or email{' '}
            <span className="font-semibold text-ink">hello@comewme.app</span>.
          </p>
          <Link to="/feedback" className="btn-primary btn-sm mt-3 w-full">
            Send feedback
          </Link>
        </div>

        <button
          className="btn-ghost w-full text-alert"
          onClick={() => setSignOutOpen(true)}
        >
          Sign out
        </button>

        <p className="pt-2 text-center text-[11px] text-muted">
          Come w' me · Lagos · v0.1
        </p>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Taking a little break?"
        message="You’ll be signed out safely. Your profile and all your good memories will be right here when you’re back."
        cancelLabel="Stay a little longer"
        confirmLabel="Sign me out"
        busy={signingOut}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => void confirmSignOut()}
      />
    </div>
  )
}

function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted ${className}`}>
      {children}
    </p>
  )
}
