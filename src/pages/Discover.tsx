import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, ShieldCheck, SlidersHorizontal, X, Bell } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { fetchFeed, fetchUpcomingForUser, fetchVerificationStatuses } from '../lib/api'
import { supabase } from '../lib/supabase'
import { AREAS, CATEGORIES } from '../types'
import type { Category, JoinStatus, Task } from '../types'
import { formatDateTime } from '../lib/format'
import TaskCard from '../components/TaskCard'
import SkeletonCard from '../components/SkeletonCard'
import EmptyState from '../components/EmptyState'
import Avatar from '../components/Avatar'
import AdCarousel from '../components/AdCarousel'
import ActivityReminderSheet from '../components/ActivityReminderSheet'
import NotificationBell from '../components/NotificationBell'
import PublicHome from '../components/PublicHome'
import { cacheKeys, readCache, writeCache } from '../lib/dataCache'

const PAGE = 20

export default function Discover() {
  const { profile, session, loading: authLoading } = useAuth()

  const [category, setCategory] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const [area, setArea] = useState<string>('all')
  const [forYou, setForYou] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const interests = profile?.interests ?? []

  const isDefaultView = category === 'all' && area === 'all' && !(forYou && interests.length > 0) && !search.trim()
  const cachedDefault = isDefaultView
    ? readCache<{
        tasks: Task[]
        statuses: Record<string, JoinStatus>
        verifiedMap: Record<string, 'unverified' | 'pending' | 'verified'>
      }>(cacheKeys.feed())
    : undefined
  const [tasks, setTasks] = useState<Task[]>(() => cachedDefault?.tasks ?? [])
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JoinStatus>>(() => cachedDefault?.statuses ?? {})
  const [verifiedMap, setVerifiedMap] = useState<Record<string, 'unverified' | 'pending' | 'verified'>>(() => cachedDefault?.verifiedMap ?? {})
  const [loading, setLoading] = useState(() => !cachedDefault)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hideSafetyTip, setHideSafetyTip] = useState(() => {
    try {
      return window.localStorage.getItem('comewme:safety-tip-dismissed') === '1'
    } catch {
      return false
    }
  })
  const { status: pushStatus, requestPermissionAndRegister: enablePush, busy: pushBusy } = usePushNotifications()
  const [hidePushPrompt, setHidePushPrompt] = useState(() => {
    try {
      return window.localStorage.getItem('comewme:push-prompt-dismissed') === '1'
    } catch {
      return false
    }
  })

  const [upcoming, setUpcoming] = useState<Task[]>([])
  const [upcomingError, setUpcomingError] = useState<string | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const reminderKey = `comewme:reminder-shown:${new Date(Date.now() + 86_400_000).toDateString()}`

  const refreshTimer = useRef<number | null>(null)
  const load = useCallback(
    async (offset = 0, quiet = false) => {
      try {
        if (offset === 0) {
          if (!quiet) setLoading(true)
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
        const hostVerification = await fetchVerificationStatuses(rows.map((r) => r.host_id))

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

        setVerifiedMap((prev) => (offset === 0 ? hostVerification : { ...prev, ...hostVerification }))
        setTasks((prev) => (offset === 0 ? rows : [...prev, ...rows]))
        setApplicationStatuses((prev) => (offset === 0 ? statuses : { ...prev, ...statuses }))
        if (offset === 0 && isDefaultView) {
          writeCache(cacheKeys.feed(), { tasks: rows, statuses, verifiedMap: hostVerification })
        }
        setHasMore(rows.length === PAGE)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load activities')
      } finally {
        if (!quiet) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [category, area, forYou, interests.join(','), search, profile?.id],
  )

  useEffect(() => {
    // Quiet refresh when we already painted from cache; otherwise show the skeleton.
    void load(0, cachedDefault !== undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  // Keep Discover live: any task insert/update/delete refreshes the feed silently.
  useEffect(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)

    const channel = supabase
      .channel('discover-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
          refreshTimer.current = window.setTimeout(() => {
            void load(0, true)
          }, 600)
        },
      )
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(0, true)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current)
        refreshTimer.current = null
      }
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  // Pop the reminder sheet once per day for activities starting tomorrow.
  useEffect(() => {
    if (!session || upcoming.length === 0 || reminderOpen) return
    try {
      const seen: string[] = JSON.parse(window.localStorage.getItem(reminderKey) ?? '[]')
      if (!upcoming.every((t) => seen.includes(t.id))) setReminderOpen(true)
    } catch {
      setReminderOpen(true)
    }
  }, [upcoming, session, reminderOpen, reminderKey])

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

  if (authLoading) return <Spinner full />
  if (!session) return <PublicHome />

  return (
    <div className="pb-6">
      <header
        className="border-b border-line bg-canvas px-5 pb-2 pt-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] text-amber">COME W' ME</p>
              <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-tight">
                Find your people.
              </h1>
          </div>
          {session && profile ? (
            <div className="flex shrink-0 items-center gap-1">
              <NotificationBell />
              <Link to={`/profile/${profile.id}`} aria-label="Your profile">
                <Avatar src={profile.avatar_url} name={profile.display_name} size={42} />
              </Link>
            </div>
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

      {!hideSafetyTip && (
        <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-[13px] border border-[#edd996] bg-[#fff4d1] p-3 text-[#7a622f]">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <p className="flex-1 text-[12px] leading-[1.45]">
            Meet in public, keep personal details private, and check each poster&apos;s reputation before you join.
          </p>
          <button
            type="button"
            className="-mr-1 shrink-0 p-1 text-[#9c8621]"
            aria-label="Dismiss safety tip"
            onClick={() => {
              setHideSafetyTip(true)
              try {
                window.localStorage.setItem('comewme:safety-tip-dismissed', '1')
              } catch {
                // best effort
              }
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {!hidePushPrompt && (pushStatus === 'default' || pushStatus === 'needs-install') && (
        <div className="mx-5 mt-3 rounded-[13px] border border-sun/40 bg-sun/10 p-3">
          <div className="flex items-start gap-2.5">
            <Bell size={20} className="mt-0.5 shrink-0 text-amber" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold leading-snug text-ink">
                {pushStatus === 'needs-install'
                  ? 'Install Come w\' me to your home screen to get pop-ups'
                  : 'Never miss a ping'}
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.45] text-ink/75">
                {pushStatus === 'needs-install'
                  ? 'On your iPhone or iPad, tap the Share icon → Add to Home Screen → open it from there.'
                  : 'Turn on push notifications — chat messages, join requests and activity reminders reach you even when the app is closed.'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {pushStatus === 'default' && (
                  <button
                    type="button"
                    onClick={() => void enablePush()}
                    disabled={pushBusy}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-sun px-4 text-[12px] font-bold text-[#0B0B0F] transition enabled:hover:brightness-105 disabled:opacity-60"
                  >
                    {pushBusy ? 'Enabling…' : 'Enable push'}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center justify-center rounded-full px-3 text-[12px] font-semibold text-muted transition hover:text-ink"
                  onClick={() => {
                    setHidePushPrompt(true)
                    try {
                      window.localStorage.setItem('comewme:push-prompt-dismissed', '1')
                    } catch {
                      // best effort
                    }
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <TaskCard key={t.id} task={t} verified={verifiedMap[t.host_id] === 'verified'} applicationStatus={applicationStatuses[t.id]} />
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

      {reminderOpen && upcoming.length > 0 && (
        <ActivityReminderSheet
          tasks={upcoming}
          onClose={() => {
            try {
              const seen: string[] = JSON.parse(window.localStorage.getItem(reminderKey) ?? '[]')
              const merged = Array.from(new Set([...seen, ...upcoming.map((t) => t.id)]))
              window.localStorage.setItem(reminderKey, JSON.stringify(merged))
            } catch {
              // best effort
            }
            setReminderOpen(false)
          }}
        />
      )}
    </div>
  )
}
