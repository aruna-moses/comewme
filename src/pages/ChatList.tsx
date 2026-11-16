import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Pin, BellOff, ChevronDown, MoreVertical } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { usePersistedState, readDraft, writeDraft, clearDraft } from '../lib/drafts'
import { formatTime, taskEmoji, categoryTileBg } from '../lib/format'
import { cacheKeys, readCache, writeCache } from '../lib/dataCache'
import { loadChatsForUser } from '../lib/chatsData'
import { supabase } from '../lib/supabase'

export default function ChatList() {
  const { profile } = useAuth()
  const { unreadByTask, quoteCountByTask, error: notificationError } = useNotifications()
  const cached = profile?.id ? readCache<Awaited<ReturnType<typeof loadChatsForUser>>>(cacheKeys.chats(profile.id)) : undefined

  const [chats, setChats] = useState<Awaited<ReturnType<typeof loadChatsForUser>>>(cached ?? [])
  const [loading, setLoading] = useState(() => !cached)

  useEffect(() => {
    let alive = true
    if (!profile?.id) return
    const refresh = () => {
      void loadChatsForUser(profile.id)
        .then((entries) => {
          if (!alive) return
          setChats(entries)
          writeCache(cacheKeys.chats(profile.id!), entries)
          setLoading(false)
        })
        .catch(() => {
          if (alive) setLoading(false)
        })
    }
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && alive) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    // Safety net: if realtime is flaky, poll while this tab is visible
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && alive) refresh()
    }, 15_000)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
    }
  }, [profile?.id])

  // Keep the latest loaded chat ids in a ref so the realtime listener can filter without re-subscribing
  const knownIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    knownIdsRef.current = new Set(chats.map((c) => c.task.id))
  }, [chats])

  // Realtime: a new message in any of our chats bumps that chat to the top, matching WhatsApp ordering.
  useEffect(() => {
    const userId = profile?.id
    if (!userId) return
    const channel = supabase
      .channel(`chat-list:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as {
            task_id: string
            body: string
            type: string
            sender_name: string
            sender_id: string
            created_at: string
          }
          const taskId = row.task_id
          if (!taskId || !knownIdsRef.current.has(taskId)) return
          setChats((current) => {
            const index = current.findIndex((c) => c.task.id === taskId)
            if (index === -1) return current
            const entry = current[index]
            const next = current.slice()
            next.splice(index, 1)
            next.unshift({
              task: entry.task,
              acceptedAt: entry.acceptedAt,
              lastMessage: {
                body: row.body,
                type: (row.type === 'text' || row.type === 'image' || row.type === 'audio' ? row.type : 'text'),
                sender_name: row.sender_name,
                sender_id: row.sender_id,
                created_at: row.created_at,
              },
            })
            return next
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as { task_id: string; created_at: string }
          const taskId = row.task_id
          if (!taskId || !knownIdsRef.current.has(taskId)) return
          setChats((current) => {
            const index = current.findIndex((c) => c.task.id === taskId)
            if (index === -1) return current
            const entry = current[index]
            const next = current.slice()
            next.splice(index, 1)
            next.unshift({
              task: entry.task,
              acceptedAt: entry.acceptedAt,
              lastMessage: entry.lastMessage
                ? { ...entry.lastMessage, created_at: row.created_at }
                : null,
            })
            return next
          })
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('ChatList realtime channel issue:', status)
        }
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const [pinnedIds, setPinnedIds] = usePersistedState<string[]>('chats:pinned', [])
  const [doneExpanded, setDoneExpanded] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [muteTick, setMuteTick] = useState(0)
  const readMute = (id: string) => {
    try {
      return readDraft<boolean>(`chat:${id}:mute`)?.value ?? false
    } catch {
      return false
    }
  }
  const setMute = (id: string, mute: boolean) => {
    try {
      if (mute) writeDraft(`chat:${id}:mute`, true)
      else clearDraft(`chat:${id}:mute`)
    } catch {
      // best-effort — ignore write failures
    }
    setMuteTick((t) => t + 1)
  }
  void muteTick
  const isPinned = (id: string) => pinnedIds.includes(id)
  const togglePin = (id: string) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (loading) {
    return (
      <div className="pb-8" aria-hidden>
        <header className="px-5 pb-2 pt-8">
          <div className="skeleton h-7 w-32 rounded-lg" />
          <div className="skeleton mt-1.5 h-4 w-72" />
        </header>
        <div className="mt-4 divide-y divide-line px-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-3">
              <div className="skeleton h-12 w-12 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton mt-2 h-3 w-3/4" />
              </div>
              <div className="skeleton h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Split: pin first, then one clean list, done groups collapsed at the bottom.
  const now = Date.now()
  const isDoneChat = (c: (typeof chats)[number]) => {
    if (c.task.status === 'completed') return true
    return new Date(c.task.date_time).getTime() < now
  }
  const FRESH_JOINED_MS = 3600_000 // 1 hour
  const buckets = {
    pinned: (pinnedIds.map((id) => chats.find((c) => c.task.id === id)).filter(Boolean) as typeof chats)
      .sort((a, b) => {
        const aT = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.task.date_time).getTime()
        const bT = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.task.date_time).getTime()
        return bT - aT
      }),
    live: [] as typeof chats,
    done: [] as typeof chats,
  }
  for (const c of chats) {
    if (pinnedIds.includes(c.task.id)) continue
    if (isDoneChat(c)) {
      buckets.done.push(c)
      continue
    }
    buckets.live.push(c)
  }
  const newChats = buckets.live.filter((c) => {
    // Only for groups the user was freshly accepted into (within 1h) and hasn't spoken in yet
    if (c.task.host_id === profile?.id) return false
    if (c.lastMessage) return false
    const accepted = c.acceptedAt ? new Date(c.acceptedAt).getTime() : NaN
    return Number.isFinite(accepted) && now - accepted <= FRESH_JOINED_MS
  })
  const lastActivityOf = (c: (typeof chats)[number]) => (c.lastMessage ? new Date(c.lastMessage.created_at).getTime() : new Date(c.task.date_time).getTime())
  buckets.live.sort((a, b) => lastActivityOf(b) - lastActivityOf(a))
  buckets.done.sort((a, b) => lastActivityOf(b) - lastActivityOf(a))

  const renderRow = (c: typeof chats[number]) => {
    const unread = unreadByTask[c.task.id] ?? 0
    const quotedYou = quoteCountByTask[c.task.id] ?? 0
    const pinned = isPinned(c.task.id)
    const muted = readMute(c.task.id)
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const start = new Date(c.task.date_time)
    const days = Math.round((startOfDay(start) - startOfDay(new Date(now))) / 86_400_000)
    const countdownLabel = (() => {
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
    const countdownTone =
      days === 0
        ? 'border border-amber/50 bg-gradient-to-r from-sun/25 via-amber/15 to-sun/10 text-amber'
        : days > 0
          ? 'bg-sun/15 text-amber'
          : 'bg-line/50 text-muted'
    const doneChat = isDoneChat(c)
    const happeningToday = !doneChat && days === 0
    const menuOpen = menuFor === c.task.id
    return (
      <div key={c.task.id} className={`relative flex items-center gap-1.5 border-b border-line py-2 pl-4 pr-2 transition hover:bg-canvas active:scale-[0.99] ${happeningToday ? 'bg-gradient-to-r from-sun/20 via-amber/10 to-transparent ring-1 ring-inset ring-amber/40' : ''} ${doneChat ? 'opacity-70' : ''}`}>
        <Link
          to={`/task/${c.task.id}/chat`}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 flex-1 min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full text-[26px] shadow-sm ring-1 ring-black/5 ${categoryTileBg(c.task.category)}`}
            aria-hidden="true"
          >
            {taskEmoji(c.task.category)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {pinned && <Pin size={12} className="shrink-0 text-muted" fill="currentColor" aria-hidden />}
              <h2 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug -tracking-[0.01em] text-ink">
                {c.task.title}
              </h2>
            </div>
            <p className={`-mt-0.5 line-clamp-1 text-[16px] leading-snug ${unread > 0 ? 'font-medium text-ink' : 'text-muted'}`}>
              {c.lastMessage
                ? `${c.lastMessage.sender_id === profile?.id ? 'You' : c.lastMessage.sender_name}: ${
                    c.lastMessage.type === 'image'
                      ? c.lastMessage.body || 'Sent a photo'
                      : c.lastMessage.type === 'audio'
                        ? 'Sent a voice note'
                        : c.lastMessage.body
                  }`
                : 'No messages yet — say hello.'}
            </p>
            <div className="mt-0 flex min-w-0 items-center gap-1.5 leading-none text-[13px] text-muted">
              {doneChat ? (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase leading-none tracking-[0.14em] text-muted">
                  {c.task.status === 'completed' ? 'Completed' : 'Passed'}
                </span>
              ) : happeningToday ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber/50 bg-gradient-to-r from-sun/25 via-amber/15 to-sun/10 px-2 py-0.5 text-[12px] font-extrabold uppercase leading-none tracking-[0.14em] text-amber">
                  <span className="h-1.5 w-1.5 shrink-0 animate-[pulseSoft_1.6s_ease-in-out_infinite] rounded-full bg-amber" aria-hidden />
                  Happening today
                </span>
              ) : (
                <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-semibold leading-none ${countdownTone}`}>
                  {countdownLabel}
                </span>
              )}
              <span aria-hidden="true" className="shrink-0">·</span>
              <span className="inline-flex min-w-0 items-center gap-1 font-semibold text-ink/80"><MapPin size={9} className="shrink-0" aria-hidden /><span className="truncate">{c.task.area}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`text-[14px] leading-none tabular-nums ${unread > 0 ? 'font-semibold text-amber' : 'text-muted'}`}>
              {c.lastMessage ? formatTime(c.lastMessage.created_at) : formatTime(c.task.date_time)}
            </span>
            {unread > 0 && (
              <span
                aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`}
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[12px] font-bold leading-none text-white"
                style={{ backgroundColor: 'rgb(var(--color-amber))' }}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
            {quotedYou > 0 && (
              <span
                aria-label={`${quotedYou} ${quotedYou === 1 ? 'message' : 'messages'} quoted you`}
                className="flex h-5 min-w-5 items-center justify-center rounded-full border border-amber/40 bg-sun/25 px-1.5 text-[10px] font-extrabold uppercase leading-none text-amber"
              >
                @{quotedYou}
              </span>
            )}
            {muted && <BellOff size={12} className="text-muted" aria-label="Muted" />}
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMenuFor(menuOpen ? null : c.task.id)}
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
        >
          <MoreVertical size={16} aria-hidden />
        </button>
        {menuOpen && (
          <>
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuFor(null)} />
            <div
              role="menu"
              className="absolute right-2 top-full z-20 mt-1.5 min-w-[172px] overflow-hidden rounded-xl border border-line bg-white py-1 text-left shadow-lift"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  togglePin(c.task.id)
                  setMenuFor(null)
                }}
                className="flex min-h-10 w-full items-center gap-2 px-3 text-[15px] font-medium text-ink hover:bg-canvas"
              >
                <Pin size={15} aria-hidden fill={pinned ? 'currentColor' : 'none'} />
                {pinned ? 'Unpin chat' : 'Pin chat'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMute(c.task.id, !muted)
                  setMenuFor(null)
                }}
                className="flex min-h-10 w-full items-center gap-2 px-3 text-[15px] font-medium text-ink hover:bg-canvas"
              >
                <BellOff size={15} aria-hidden />
                {muted ? 'Unmute notifications' : 'Mute notifications'}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="pb-8">
      <header className="px-5 pb-2 pt-8">
        <h1 className="font-display text-[24px] font-bold leading-tight">Chats</h1>
        <p className="mt-1 text-[15px] text-muted">Coordinate with your activity group before you meet.</p>
      </header>

      <div className="pb-8">
        {notificationError && (
          <p role="status" className="mx-4 mb-3 rounded-xl bg-[#fff4d1] p-3 text-[14px] leading-relaxed text-[#7a622f]">
            {notificationError}
          </p>
        )}
        {chats.length === 0 ? (
          <div className="mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
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
            <p className="mt-1 text-[15px] text-muted">
              Start a conversation in a group you&apos;re hosting or joined.
            </p>
          </div>
        ) : (
          <>
            {buckets.pinned.length > 0 && (
              <section aria-labelledby="pinned-heading" className="border-t border-line">
                <p id="pinned-heading" className="flex items-center gap-1.5 border-b border-line px-4 pb-1.5 pt-1 text-[12px] font-bold uppercase tracking-[0.16em] text-amber">
                  <Pin size={12} aria-hidden /> Pinned
                </p>
                {buckets.pinned.map((c) => renderRow(c))}
              </section>
            )}
            {buckets.live.length > 0 && (
              <section aria-label="Recent chats" className="border-t border-line">
                {buckets.live.map((c) => renderRow(c))}
              </section>
            )}
            {newChats.length > 0 && (
              <section aria-labelledby="new-chats-heading" className="border-t border-line">
                <p id="new-chats-heading" className="border-b border-line px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Just accepted — say hi
                </p>
                {newChats.map((c) => renderRow(c))}
              </section>
            )}
            {buckets.done.length > 0 && (
              <section aria-labelledby="completed-chats-heading" className="border-t border-line">
                <button
                  type="button"
                  onClick={() => setDoneExpanded((v) => !v)}
                  aria-expanded={doneExpanded}
                  aria-controls="completed-chats-list"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.16em] text-muted transition"
                >
                  <span className="flex items-center gap-1.5">
                    Completed chats
                    <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-ink/60">
                      {buckets.done.length}
                    </span>
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${doneExpanded ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {doneExpanded && (
                  <div id="completed-chats-list">
                    {buckets.done.map((c) => renderRow(c))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
