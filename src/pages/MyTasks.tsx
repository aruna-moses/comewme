import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import type { JoinStatus, Task } from '../types'
import SkeletonCard from '../components/SkeletonCard'
import TaskCard from '../components/TaskCard'
import { cacheKeys, readCache, writeCache } from '../lib/dataCache'
import { loadMyTasksForUser, type MyTasksBundle } from '../lib/myTasksData'
import { restoreTask } from '../lib/api'
import { friendlyError } from '../lib/errors'

export default function MyTasks() {
  const { profile } = useAuth()
  const { pendingApplications } = useNotifications()
  const location = useLocation()
  const cached = profile?.id ? readCache<MyTasksBundle>(cacheKeys.myTasks(profile.id)) : undefined

  const [hosted, setHosted] = useState<Task[]>(cached?.hosted ?? [])
  const [joined, setJoined] = useState<Task[]>(cached?.joined ?? [])
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JoinStatus>>(cached?.statuses ?? {})
  const [verifiedMap, setVerifiedMap] = useState<Record<string, 'unverified' | 'pending' | 'verified'>>(cached?.verifiedMap ?? {})
  const [tab, setTab] = useState<'hosting' | 'going' | 'done'>('hosting')
  const [pendingApplicants, setPendingApplicants] = useState<Record<string, number>>(cached?.pendingApplicants ?? {})
  const [loading, setLoading] = useState(() => !cached)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`my-task-applications:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests' }, () => {
        setRefreshKey((key) => key + 1)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLoadError('Live application updates are temporarily unavailable. Refresh to check for new applicants.')
        }
      })

    return () => { void supabase.removeChannel(channel) }
  }, [profile?.id])

  useEffect(() => {
    let alive = true
    if (!profile?.id) return
    void loadMyTasksForUser(profile.id)
      .then((bundle) => {
        if (!alive) return
        setHosted(bundle.hosted)
        setJoined(bundle.joined)
        setApplicationStatuses(bundle.statuses)
        setVerifiedMap(bundle.verifiedMap)
        setPendingApplicants(bundle.pendingApplicants)
        writeCache(cacheKeys.myTasks(profile.id!), bundle)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(friendlyError(error, 'Could not load your activities.'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [profile?.id, refreshKey])

  const targetTaskId = new URLSearchParams(location.search).get('task')

  const nowMs = useMemo(() => Date.now(), [])
  const isDone = (task: Task) =>
    task.status === 'completed' || new Date(task.date_time).getTime() < nowMs

  const done = useMemo(() => {
    const seen = new Set<string>()
    const finished: Task[] = []
    for (const task of [...hosted, ...joined]) {
      if (!isDone(task) || seen.has(task.id)) continue
      seen.add(task.id)
      finished.push(task)
    }
    finished.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
    return finished
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosted, joined, nowMs])

  const hostedActive = useMemo(() => hosted.filter((t) => !isDone(t)), [hosted, nowMs]) // eslint-disable-line react-hooks/exhaustive-deps
  const joinedActive = useMemo(() => joined.filter((t) => !isDone(t) && t.status !== 'cancelled'), [joined, nowMs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !targetTaskId) return
    if (hostedActive.some((task) => task.id === targetTaskId)) {
      setTab('hosting')
    } else if (joinedActive.some((task) => task.id === targetTaskId)) {
      setTab('going')
    } else if (done.some((task) => task.id === targetTaskId)) {
      setTab('done')
    }
  }, [loading, targetTaskId, hostedActive, joinedActive, done])

  useEffect(() => {
    if (loading || !targetTaskId) return
    const targetInCurrentTab = (tab === 'hosting' ? hostedActive : tab === 'going' ? joinedActive : done).some(
      (task) => task.id === targetTaskId,
    )
    if (!targetInCurrentTab) return
    const timer = window.setTimeout(() => {
      document.getElementById(`task-${targetTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [loading, targetTaskId, tab, hosted, joined, done])

  if (loading) {
    return (
      <div className="pb-8" aria-hidden>
        <header className="px-5 pb-2 pt-8">
          <div className="skeleton h-7 w-28 rounded-lg" />
          <div className="skeleton mt-1.5 h-4 w-72" />
        </header>
        <div className="px-5 pt-4">
          <div className="skeleton h-14 w-full rounded-2xl" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const list = tab === 'hosting' ? hostedActive : tab === 'going' ? joinedActive : done
  const empty =
    tab === 'hosting'
      ? "You haven't hosted anything yet. Post an activity and people will join."
      : tab === 'going'
        ? "You haven't joined anything yet. Browse Discover and request to join."
        : 'Completed and past activities will land here once one wraps, done or expired.'

  return (
    <div className="pb-8">
      <header className="px-5 pb-2 pt-8">
        <h1 className="font-display text-[24px] font-bold leading-tight">Activities</h1>
        <p className="mt-1 text-[15px] text-muted">Everything you&apos;ve posted, applied to, and wrapped up.</p>
      </header>

      <div className="px-5 pt-4">
        <div className="segmented mt-4">
          {[
            { id: 'hosting', label: `Posted (${hostedActive.length})`, badge: pendingApplications },
            { id: 'going', label: `Applied (${joinedActive.length})`, badge: 0 },
            { id: 'done', label: `Done (${done.length})`, badge: 0 },
          ].map(({ id, label, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              aria-pressed={tab === id}
              className="segmented-item flex min-h-12 items-center justify-center gap-1.5 text-[14px]"
            >
              {label}
              {badge > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF3B30] px-1.5 text-[12px] font-bold leading-none text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="card mt-4 p-4 text-center">
            <p className="text-[15px] font-semibold text-alert">Could not load your activities</p>
            <p className="mt-1 text-[14px] text-muted">{loadError}</p>
            <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => setRefreshKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {!loadError && list.map((t) => {
            const applicationStatus = applicationStatuses[t.id]

            return (
            <div
              key={t.id}
              id={`task-${t.id}`}
              className={targetTaskId === t.id ? 'task-reminder-highlight rounded-[22px]' : ''}
            >
              {t.status === 'cancelled' && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber/40 bg-sun/15 px-3 py-2">
                  <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink">
                    Deleted everywhere. Bring it back within 30 minutes.
                  </p>
                  <button
                    type="button"
                    className="btn-ghost btn-sm shrink-0"
                    onClick={() => {
                      void restoreTask(t.id)
                        .then(() => setRefreshKey((key) => key + 1))
                        .catch((e) => alert(friendlyError(e, 'Could not restore this activity')))
                    }}
                  >
                    Restore
                  </button>
                </div>
              )}
              <TaskCard task={t} verified={verifiedMap[t.host_id] === 'verified'} applicationStatus={tab === 'going' ? applicationStatus : undefined} reviewBadge={tab === 'hosting' ? pendingApplicants[t.id] ?? 0 : 0} />
            </div>
          )})}
          {!loadError && list.length === 0 && (
            <div className="card mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundImage: 'linear-gradient(180deg,#F7A233,#EE7B1E)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"
                    stroke="#1F2430"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" stroke="#1F2430" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-bold text-ink">{empty.split('.')[0]}</h3>
              <p className="mt-1 text-[15px] text-muted">{empty.split('.').slice(1).join('.')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
