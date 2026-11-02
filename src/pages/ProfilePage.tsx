import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, fetchReviews } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Profile, Review, Task } from '../types'
import { trustLevel } from '../types'
import { formatDateTime } from '../lib/format'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import { TrustPill, VerifiedBadge } from '../components/Badges'
import TaskCard from '../components/TaskCard'

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewers, setReviewers] = useState<Record<string, { name: string; avatar: string | null }>>({})
  const [hosted, setHosted] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true)
    Promise.all([fetchProfile(id), fetchReviews(id)])
      .then(async ([p, r]) => {
        if (!alive) return
        setProfile(p)
        setReviews(r)
        if (p) {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .eq('host_id', id)
            .order('date_time', { ascending: false })
            .limit(6)
          if (alive) setHosted((data ?? []) as Task[])
        }
        // One query for every reviewer name, instead of one per review.
        const ids = [...new Set(r.map((x) => x.reviewer_id))]
        if (ids.length > 0) {
          const { data: people } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', ids)
          if (alive && people) {
            const map: Record<string, { name: string; avatar: string | null }> = {}
            for (const person of people) {
              map[person.id as string] = {
                name: person.display_name as string,
                avatar: (person.avatar_url as string | null) ?? null,
              }
            }
            setReviewers(map)
          }
        }
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
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
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-display text-[22px] font-bold leading-tight">
                {profile.display_name}
              </h1>
              <VerifiedBadge status={profile.verification_status} />
            </div>
            <p className="text-[13px] text-muted">@{profile.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TrustPill level={trustLevel(profile.tasks_completed)} />
              <span className="text-[12px] text-muted">
                {profile.area ?? 'Lagos'}
                {profile.city && profile.city !== 'Lagos' ? `, ${profile.city}` : ''}
              </span>
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 text-[14px] leading-relaxed text-ink/85">{profile.bio}</p>
        )}

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

        {profile.verification_status !== 'verified' && isMe && (
          <Link
            to="/settings"
            className="card mt-3 flex items-center justify-between p-4"
          >
            <div>
              <p className="text-[14px] font-semibold">
                {profile.verification_status === 'pending'
                  ? 'Verification under review'
                  : 'Get verified'}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                A verified face means people trust you faster.
              </p>
            </div>
            <span className="pill bg-sun/30 text-ink">Verify</span>
          </Link>
        )}

        {hosted.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-2 font-display text-base font-bold">Activities hosted</h2>
            <div className="space-y-3">
              {hosted.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-7">
          <h2 className="mb-2 font-display text-base font-bold">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="card p-4 text-[13px] text-muted">
              No reviews yet. Reviews only come from people who actually did a task together.
            </p>
          ) : (
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        src={reviewers[r.reviewer_id]?.avatar ?? null}
                        name={reviewers[r.reviewer_id]?.name ?? 'Someone'}
                        size={26}
                      />
                      <span className="truncate text-[13px] font-semibold">
                        {reviewers[r.reviewer_id]?.name ?? 'Someone'}
                      </span>
                    </div>
                    <span className="shrink-0 text-[13px] text-amber">{'★'.repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-2 text-[13px] text-ink/80">{r.comment}</p>}
                  <p className="mt-1 text-[11px] text-muted">{formatDateTime(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
