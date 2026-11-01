import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'
import { categoryLabel, trustLevel } from '../types'
import { formatDateTime } from '../lib/format'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import { VerifiedBadge } from '../components/Badges'

export default function MyTasks() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [hosted, setHosted] = useState<Task[]>([])
  const [joined, setJoined] = useState<Task[]>([])
  const [tab, setTab] = useState<'hosting' | 'going'>('hosting')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!profile?.id) return
    setLoading(true)
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
        .eq('status', 'accepted'),
    ])
      .then(async ([hostRes, joinRes]) => {
        if (!alive) return
        const h = (hostRes.data ?? []) as Task[]
        setHosted(h)

        const ids = (joinRes.data ?? []).map((j) => j.task_id)
        if (ids.length > 0) {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .in('id', ids)
            .order('date_time', { ascending: false })
          if (alive) setJoined((data ?? []) as Task[])
        } else {
          if (alive) setJoined([])
        }
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [profile?.id])

  if (loading) return <Spinner full />

  const list = tab === 'hosting' ? hosted : joined
  const empty =
    tab === 'hosting'
      ? "You haven't hosted anything yet. Post an activity and people will join."
      : "You haven't joined anything yet. Browse Discover and request to join."

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} className="p-1" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-[20px] font-bold leading-none">My Tasks</h1>
      </div>

      <div className="px-4 pt-4">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('hosting')}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition ${
              tab === 'hosting'
                ? 'bg-sun text-ink'
                : 'bg-white text-muted border border-line'
            }`}
          >
            Hosting
          </button>
          <button
            onClick={() => setTab('going')}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition ${
              tab === 'going'
                ? 'bg-sun text-ink'
                : 'bg-white text-muted border border-line'
            }`}
          >
            Going
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {list.map((t) => (
            <Link
              key={t.id}
              to={`/app/task/${t.id}`}
              className="card flex gap-3 p-4"
            >
              <Avatar src={t.host_avatar_url} name={t.host_name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="truncate font-display text-lg font-bold">{t.title}</h2>
                  <span className={`pill ${t.status === 'completed' ? 'bg-line text-muted' : 'bg-sun/25 text-ink'}`}>
                    {t.status}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {t.area} · {formatDateTime(t.date_time)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[12px] font-semibold">{t.spots_filled} of {t.spots_needed}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (t.spots_filled / t.spots_needed) * 100)}%`,
                        backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)',
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-ink">
                    {trustLevel(t.spots_filled > 0 ? 3 : 0)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {list.length === 0 && (
            <div className="card mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"
                    stroke="#0B0B0F"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" stroke="#0B0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
