import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Pin, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { usePersistedState } from '../lib/drafts'
import { formatTime, taskEmoji, categoryTileBg } from '../lib/format'
import { cacheKeys, readCache, writeCache } from '../lib/dataCache'
import { loadChatsForUser } from '../lib/chatsData'

export default function ChatList() {
  const { profile } = useAuth()
  const { unreadByTask, error: notificationError } = useNotifications()
  const cached = profile?.id ? readCache<Awaited<ReturnType<typeof loadChatsForUser>>>(cacheKeys.chats(profile.id)) : undefined

  const [chats, setChats] = useState<Awaited<ReturnType<typeof loadChatsForUser>>>(cached ?? [])
  const [loading, setLoading] = useState(() => !cached)

  useEffect(() => {
    let alive = true
    if (!profile?.id) return
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
    return () => {
      alive = false
    }
  }, [profile?.id])

  const [pinnedIds, setPinnedIds] = usePersistedState<string[]>('chats:pinned', [])
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

  // Split: Pinned > Attention > Catch-up > Brand-new (say hi first)
  const now = Date.now()
  const buckets = {
    pinned: pinnedIds.map((id) => chats.find((c) => c.task.id === id)).filter(Boolean) as typeof chats,
    attention: chats.filter((c) => {
      if (pinnedIds.includes(c.task.id)) return false
      if ((unreadByTask[c.task.id] ?? 0) > 0) return true
      const start = new Date(c.task.date_time).getTime()
      return start > now - 6 * 3600_000 && start - now < 24 * 3600_000
    }),
    quiet: [] as typeof chats,
    newChats: [] as typeof chats,
  }
  for (const c of chats) {
    if (pinnedIds.includes(c.task.id)) continue
    if (buckets.attention.includes(c)) continue
    if (c.lastMessage) buckets.quiet.push(c)
    else buckets.newChats.push(c)
  }

  const renderRow = (c: typeof chats[number]) => {
    const unread = unreadByTask[c.task.id] ?? 0
    const pinned = isPinned(c.task.id)
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
        ? 'bg-verified/15 text-verified'
        : days > 0
          ? 'bg-sun/15 text-amber'
          : 'bg-line/50 text-muted'
    return (
      <div key={c.task.id} className="relative">
        <Link
          to={`/task/${c.task.id}/chat`}
          className="card flex items-start gap-3 rounded-[18px] p-3.5 pr-10 transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
        >
        <div className="relative shrink-0">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full text-[26px] shadow-sm ring-1 ring-black/5 ${categoryTileBg(c.task.category)}`}
            aria-hidden="true"
          >
            {taskEmoji(c.task.category)}
          </div>
          {unread > 0 && (
            <span
              aria-label={`${unread} unread ${unread === 1 ? 'message' : 'messages'}`}
              className="absolute -right-1.5 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e53935] px-1.5 text-[9px] font-bold leading-none text-white ring-2 ring-canvas"
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
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${countdownTone}`}>
              <span aria-hidden="true">{taskEmoji(c.task.category)}</span> {countdownLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1"><MapPin size={9} aria-hidden />{c.task.area}</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-[12px] text-muted">
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
        </div>
      </Link>
        <button
          type="button"
          onClick={() => togglePin(c.task.id)}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${c.task.title}` : `Pin ${c.task.title}`}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition ${pinned ? 'bg-sun/25 text-amber' : 'text-muted hover:bg-canvas hover:text-ink'}`}
        >
          <Pin size={16} aria-hidden />
        </button>
      </div>
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
            {buckets.pinned.length > 0 && (
              <section aria-labelledby="pinned-heading">
                <p id="pinned-heading" className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber">
                  <Pin size={12} aria-hidden /> Pinned
                </p>
                <div className="mt-2 space-y-2">
                  {buckets.pinned.map((c) => renderRow(c))}
                </div>
              </section>
            )}
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
            {buckets.newChats.length > 0 && (
              <section aria-labelledby="new-chats-heading">
                <p id="new-chats-heading" className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  <Sparkles size={12} aria-hidden /> Just created — say hi
                </p>
                <div className="mt-2 space-y-2">
                  {buckets.newChats.map((c) => renderRow(c))}
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
