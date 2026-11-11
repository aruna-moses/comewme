import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'
import { formatTime } from '../lib/format'
import Spinner from '../components/Spinner'

export default function ChatList() {
  const { profile } = useAuth()
  const { unreadByTask, error: notificationError } = useNotifications()
  const [chats, setChats] = useState<
    Array<{
      task: Task
      lastMessage: { body: string; type: 'text' | 'image' | 'audio'; sender_name: string; created_at: string } | null
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
              .select('body, type, sender_name, created_at')
              .eq('task_id', t.id)
              .order('created_at', { ascending: false })
              .limit(1)
            const last = (msgs ?? [])[0]
            return {
              task: t,
              lastMessage: last ?? null,
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
      <header className="px-5 pb-2 pt-8">
        <h1 className="font-display text-[24px] font-bold leading-tight">Chats</h1>
        <p className="mt-1 text-[14px] text-muted">Coordinate with your task group before you meet.</p>
      </header>

      <div className="px-5 pt-4">
        {notificationError && (
          <p role="status" className="mb-3 rounded-xl bg-[#fff4d1] p-3 text-[12px] leading-relaxed text-[#7a622f]">
            {notificationError}
          </p>
        )}
        {chats.length === 0 ? (
          <div className="card mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundImage: 'linear-gradient(180deg,#F7A233,#EE7B1E)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"
                  stroke="#1F2430"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline points="16 17 21 12 16 7" stroke="#1F2430" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-ink">No chats yet</h3>
            <p className="mt-1 text-[13px] text-muted">
              Start a conversation in a group you're hosting or joined.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((c) => (
              <Link
                key={c.task.id}
                to={`/task/${c.task.id}/chat`}
                className="card flex items-center gap-3 rounded-[18px] p-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff4d1] text-amber">
                  <MessageCircle size={21} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="line-clamp-2 font-display text-[14px] font-bold leading-snug">{c.task.title}</h2>
                    <span className="ml-2 flex shrink-0 items-center gap-2">
                      {c.lastMessage && <span className="text-[9px] text-muted">{formatTime(c.lastMessage.created_at)}</span>}
                      {(unreadByTask[c.task.id] ?? 0) > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e53935] px-1 text-[9px] font-bold text-white" aria-label={`${unreadByTask[c.task.id]} unread messages`}>
                          {unreadByTask[c.task.id] > 99 ? '99+' : unreadByTask[c.task.id]}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[13px] text-muted">
                    {c.lastMessage
                      ? `${c.lastMessage.sender_name}: ${c.lastMessage.type === 'image' ? 'Photo' : c.lastMessage.type === 'audio' ? 'Voice note' : c.lastMessage.body}`
                      : 'No messages yet'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {chats.length > 0 && (
          <p className="px-2 pt-5 text-center text-[12px] leading-relaxed text-muted">
            Your task groups appear here once you&apos;ve joined. Say hello before you meet.
          </p>
        )}
      </div>
    </div>
  )
}
