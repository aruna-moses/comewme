import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchFeed, fetchUpcomingForUser } from '../lib/api'
import { AREAS, CATEGORIES } from '../types'
import type { Category, Task } from '../types'
import { formatDateTime } from '../lib/format'
import TaskCard from '../components/TaskCard'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import Avatar from '../components/Avatar'

const PAGE = 20

export default function Discover() {
  const { profile, session } = useAuth()

  const [category, setCategory] = useState<Category | 'all'>('all')
  const [area, setArea] = useState<string>('all')
  const [forYou, setForYou] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [upcoming, setUpcoming] = useState<Task[]>([])
  const [dismissed, setDismissed] = useState(false)

  const interests = profile?.interests ?? []

  const load = useCallback(
    async (offset = 0) => {
      try {
        if (offset === 0) {
          setLoading(true)
          setError(null)
        } else {
          setLoadingMore(true)
        }

        const rows = await fetchFeed({
          category,
          area,
          forYou: forYou && interests.length > 0 ? interests : null,
          limit: PAGE,
          offset,
        })

        setTasks((prev) => (offset === 0 ? rows : [...prev, ...rows]))
        setHasMore(rows.length === PAGE)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load activities')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [category, area, forYou, interests.join(',')],
  )

  useEffect(() => {
    void load(0)
    setDismissed(false)
  }, [load])

  useEffect(() => {
    if (!profile?.id) {
      setUpcoming([])
      return
    }
    fetchUpcomingForUser(profile.id)
      .then(setUpcoming)
      .catch(() => setUpcoming([]))
  }, [profile?.id])

  const nextUp = upcoming[0]

  return (
    <div className="pb-6">
      {/* header */}
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-bold leading-none tracking-tight">
              Come w' me
            </h1>
            <p className="mt-1 text-[12px] text-muted">Find people. Do the thing.</p>
          </div>

          {session && profile ? (
            <Link to={`/profile/${profile.id}`} aria-label="Your profile">
              <Avatar src={profile.avatar_url} name={profile.display_name} size={38} />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="pill bg-white text-muted ring-1 ring-line">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
            </svg>
            Lagos
          </span>

          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="min-h-[32px] rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink outline-none"
            aria-label="Filter by area"
          >
            <option value="all">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {session && interests.length > 0 && (
            <button
              onClick={() => setForYou((v) => !v)}
              className={`chip ${forYou ? 'chip-active' : ''}`}
            >
              For you
            </button>
          )}
          <button
            onClick={() => setCategory('all')}
            className={`chip ${category === 'all' ? 'chip-active' : ''}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`chip ${category === c.value ? 'chip-active' : ''}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* reminder */}
      {session && nextUp && !dismissed && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-card border border-amber/30 bg-sun/15 p-4">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">You have an activity coming up</p>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {nextUp.title} · {formatDateTime(nextUp.date_time)}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="-mr-1 -mt-1 p-1 text-muted"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* feed */}
      <div className="mt-4 space-y-3 px-4">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && error && (
          <div className="card p-5 text-center">
            <p className="text-sm font-semibold text-alert">Something went wrong</p>
            <p className="mt-1 text-[13px] text-muted">{error}</p>
            <button className="btn-ghost btn-sm mt-4" onClick={() => load(0)}>
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          tasks.map((t) => <TaskCard key={t.id} task={t} />)}

        {!loading && !error && tasks.length === 0 && (
          <EmptyState
            title="Nothing here yet"
            body="No open activities in this filter. Be the first to post one — someone is probably looking for the same thing."
            cta={{ label: 'Post an activity', to: '/post' }}
          />
        )}

        {!loading && !error && hasMore && tasks.length > 0 && (
          <button
            className="btn-ghost w-full"
            disabled={loadingMore}
            onClick={() => load(tasks.length)}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}

        {!loading && !error && tasks.length > 0 && !hasMore && (
          <p className="py-4 text-center text-[12px] text-muted">That's everything for now.</p>
        )}
      </div>
    </div>
  )
}
