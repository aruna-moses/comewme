import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { fetchFeed } from '../lib/api'
import type { Task } from '../types'
import TaskCard from './TaskCard'
import Spinner from './Spinner'

const VALUE_PROPS = [
  { icon: MapPin, text: 'Around Lagos, by area' },
  { icon: ShieldCheck, text: 'Meet in public. Stay private.' },
  { icon: Sparkles, text: 'No drama, no forced small talk' },
]

export default function PublicHome() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchFeed({ limit: 10 })
      .then((rows) => {
        if (active) setTasks(rows)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky sign-in bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-4">
          <Link to="/" className="font-display text-[16px] font-bold tracking-[0.18em] text-amber">
            COME W&apos; ME
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost btn-sm">
              Sign in
            </Link>
            <Link to="/login" className="btn-primary btn-sm">
              Join free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[480px] px-5 pb-6 pt-6">
        <h1 className="font-display text-[38px] font-bold leading-[1.02] tracking-tight text-ink">
          Find your people.
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Browse what&apos;s happening around Lagos right now — runs, brunches, jam sessions, pickup games.
          When you&apos;re ready, join free in under a minute.
        </p>
        <div className="mt-4 space-y-2">
          {VALUE_PROPS.map(({ icon: Icon, text }) => (
            <p key={text} className="flex items-center gap-2 text-[12px] text-ink/80">
              <Icon size={15} className="text-amber" aria-hidden />
              {text}
            </p>
          ))}
        </div>
        <Link to="/login" className="btn-primary mt-5 flex w-full items-center justify-center gap-1.5 rounded-[16px] py-3.5 text-[15px]">
          Join — it&apos;s free
          <ArrowRight size={17} aria-hidden />
        </Link>
        <p className="mt-2 text-center text-[11px] text-muted">
          Already on board? Just <Link to="/login" className="font-semibold text-ink underline underline-offset-2">sign in</Link>.
        </p>
      </section>

      {/* Live feed preview */}
      <section className="mx-auto max-w-[480px] px-4 pb-10">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[14px] font-bold">Around Lagos</h2>
          <span className="text-[11px] text-muted">A preview — sign in to see everything</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {tasks.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted">
                Nothing in the feed right now — it fills up fast. Sign in to catch the next one.
              </p>
            )}
          </div>
        )}

        <Link to="/login" className="btn-ghost mt-4 w-full">
          Sign in to see all activities and join
          <ArrowRight size={14} aria-hidden />
        </Link>
      </section>

      {/* Footer trust line */}
      <footer className="border-t border-line bg-white px-5 py-5">
        <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-muted">
            COME W&apos; ME · Lagos<br />
            Meet in public. Check each poster&apos;s reputation. Stay safe.
          </p>
          <Link to="/login" className="shrink-0 rounded-full bg-sun/20 px-3 py-1.5 text-[11px] font-bold text-amber">
            Lagosians onboard now
          </Link>
        </div>
      </footer>
    </div>
  )
}
