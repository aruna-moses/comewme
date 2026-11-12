import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { markNotificationRead, type InAppNotification } from '../lib/notifications'
import { supabase } from '../lib/supabase'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return 'over a day ago'
}

/** Soft, short UI chime — no audio file needed, generated on demand. */
function playPing() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const notes: Array<[number, number]> = [
      [880, 0],    // A5
      [1318.5, 0.14], // E6
    ]

    for (const [freq, offset] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + offset)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.4)
    }

    // Paranoia: close the context soon after so we don't leak nodes on long sessions
    window.setTimeout(() => void ctx.close().catch(() => {}), 1200)
  } catch {
    // Silent failure is fine — the toast itself is the notification.
  }
}

export default function InAppToast() {
  const { refresh } = useNotifications()
  const { session } = useAuth()
  const location = useLocation()
  const [queue, setQueue] = useState<InAppNotification[]>([])
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const shownRef = useRef<Set<string>>(new Set())

  // Live subscription — catches INSERT events, not refetched rows from a page load.
  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    const channel = supabase
      .channel(`in-app-toast:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const row = payload.new as InAppNotification
        if (row.user_id !== uid) return
        if (shownRef.current.has(row.id)) return
        shownRef.current.add(row.id)
        setQueue((q) => (q.length >= 3 ? q : [...q, row]))
        void refresh()
        playPing()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user.id, refresh])

  // Drive the one-at-a-time display from the queue.
  const active = queue[0] ?? null
  const pathname = location.pathname

  useEffect(() => {
    if (!active) {
      setVisible(false)
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }
    if (pathname === '/notifications' || (active.link_path && active.link_path === pathname)) {
      // Don't surprise someone while they're already on that screen.
      setQueue((q) => q.slice(1))
      void markNotificationRead(active.id)
      return
    }
    setVisible(true)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setVisible(false)
      timerRef.current = null
      setQueue((q) => q.slice(1))
    }, 6000)
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [active?.id, pathname])

  const dismiss = useCallback(() => {
    if (!active) return
    void markNotificationRead(active.id)
    setVisible(false)
    setQueue((q) => q.slice(1))
  }, [active])

  if (!active || !visible) return null

  return (
    <div
      aria-live="polite"
      role="status"
      className="toast-slide-down fixed left-1/2 top-3 z-[70] w-[92%] max-w-sm"
    >
      <Link
        to={active.link_path ?? '/notifications'}
        onClick={dismiss}
        className="flex items-start gap-3 rounded-2xl border border-line bg-white/95 p-3.5 shadow-lift backdrop-blur"
      >
        <img src="/logo.png" alt="" aria-hidden className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Come w&apos; me
            </span>
            <span className="text-[10px] text-muted">{timeAgo(active.created_at)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold leading-tight text-ink">
            {active.title}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-muted line-clamp-2">
            {active.body}
          </span>
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            dismiss()
          }}
          className="shrink-0 rounded-full p-1 text-muted hover:bg-line hover:text-ink"
        >
          <X size={15} />
        </button>
      </Link>
    </div>
  )
}
