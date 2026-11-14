import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import type { Task } from '../types'
import { formatDateTime } from '../lib/format'

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = typeof document.execCommand === 'function' && document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('Could not copy')
}

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

      await copyToClipboard(url)
      setMessage('Link copied')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return

      try {
        await copyToClipboard(url)
        setMessage('Link copied')
      } catch {
        setMessage('Could not copy')
      }
    }
  }

  const done = message === 'Link copied' || message === 'Shared'

  return (
    <button
      type="button"
      onClick={() => void shareTask()}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
      aria-label={`Share ${task.title}`}
    >
      {done ? <Check size={14} aria-hidden /> : <Send size={13} aria-hidden />}
      <span>{done ? 'Shared' : 'Share'}</span>
      <span className="sr-only" aria-live="polite">{message}</span>
    </button>
  )
}
