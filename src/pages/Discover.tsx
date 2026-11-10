import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchFeed, fetchUpcomingForUser } from '../lib/api'
import { supabase } from '../lib/supabase'
import { AREAS, CATEGORIES } from '../types'
import type { Category, JoinStatus, Task } from '../types'
import { formatDateTime } from '../lib/format'
import TaskCard from '../components/TaskCard'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import Avatar from '../components/Avatar'
import AdCarousel from '../components/AdCarousel'

const PAGE = 20

export default function Discover() {
  const { profile, session } = useAuth()

  const [category, setCategory] = useState<Category | 'all'>('all')
  const [area, setArea] = useState<string>('all')
  const [forYou, setForYou] = useState(false)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [tasks, setTasks] = useState<Task[]>([])
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JoinStatus>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [upcoming, setUpcoming] = useState<Task[]>([])
  const [upcomingError, setUpcomingError] = useState<string | null>(null)

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
          search: search.trim() || undefined,
          limit: PAGE,
          offset,
        })

        let statuses: Record<string, JoinStatus> = {}
        if (profile && rows.length > 0) {
          const { data, error: statusError } = await supabase
            .from('join_requests')
            .select('task_id, status')
            .eq('requester_id', profile.id)
            .in('task_id', rows.map((row) => row.id))
            .neq('status', 'withdrawn')
          if (statusError) throw statusError
          statuses = Object.fromEntries(
            (data ?? []).map((request) => [request.task_id, request.status as JoinStatus]),
          )
        }

        setTasks((prev) => (offset === 0 ? rows : [...prev, ...rows]))
        setApplicationStatuses((prev) => (offset === 0 ? statuses : { ...prev, ...statuses }))
        setHasMore(rows.length === PAGE)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load activities')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [category, area, forYou, interests.join(','), search, profile?.id],
  )

  useEffect(() => {
    void load(0)
  }, [load])

  useEffect(() => {
    if (!profile?.id) {
      setUpcoming([])
      setUpcomingError(null)
      return
    }

    let active = true
    const refreshUpcoming = async () => {
      try {
        const tasks = await fetchUpcomingForUser(profile.id)
        if (active) {
          setUpcoming(tasks)
          setUpcomingError(null)
        }
      } catch (e) {
        if (active) setUpcomingError(e instanceof Error ? e.message : 'Could not load tomorrow’s activity reminders.')
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshUpcoming()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    let midnightRefresh = 0
    const scheduleMidnightRefresh = () => {
      const lagosOffsetMs = 60 * 60_000
      const lagosNow = new Date(Date.now() + lagosOffsetMs)
      const nextLagosMidnight = Date.UTC(
        lagosNow.getUTCFullYear(),
        lagosNow.getUTCMonth(),
        lagosNow.getUTCDate() + 1,
      ) - lagosOffsetMs
      midnightRefresh = window.setTimeout(() => {
        void refreshUpcoming()
        if (active) scheduleMidnightRefresh()
      }, Math.max(1000, nextLagosMidnight - Date.now() + 1000))
    }

    void refreshUpcoming()
    scheduleMidnightRefresh()
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(midnightRefresh)
    }
  }, [profile?.id])

  return (
    <div className="pb-6">
      <header className="px-5 pb-2 pt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-amber">COME W' ME</p>
            <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-tight">
              Find your people.
            </h1>
          </div>
          {session && profile ? (
            <Link to={`/profile/${profile.id}`} aria-label="Your profile">
              <Avatar src={profile.avatar_url} name={profile.display_name} size={42} />
            </Link>
          ) : (
            <Link to="/login" className="text-[13px] font-semibold text-amber">Sign in</Link>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-[16px] bg-[#f0f1f3] px-3.5">
          <Search size={19} className="shrink-0 text-muted" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              placeholder="Search tasks, areas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[48px] w-full border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-[#98a0ae]"
              aria-label="Search tasks and areas"
            />
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted"
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={19} aria-hidden />
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-2">
            <label htmlFor="discover-area" className="sr-only">Filter by area</label>
            <select
              id="discover-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="field py-2.5 text-[13px]"
            >
              <option value="all">All areas in Lagos</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </header>

      <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-[13px] border border-[#edd996] bg-[#fff4d1] p-3 text-[#7a622f]">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber" aria-hidden />
        <p className="text-[12px] leading-[1.45]">
          Meet in public, keep personal details private, and check each poster&apos;s reputation before you join.
        </p>
      </div>

      <AdCarousel />

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
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
              {c.emoji} {c.label}
            </button>
          ))}
      </div>

      <div className="mb-3 mt-4 flex items-center justify-between px-5">
        <h2 className="text-[14px] font-bold">Around Lagos</h2>
        <span className="text-[12px] text-muted">Newest first</span>
      </div>

      {/* Day-before reminders stay visible for every activity happening tomorrow. */}
      {session && upcomingError && (
        <p role="status" className="mx-4 mt-4 rounded-xl border border-[#edd996] bg-[#fff4d1] p-3 text-[12px] leading-relaxed text-[#7a622f]">
          Tomorrow&apos;s activity reminders could not be refreshed. {upcomingError}
        </p>
      )}
      {session && upcoming.length > 0 && (
        <section className="activity-reminder mx-4 mt-4 rounded-card border border-amber/30 bg-sun/15 p-4" aria-label="Activities happening tomorrow">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber motion-reduce:animate-none" />
            <h2 className="text-[13px] font-bold text-ink">
              {upcoming.length === 1 ? 'A reminder for tomorrow' : `${upcoming.length} activities tomorrow`}
            </h2>
          </div>
          <div className="space-y-2">
            {upcoming.map((task) => (
              <Link
                key={task.id}
                to={`/mytasks?task=${encodeURIComponent(task.id)}`}
                className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline"
                aria-label={`View upcoming activity ${task.title} in My Tasks`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{task.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {formatDateTime(task.date_time)}
                  </p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-amber" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* feed */}
      <div className="space-y-3 px-5">
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
          tasks.map((t) => (
            <TaskCard key={t.id} task={t} applicationStatus={applicationStatuses[t.id]} />
          ))}

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
