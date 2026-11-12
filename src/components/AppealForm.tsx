import { useState } from 'react'
import { submitAppeal } from '../lib/api'
import type { Violation, ViolationAppeal } from '../types'

export default function AppealForm({
  violation,
  existingAppeal,
  onSubmitted,
}: {
  violation: Violation
  existingAppeal?: ViolationAppeal
  onSubmitted: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await submitAppeal(violation.id, reason)
      setReason('')
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your appeal.')
    } finally {
      setBusy(false)
    }
  }

  if (existingAppeal) {
    return (
      <p className="mt-3 rounded-xl bg-canvas p-3 text-[12px] leading-relaxed">
        Appeal status: <strong className="capitalize">{existingAppeal.status}</strong>
        {existingAppeal.admin_response && <span className="mt-1 block text-muted">{existingAppeal.admin_response}</span>}
      </p>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-3 space-y-2">
      <label className="label" htmlFor={`appeal-${violation.id}`}>Tell us why you&apos;re appealing</label>
      <textarea
        id={`appeal-${violation.id}`}
        className="field min-h-[96px] resize-y"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={4000}
        minLength={3}
        required
      />
      {error && <p role="alert" className="text-[12px] text-alert">{error}</p>}
      <button className="btn-ghost btn-sm" disabled={busy || reason.trim().length < 3}>
        {busy ? 'Sending…' : 'Submit appeal'}
      </button>
    </form>
  )
}
