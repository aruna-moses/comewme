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
        setMessage('Could not copy — long-press the link instead')
      }
    }
  }

  const done = message === 'Link copied' || message === 'Shared'

  return (
    <button
      type="button"
      onClick={() => void shareTask()}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[12px] font-semibold text-canvas shadow-[0_6px_18px_rgba(11,11,15,0.35)] transition hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber active:scale-[0.97]"
      aria-label={`Share ${task.title}`}
    >
      {done ? <Check size={14} aria-hidden /> : <Send size={13} strokeWidth={2.3} aria-hidden />}
      <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{done ? 'Shared' : 'Share'}</span>
      <span className="sr-only" aria-live="polite">{message}</span>
    </button>
  )
}
