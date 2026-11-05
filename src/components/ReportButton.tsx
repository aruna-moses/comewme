import { useState } from 'react'
import { Flag } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { reportViolation } from '../lib/api'
import type { ViolationCategory } from '../types'
import { VIOLATION_CATEGORIES } from '../types'
import Sheet from './Sheet'

export default function ReportButton({
  reportedUserId,
  taskId,
  label = 'Report',
  className = 'btn-ghost btn-sm',
}: {
  reportedUserId: string
  taskId?: string
  label?: string
  className?: string
}) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ViolationCategory>('other')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session?.user.id === reportedUserId) return null

  function close() {
    setOpen(false)
    setSent(false)
    setDescription('')
    setError(null)
  }

  async function sendReport() {
    setBusy(true)
    setError(null)
    try {
      await reportViolation({ reportedUserId, taskId, category, description })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send this report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => session ? setOpen(true) : navigate('/login', { state: { from: location.pathname } })}
        aria-label={label}
      >
        <Flag size={14} aria-hidden />
        {label}
      </button>
      <Sheet open={open} onClose={close} title={sent ? 'Thanks for telling us' : 'Report a concern'}>
        {sent ? (
          <p role="status" className="py-2 text-[14px] leading-relaxed text-verified">
            Your report is private and has been sent to the moderation team.
          </p>
        ) : (
          <>
            <p className="text-[12px] leading-relaxed text-muted">Reports are private. Share only the details needed for us to review what happened.</p>
            <label className="label mt-3" htmlFor="violation-category">What is this about?</label>
            <select id="violation-category" className="field" value={category} onChange={(event) => setCategory(event.target.value as ViolationCategory)}>
              {VIOLATION_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="label mt-3" htmlFor="violation-description">What happened?</label>
            <textarea
              id="violation-description"
              className="field min-h-[112px] resize-y"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={4000}
              minLength={3}
              required
            />
            {error && <p role="alert" className="mt-2 text-[12px] text-alert">{error}</p>}
            <button type="button" className="btn-primary mt-3 w-full" disabled={busy || description.trim().length < 3} onClick={() => void sendReport()}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </>
        )}
      </Sheet>
    </>
  )
}
