import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import type { Task } from '../types'
import { formatDateTime } from '../lib/format'

export default function ShareTaskButton({ task }: { task: Task }) {
  const [message, setMessage] = useState('')

  async function shareTask() {
    const url = `${window.location.origin}/share/task/${encodeURIComponent(task.id)}`
    const text = `${task.title} in ${task.area} · ${formatDateTime(task.date_time)}`

    try {
      if (navigator.share) {
        await navigator.share({ title: task.title, text, url })
        setMessage('Shared')
        return
      }

      await navigator.clipboard.writeText(url)
      setMessage('Link copied')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url)
          setMessage('Link copied')
          return
        } catch {
          setMessage('Could not share this link')
          return
        }
      }

      setMessage('Could not share this link')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void shareTask()}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-amber transition hover:bg-amber/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
      aria-label={`Share ${task.title}`}
    >
      {message === 'Link copied' || message === 'Shared'
        ? <Check size={15} aria-hidden />
        : <Share2 size={15} aria-hidden />}
      {message || 'Share'}
      <span className="sr-only" aria-live="polite">{message}</span>
    </button>
  )
}
