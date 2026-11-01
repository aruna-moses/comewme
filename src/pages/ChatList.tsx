import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'
import { categoryLabel } from '../types'
import { formatDateTime, formatTime, isWithin24h } from '../lib/format'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'

export default function ChatList() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [chats, setChats] = useState<
    Array<{
      task: Task
      lastMessage: { body: string; sender_name: string; created_at: string } | null
      unread: number
    }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!profile?.id) return
    setLoading(true)

    // Tasks where user is host OR accepted participant
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
        const hosted = (hostRes.data ?? []) as Task[]
        const joinedIds = (joinRes.data ?? []).map((j) => j.task_id)

        let joined: Task[] = []
        if (joinedIds.length > 0) {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .in('id', joinedIds)
            .order('date_time', { ascending: false })
          joined = (data ?? []) as Task[]
        }

        const all = [...hosted, ...joined]
        // Dedup by id
        const seen = new Set<string>()
        const unique = all.filter((t) => {
          if (seen.has(t.id)) return false
          seen.add(t.id)
          return true
        })

        // For each task, fetch last message
        const enriched = await Promise.all(
          unique.map(async (t) => {
            const { data: msgs } = await supabase
              .from('messages')
              .select('body, sender_name, created_at')
              .eq('task_id', t.id)
              .order('created_at', { ascending: false })
              .limit(1)
            const last = (msgs ?? [])[0]
            return {
              task: t,
              lastMessage: last ?? null,
              unread: 0, // simplified — could track read receipts later
            }
          })
        )

        // Sort: tasks with messages first, then by date_time
        enriched.sort((a, b) => {
          const aTime = a.lastMessage?.created_at ?? a.task.date_time
          const bTime = b.lastMessage?.created_at ?? b.task.date_time
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })

        if (alive) setChats(enriched)
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [profile?.id])

  if (loading) return <Spinner full />

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} className="p-1" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-[20px] font-bold leading-none">Chats</h1>
      </div>

      <div className="px-4 pt-4">
        {chats.length === 0 ? (
          <div className="card mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"
                  stroke="#0B0B0F"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline points="16 17 21 12 16 7" stroke="#0B0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-ink">No chats yet</h3>
            <p className="mt-1 text-[13px] text-muted">
              Start a conversation in a group you're hosting or joined.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {chats.map((c) => (
              <Link
                key={c.task.id}
                to={`/app/task/${c.task.id}`}
                className="card flex gap-3 p-4"
              >
                <Avatar
                  src={c.task.host_avatar_url}
                  name={c.task.host_name}
                  size={44}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="truncate font-display text-lg font-bold">{c.task.title}</h2>
                    {c.lastMessage && <span className="text-[11px] font-semibold text-muted">{formatTime(c.lastMessage.created_at)}</span>}
                  </div>
                  <p className="mt-1 line-clamp-1 text-[13px] text-muted">
                    {c.lastMessage ? `${c.lastMessage.sender_name}: ${c.lastMessage.body}` : 'No messages yet'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[12px] font-semibold">{c.task.spots_filled} of {c.task.spots_needed}</span>
                    {isWithin24h(c.task.date_time) && (
                      <span className="pill bg-sun/30 text-ink text-[11px] font-bold">Soon</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
