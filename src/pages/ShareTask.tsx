import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock3, MapPin, UsersRound, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, categoryLabel } from '../types'
import type { Task } from '../types'
import { formatDateTime } from '../lib/format'

export default function ShareTask() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<Task | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    document.title = "Come w' me — an activity for you"
    if (!id) {
      setStatus('missing')
      return () => { active = false }
    }
    supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        setTask((data as Task | null) ?? null)
        setStatus(error || !data ? 'missing' : 'ok')
      })
    return () => {
      active = false
    }
  }, [id])

  const emoji = task ? CATEGORIES.find((c) => c.value === task.category)?.emoji ?? '➕' : ''
  const pct = task ? Math.min(100, Math.round((task.spots_filled / task.spots_needed) * 100)) : 0

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-5 px-5 py-10">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2">
        <span className="font-display text-[20px] font-bold tracking-[0.14em] text-amber">
          COME W&apos; ME
        </span>
      </Link>
      <p className="text-center text-[13px] text-muted">Find your people. Show up together.</p>

      {status === 'loading' && (
        <div className="flex h-40 w-full max-w-md items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-amber" />
        </div>
      )}

      {status === 'missing' && (
        <div className="card w-full max-w-md p-6 text-center">
          <p className="font-display text-[18px] font-bold text-ink">This activity isn&apos;t available</p>
          <p className="mt-2 text-[13px] text-muted">
            It may have been completed, cancelled, or the link is wrong. There&apos;s always something going on — take a look.
          </p>
          <Link to="/" className="btn-primary mt-4 w-full">
            See what&apos;s happening
          </Link>
        </div>
      )}

      {status === 'ok' && task && (
        <div className="card w-full max-w-md overflow-hidden rounded-2xl">
          <div className="flex items-start gap-3 border-b border-line bg-canvas p-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: '#fff4d1' }}>
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                {categoryLabel(task.category)} in {task.area}
              </p>
              <h1 className="mt-1 font-display text-[18px] font-bold leading-snug text-ink">{task.title}</h1>
            </div>
          </div>
          <div className="space-y-2 p-4">
            <p className="flex items-center gap-2 text-[13px] text-ink">
              <Clock3 size={15} className="shrink-0 text-muted" />
              {formatDateTime(task.date_time)}
            </p>
            <p className="flex items-center gap-2 text-[13px] text-ink">
              <MapPin size={15} className="shrink-0 text-muted" />
              {task.area}
            </p>
            <p className="flex items-center gap-2 text-[13px] text-ink">
              <UsersRound size={15} className="shrink-0 text-muted" />
              {task.spots_filled}/{task.spots_needed} spots filled
            </p>
            {task.description && (
              <p className="rounded-xl bg-line/40 p-3 text-[12px] leading-relaxed text-ink/80">{task.description}</p>
            )}
            <div className="h-1.5 overflow-hidden rounded-full bg-[#f7e9d8]">
              <div className="h-full rounded-full bg-amber" style={{ width: `${pct}%` }} />
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm flex items-center gap-1.5"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1800)
                } catch {
                  setCopied(false)
                }
              }}
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
          <div className="border-t border-line bg-[#fffbe8] p-4">
            <p className="text-[13px] font-semibold text-ink">Want to join?</p>
            <p className="mt-0.5 text-[12px] text-muted">
              Sign up free. Meet in public, keep personal details private.
            </p>
            <Link to={`/task/${task.id}`} className="btn-primary mt-3 w-full">
              Join this activity
            </Link>
            <Link to="/login" className="btn-ghost mt-2 w-full">
              Sign in or create account
            </Link>
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-muted">Come w&apos; me · Lagos · Meet in public</p>
    </div>
  )
}
