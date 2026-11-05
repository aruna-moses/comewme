import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Clock3, MapPin, MessageCircle, UsersRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import type { JoinStatus, Task } from '../types'
import { CATEGORIES, categoryLabel } from '../types'
import { formatDateTime } from '../lib/format'
import Spinner from '../components/Spinner'
import Avatar from '../components/Avatar'
import ShareTaskButton from '../components/ShareTaskButton'

export default function MyTasks() {
  const { profile } = useAuth()
  const { pendingApplications } = useNotifications()
  const location = useLocation()
  const [hosted, setHosted] = useState<Task[]>([])
  const [joined, setJoined] = useState<Task[]>([])
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JoinStatus>>({})
  const [tab, setTab] = useState<'hosting' | 'going'>('hosting')
  const [pendingApplicants, setPendingApplicants] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
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
    setLoading(true)
    setLoadError(null)
    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('host_id', profile.id)
        .order('date_time', { ascending: false }),
      supabase
        .from('join_requests')
        .select('task_id, status')
        .eq('requester_id', profile.id)
        .neq('status', 'withdrawn'),
    ])
      .then(async ([hostRes, joinRes]) => {
        if (!alive) return
      if (hostRes.error) throw hostRes.error
      if (joinRes.error) throw joinRes.error
      const h = (hostRes.data ?? []) as Task[]
        setHosted(h)

        const hostIds = h.map((task) => task.id)
        if (hostIds.length > 0) {
          const { data: applicants, error } = await supabase
            .from('join_requests')
            .select('task_id')
            .in('task_id', hostIds)
            .eq('status', 'pending')
          if (error) throw error
          const counts: Record<string, number> = {}
          for (const applicant of applicants ?? []) {
            counts[applicant.task_id] = (counts[applicant.task_id] ?? 0) + 1
          }
          if (alive) setPendingApplicants(counts)
        } else {
          setPendingApplicants({})
        }

        const applications = joinRes.data ?? []
        const ids = applications.map((request) => request.task_id)
        const statuses = Object.fromEntries(
          applications.map((request) => [request.task_id, request.status as JoinStatus]),
        )
        if (alive) setApplicationStatuses(statuses)
        const uniqueIds = [...new Set(ids)]
        if (uniqueIds.length > 0) {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .in('id', uniqueIds)
            .order('date_time', { ascending: false })
          if (error) throw error
          if (alive) setJoined((data ?? []) as Task[])
        } else {
          if (alive) {
            setJoined([])
            setApplicationStatuses({})
          }
        }
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(error instanceof Error ? error.message : 'Could not load your tasks.')
      })
      .finally(() => alive && setLoading(false))
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

  if (loading) return <Spinner full />

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
        {pendingApplications > 0 && (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-[#f1c4c1] bg-[#fff1f0] p-3 text-left"
            onClick={() => setTab('hosting')}
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[#b3261e]">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e53935] px-1 text-[11px] text-white">
                {pendingApplications > 99 ? '99+' : pendingApplications}
              </span>
              {pendingApplications === 1 ? 'person is waiting for your review' : 'people are waiting for your review'}
            </span>
            <span className="shrink-0 text-[12px] font-bold text-[#b3261e]">Review</span>
          </button>
        )}
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
            const progress = Math.min(100, Math.round((t.spots_filled / t.spots_needed) * 100))
            const capacityFull = t.status === 'full' || t.spots_filled >= t.spots_needed
            const spotsRemaining = Math.max(0, t.spots_needed - t.spots_filled)
            const statusLabel = applicationStatus === 'accepted'
              ? 'Accepted'
              : applicationStatus === 'pending'
                ? 'In review'
                : applicationStatus === 'waitlisted'
                  ? 'Waitlisted'
                  : applicationStatus === 'declined'
                    ? 'Not selected'
                    : null

            return (
            <article
              key={t.id}
              className={`card rounded-[18px] p-4 ${targetTaskId === t.id ? 'task-reminder-highlight' : ''}`}
            >
              <Link
                id={`task-${t.id}`}
                to={`/task/${t.id}`}
                className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="pill bg-[#eef7f5] text-[#16827d]">
                    {CATEGORIES.find((category) => category.value === t.category)?.emoji}{' '}
                    {categoryLabel(t.category).toUpperCase()}
                  </span>
                  {tab === 'going' && statusLabel ? (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      applicationStatus === 'accepted'
                        ? 'bg-verified/10 text-verified'
                        : applicationStatus === 'pending'
                          ? 'bg-amber/10 text-amber'
                          : applicationStatus === 'waitlisted'
                            ? 'bg-[#eef4fb] text-[#4273a8]'
                            : 'bg-line text-muted'
                    }`}>
                      {statusLabel}
                    </span>
                  ) : (
                    <span className={`text-[11px] font-semibold ${
                      t.status === 'open'
                        ? 'text-verified'
                        : t.status === 'full'
                          ? 'text-amber'
                          : 'text-muted'
                    }`}>
                      {t.status === 'full' ? 'Full' : t.status === 'open' ? 'Open' : t.status}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 font-display text-[16px] font-bold leading-snug">{t.title}</h2>
                {tab === 'going' && (
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar src={t.host_avatar_url} name={t.host_name} size={25} />
                    <p className="truncate text-[12px] text-muted">Posted by <span className="font-semibold text-ink">{t.host_name}</span></p>
                  </div>
                )}
                <div className="mt-2 space-y-1.5 text-[12px] text-muted">
                  <p className="flex items-center gap-1.5">
                    <MapPin size={15} aria-hidden />
                    {t.area}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock3 size={15} aria-hidden />
                    {formatDateTime(t.date_time)}
                  </p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f7e9d8]" aria-label={`${progress}% of activity spots filled`}>
                  <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <UsersRound size={15} aria-hidden />
                    {t.spots_filled}/{t.spots_needed} joined
                  </span>
                  <span className={`font-semibold ${capacityFull ? 'text-amber' : 'text-muted'}`}>
                    {capacityFull ? 'Full' : `${spotsRemaining} spot${spotsRemaining === 1 ? '' : 's'} left`}
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                {tab === 'hosting' && pendingApplicants[t.id] > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber">
                    {pendingApplicants[t.id]} applicant{pendingApplicants[t.id] === 1 ? '' : 's'}
                    <ArrowRight size={14} aria-hidden />
                  </span>
                ) : tab === 'going' && applicationStatus === 'accepted' ? (
                  <span className="text-[12px] font-semibold text-verified">Your group is ready</span>
                ) : (
                  <span className="text-[12px] font-semibold text-muted">
                    {tab === 'hosting' ? 'View task' : 'View application'}
                  </span>
                )}
                {tab === 'going' && applicationStatus === 'accepted' ? (
                  <div className="flex items-center gap-1">
                    <ShareTaskButton task={t} />
                    <Link to={`/task/${t.id}/chat`} className="btn-primary btn-sm inline-flex items-center gap-1.5">
                      <MessageCircle size={14} aria-hidden />
                      Open chat
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <ShareTaskButton task={t} />
                    <Link to={`/task/${t.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber">
                      View
                      <ArrowRight size={14} aria-hidden />
                    </Link>
                  </div>
                )}
              </div>
            </article>
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
