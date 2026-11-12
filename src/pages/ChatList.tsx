import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Clock, MapPin } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'
import { formatTime, taskEmoji } from '../lib/format'
import Spinner from '../components/Spinner'
import Avatar from '../components/Avatar'

export default function ChatList() {
  const { profile } = useAuth()
  const { unreadByTask, error: notificationError } = useNotifications()
  const [chats, setChats] = useState<
    Array<{
      task: Task
      lastMessage: { body: string; type: 'text' | 'image' | 'audio'; sender_name: string; sender_id: string; created_at: string } | null
      members: Array<{ id: string; name: string; avatar: string | null }>
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

        // For each task, fetch last message + member previews in parallel
        const enriched = await Promise.all(
          unique.map(async (t) => {
            const [msgsRes, membersRes] = await Promise.all([
              supabase
                .from('messages')
                .select('body, type, sender_name, sender_id, created_at')
                .eq('task_id', t.id)
                .order('created_at', { ascending: false })
                .limit(1),
              supabase
                .from('join_requests')
                .select('requester_id, requester_name, requester_avatar_url')
                .eq('task_id', t.id)
                .eq('status', 'accepted')
                .order('created_at', { ascending: true })
                .limit(4),
            ])
            const last = (msgsRes.data ?? [])[0]
            const members = [
              { id: t.host_id, name: t.host_name, avatar: t.host_avatar_url },
              ...((membersRes.data ?? []) as Array<{ requester_id: string; requester_name: string; requester_avatar_url: string | null }>).map((m) => ({
                id: m.requester_id,
                name: m.requester_name,
                avatar: m.requester_avatar_url,
              })),
            ].slice(0, 4)
            return { task: t, lastMessage: last ?? null, members }
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

  // Split: anything with an unread ping or starting in the next 24h goes above the fold.
  const now = Date.now()
  const buckets = {
    attention: chats.filter((c) => {
      if ((unreadByTask[c.task.id] ?? 0) > 0) return true
      const start = new Date(c.task.date_time).getTime()
      return start > now - 6 * 3600_000 && start - now < 24 * 3600_000
    }),
    quiet: [] as typeof chats,
  }
  for (const c of chats) {
    if (!buckets.attention.includes(c)) buckets.quiet.push(c)
  }

  // One row, used by both sections.
  const renderRow = (c: typeof chats[number]) => {
    const unread = unreadByTask[c.task.id] ?? 0
    const countdownLabel = (() => {
      const start = new Date(c.task.date_time)
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const days = Math.round((startOfDay(start) - startOfDay(new Date(now))) / 86_400_000)
      if (days < -364) return 'Over a year ago'
      if (days < -30) return `${Math.round(days / 30)} months ago`
      if (days < -1) return `${Math.abs(days)} days ago`
      if (days === -1) return 'Yesterday'
      if (days === 0) return 'Today'
      if (days === 1) return 'Tomorrow'
      if (days < 30) return `In ${days} days`
      if (days < 365) return `In ${Math.round(days / 30)} months`
      return `In ${Math.round(days / 365)} years`
    })()
    return (
      <Link
        key={c.task.id}
        to={`/task/${c.task.id}/chat`}
        className="card flex items-start gap-3 rounded-[18px] p-3.5 transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
      >
        <div className="relative shrink-0">
          <div className="-space-x-2 flex">
            {c.members.slice(0, 3).map((m, idx) => (
              <Avatar key={`${c.task.id}-${m.id}-${idx}`} src={m.avatar} name={m.name} size={30} />
            ))}
          </div>
          {unread > 0 && (
            <span
              aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`}
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e53935] px-1.5 text-[9px] font-bold leading-none text-white ring-2 ring-canvas"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 font-display text-[14px] font-bold leading-snug text-ink">
              {c.task.title}
            </h2>
            {c.lastMessage && (
              <span className="mt-0.5 shrink-0 text-[9px] text-muted">{formatTime(c.lastMessage.created_at)}</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-line/50 px-2 py-0.5 font-semibold text-ink/70">
              <span aria-hidden="true">{taskEmoji(c.task.category)}</span> {countdownLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1"><MapPin size={9} aria-hidden />{c.task.area}</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-[12px] text-muted">
            {c.lastMessage
              ? `${c.lastMessage.sender_id === profile?.id ? 'You' : c.lastMessage.sender_name}: ${
                  c.lastMessage.type === 'image' ? 'Sent a photo' : c.lastMessage.type === 'audio' ? 'Sent a voice note' : c.lastMessage.body
                }`
              : 'No messages yet — say hello.'}
          </p>
        </div>
      </Link>
    )
  }

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
          <div className="space-y-5">
            {buckets.attention.length > 0 && (
              <section aria-labelledby="attention-heading">
                <p id="attention-heading" className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Needs your attention
                </p>
                <div className="mt-2 space-y-2">
                  {buckets.attention.map((c) => renderRow(c))}
                </div>
              </section>
            )}
            {buckets.quiet.length > 0 && (
              <section aria-labelledby="quiet-heading">
                <p id="quiet-heading" className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  All caught up
                </p>
                <div className="mt-2 space-y-2">
                  {buckets.quiet.map((c) => renderRow(c))}
                </div>
              </section>
            )}
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
