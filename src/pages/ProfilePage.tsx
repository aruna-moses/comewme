import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, fetchReviews } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Profile, Review } from '../types'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import CharacterJourney from '../components/CharacterJourney'
import PersonalitySelector from '../components/PersonalitySelector'
import ProfileMediaGallery from '../components/ProfileMediaGallery'
import ReportButton from '../components/ReportButton'

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    let receivedRealtimeProfile = false
    if (!id) return
    setLoading(true)
    const channel = supabase
      .channel(`profile-journey:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` },
        (payload) => {
          receivedRealtimeProfile = true
          if (alive) setProfile(payload.new as Profile)
        },
      )
      .subscribe()
    Promise.all([fetchProfile(id), fetchReviews(id)])
      .then(async ([p, r]) => {
        if (!alive) return
        if (!receivedRealtimeProfile) setProfile(p)
        setReviews(r)
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
      void supabase.removeChannel(channel)
    }
  }, [id])

  if (loading) return <Spinner full />
  if (!profile)
    return (
      <div className="p-6">
        <p className="font-semibold">Profile not found.</p>
        <Link to="/" className="btn-ghost btn-sm mt-4">
          Back
        </Link>
      </div>
    )

  const isMe = me?.id === profile.id
  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} className="p-1" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isMe && (
          <Link to="/settings" className="btn-ghost btn-sm">
            Edit profile
          </Link>
        )}
      </div>

      <div className="px-4 pt-5">
        <div className="flex items-start gap-4">
          <Avatar src={profile.avatar_url} name={profile.display_name} size={76} />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate font-display text-[22px] font-bold leading-tight">
              {profile.display_name}
            </h1>
            <p className="text-[13px] text-muted">@{profile.username}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Completed', value: profile.tasks_completed },
            { label: 'Trust score', value: profile.trust_score },
            { label: 'Rating', value: avg ?? '—' },
          ].map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <p className="font-display text-lg font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <PersonalitySelector
          profile={profile}
          isOwner={isMe}
          onProfileChange={setProfile}
        />

        {isMe && (
          <CharacterJourney
            profile={profile}
            isOwner
            onProfileChange={setProfile}
          />
        )}

        {isMe && profile.verification_status !== 'verified' && (
          <Link to="/settings" className="card mt-3 flex items-center justify-between p-4">
            <div>
              <p className="text-[14px] font-semibold">
                {profile.verification_status === 'pending' ? 'Verification under review' : 'Get verified'}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                A verified face means people trust you faster.
              </p>
            </div>
            <span className="pill bg-sun/30 text-ink">Verify</span>
          </Link>
        )}

        <ProfileMediaGallery profileId={profile.id} isOwner={isMe} />

        {!isMe && me && (
          <div className="mt-5 flex justify-end">
            <ReportButton
              reportedUserId={profile.id}
              label="Report this account"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-[12px] font-semibold text-muted transition hover:border-alert/40 hover:text-alert"
            />
          </div>
        )}
      </div>
    </div>
  )
}
