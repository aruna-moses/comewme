import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import type { JoinStatus, Task } from '../types'
import SkeletonCard from '../components/SkeletonCard'
import TaskCard from '../components/TaskCard'
import { cacheKeys, readCache, writeCache } from '../lib/dataCache'
import { loadMyTasksForUser, type MyTasksBundle } from '../lib/myTasksData'

export default function MyTasks() {
  const { profile } = useAuth()
  const { pendingApplications } = useNotifications()
  const location = useLocation()
  const cached = profile?.id ? readCache<MyTasksBundle>(cacheKeys.myTasks(profile.id)) : undefined

  const [hosted, setHosted] = useState<Task[]>(cached?.hosted ?? [])
  const [joined, setJoined] = useState<Task[]>(cached?.joined ?? [])
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JoinStatus>>(cached?.statuses ?? {})
  const [verifiedMap, setVerifiedMap] = useState<Record<string, 'unverified' | 'pending' | 'verified'>>(cached?.verifiedMap ?? {})
  const [tab, setTab] = useState<'hosting' | 'going'>('hosting')
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
        if (alive) setLoadError(error instanceof Error ? error.message : 'Could not load your tasks.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [profile?.id, refreshKey])

  const targetTaskId = new URLSearchParams(location.search).get('task')

  useEffect(() => {
    if (loading || !targetTaskId) return
    if (hosted.some((task) => task.id === targetTaskId)) {
      setTab('hosting')
    } else if (joined.some((task) => task.id === targetTaskId)) {
      setTab('going')
    }
  }, [loading, targetTaskId, hosted, joined])

  useEffect(() => {
    if (loading || !targetTaskId) return
    const targetInCurrentTab = (tab === 'hosting' ? hosted : joined).some((task) => task.id === targetTaskId)
    if (!targetInCurrentTab) return
    const timer = window.setTimeout(() => {
      document.getElementById(`task-${targetTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [loading, targetTaskId, tab, hosted, joined])

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

  const list = tab === 'hosting' ? hosted : joined
  const empty =
    tab === 'hosting'
      ? "You haven't hosted anything yet. Post an activity and people will join."
      : "You haven't joined anything yet. Browse Discover and request to join."

  return (
    <div className="pb-8">
      <header className="px-5 pb-2 pt-8">
        <h1 className="font-display text-[24px] font-bold leading-tight">My tasks</h1>
        <p className="mt-1 text-[14px] text-muted">Everything you&apos;ve posted and applied to.</p>
      </header>

      <div className="px-5 pt-4">
        <div className="flex rounded-[16px] bg-[#ece9e2] p-1">
          <button
            onClick={() => setTab('hosting')}
            className={`flex-1 rounded-[12px] py-3 text-[12px] font-semibold transition ${
              tab === 'hosting'
                ? 'bg-white text-amber shadow-sm'
                : 'text-muted'
            }`}
          >
            Posted ({hosted.length})
            {pendingApplications > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e53935] px-1.5 align-middle text-[10px] font-bold leading-none text-white">
                {pendingApplications > 99 ? '99+' : pendingApplications}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('going')}
            className={`flex-1 rounded-[12px] py-3 text-[12px] font-semibold transition ${
              tab === 'going'
                ? 'bg-white text-amber shadow-sm'
                : 'text-muted'
            }`}
          >
            Applied ({joined.length})
          </button>
        </div>

        {loadError && (
          <div className="card mt-4 p-4 text-center">
            <p className="text-[13px] font-semibold text-alert">Could not load your tasks</p>
            <p className="mt-1 text-[12px] text-muted">{loadError}</p>
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
              <TaskCard task={t} verified={verifiedMap[t.host_id] === 'verified'} applicationStatus={tab === 'going' ? applicationStatus : undefined} reviewBadge={tab === 'hosting' ? pendingApplicants[t.id] ?? 0 : 0} />
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[12px] font-semibold text-muted">
                  {tab === 'hosting'
                    ? (pendingApplicants[t.id] ?? 0) > 0
                      ? `${pendingApplicants[t.id]} waiting for your review`
                      : 'No applicants yet'
                    : applicationStatus === 'accepted'
                      ? 'Your group is ready'
                      : applicationStatus === 'pending'
                        ? 'Waiting for the host'
                        : 'Application sent'}
                </span>
                {tab === 'going' && applicationStatus === 'accepted' && (
                  <Link to={`/task/${t.id}/chat`} className="btn-primary btn-sm inline-flex items-center gap-1.5">
                    <MessageCircle size={14} aria-hidden />
                    Open chat
                  </Link>
                )}
              </div>
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
              <p className="mt-1 text-[13px] text-muted">{empty.split('.').slice(1).join('.')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
