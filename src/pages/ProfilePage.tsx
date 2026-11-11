import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
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
import TrustScoreDetail from '../components/TrustScoreDetail'
import { calculateTrustScore } from '../lib/trustScore'

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [trustOpen, setTrustOpen] = useState(false)
  const [growthOpen, setGrowthOpen] = useState(false)

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

  const calculatedTrust = calculateTrustScore({
    tasks_completed: profile.tasks_completed,
    verification_status: profile.verification_status,
    avatar_url: profile.avatar_url,
    phone: profile.phone,
    has_good_reviews: avg ? Number(avg) >= 4 : true,
    has_reports: false,
  })

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
            { label: 'Trust score', value: calculatedTrust.score },
            { label: 'Rating', value: avg ?? '—' },
          ].map((s) => (
            <div
              key={s.label}
              className="card p-3 flex flex-col items-center justify-center text-center"
              onClick={s.label === 'Trust score' ? () => setTrustOpen(true) : undefined}
              style={s.label === 'Trust score' ? { cursor: 'pointer' } : undefined}
            >
              <p className="font-display text-lg font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-[11px] text-muted">{s.label}</p>
              {s.label === 'Trust score' && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <span className="text-[10px] text-muted">Details</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {isMe ? (
          <div className="card mt-3 overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
              onClick={() => setGrowthOpen((v) => !v)}
              aria-expanded={growthOpen}
              aria-controls="growth-panel"
            >
              <div>
                <p className="text-[13px] font-semibold">Your growth journey</p>
                <p className="mt-0.5 text-[11px] text-muted">Personality &amp; chapters — tap to {growthOpen ? 'hide' : 'show'}</p>
              </div>
              <ChevronDown size={18} className={`shrink-0 transition-transform duration-200 ${growthOpen ? 'rotate-180' : ''}`} />
            </button>
            {growthOpen && (
              <div id="growth-panel" className="border-t border-line p-3">
                <PersonalitySelector
                  profile={profile}
                  isOwner
                  onProfileChange={setProfile}
                />
                {profile.character_persona && (
                  <CharacterJourney
                    profile={profile}
                    isOwner
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <PersonalitySelector
            profile={profile}
            isOwner={false}
            onProfileChange={setProfile}
          />
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

        <TrustScoreDetail
          open={trustOpen}
          onClose={() => setTrustOpen(false)}
          score={calculatedTrust.score}
          tasks_completed={profile.tasks_completed}
          verification_status={profile.verification_status}
          avatar_url={profile.avatar_url}
          name={isMe ? undefined : profile.display_name}
          phone={profile.phone}
          has_good_reviews={avg ? Number(avg) >= 4 : true}
          has_reports={false}
        />
      </div>
    </div>
  )
}
