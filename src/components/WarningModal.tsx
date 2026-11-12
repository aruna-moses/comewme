import { useEffect, useState } from 'react'
import { getMyViolationAppeals } from '../lib/api'
import type { Violation } from '../types'
import type { ViolationAppeal } from '../types'
import { VIOLATION_CATEGORIES } from '../types'
import AppealForm from './AppealForm'

export function activeRestriction(violations: Violation[]): Violation | null {
  const active = violations.filter((violation) => {
    if (!['reviewed', 'appealed'].includes(violation.status)) return false
    if (violation.severity === 'permanent_ban') return true
    if (!violation.severity.startsWith('suspension_')) return false
    return Boolean(violation.banned_until && new Date(violation.banned_until).getTime() > Date.now())
  })
  return active.sort((a, b) => {
    if (a.severity === 'permanent_ban') return -1
    if (b.severity === 'permanent_ban') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

export function unacknowledgedWarning(violations: Violation[]): Violation | null {
  return violations.find((violation) =>
    violation.severity === 'warning'
    && !violation.warning_acknowledged
    && ['reviewed', 'appealed'].includes(violation.status),
  ) ?? null
}

export default function WarningModal({
  violation,
  onAcknowledge,
}: {
  violation: Violation
  onAcknowledge: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appeal, setAppeal] = useState<ViolationAppeal | undefined>()
  const [appealsLoading, setAppealsLoading] = useState(true)
  const [appealLoadError, setAppealLoadError] = useState<string | null>(null)
  const permanent = violation.severity === 'permanent_ban'
  const isWarning = violation.severity === 'warning'
  const category = VIOLATION_CATEGORIES.find((item) => item.value === violation.category)?.label ?? 'Community guidelines'
  const reason = violation.action_taken
    ?? `Our moderation team reviewed a concern related to ${category.toLowerCase()} and determined that a community guideline needs your attention.`
  const expires = violation.banned_until
    ? new Date(violation.banned_until).toLocaleString()
    : null

  useEffect(() => {
    if (isWarning) return
    let active = true
    setAppeal(undefined)
    setAppealsLoading(true)
    setAppealLoadError(null)
    getMyViolationAppeals()
      .then((appeals) => {
        if (active) setAppeal(appeals.find((item) => item.violation_id === violation.id))
      })
      .catch((e: unknown) => {
        if (active) setAppealLoadError(e instanceof Error ? e.message : 'Could not load your appeal status.')
      })
      .finally(() => {
        if (active) setAppealsLoading(false)
      })
    return () => { active = false }
  }, [isWarning, violation.id])

  async function acknowledge() {
    setBusy(true)
    setError(null)
    try {
      await onAcknowledge()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your acknowledgment. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/65 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="warning-title" className="my-auto w-full max-w-[440px] rounded-[24px] bg-white p-6 shadow-lift">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-amber">
          {isWarning ? 'A note from the moderation team' : permanent ? 'Account access' : 'Temporary account suspension'}
        </p>
        <h1 id="warning-title" className="mt-2 font-display text-[23px] font-bold">
          {isWarning ? 'Please keep this in mind' : permanent ? 'Your account has been suspended' : 'Your account is temporarily paused'}
        </h1>
        <div className="mt-4 rounded-2xl bg-canvas p-4 text-[13px] leading-relaxed">
          <p><span className="font-semibold">Topic:</span> {category}</p>
          <p className="mt-2"><span className="font-semibold">Reason:</span> {reason}</p>
          <p className="mt-2"><span className="font-semibold">Date:</span> {new Date(violation.created_at).toLocaleDateString()}</p>
          {expires && <p className="mt-2"><span className="font-semibold">Access returns:</span> {expires}</p>}
        </div>
        {isWarning ? (
          <>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">We&apos;re glad you&apos;re here. Please follow the community guidelines so everyone can feel comfortable joining in.</p>
            {error && <p role="alert" className="mt-3 text-[12px] text-alert">{error}</p>}
            <button type="button" className="btn-primary mt-5 w-full" disabled={busy} onClick={() => void acknowledge()}>{busy ? 'Saving…' : 'I Understand'}</button>
          </>
        ) : (
          <>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              {permanent
                ? 'This decision prevents access to community features. If you think we got something wrong, you can appeal.'
                : 'You won’t be able to post, message or request to join activities while this suspension is active.'}
            </p>
            {permanent && <a className="mt-3 inline-block text-[13px] font-semibold text-amber underline" href="mailto:comewme.app@gmail.com">Contact comewme.app@gmail.com</a>}
            <h2 className="mt-5 font-semibold">Appeal this decision</h2>
            {appealLoadError ? (
              <p role="alert" className="mt-3 text-[12px] text-alert">{appealLoadError}</p>
            ) : appealsLoading ? (
              <p className="mt-3 text-[12px] text-muted">Checking your appeal status…</p>
            ) : (
              <AppealForm
                violation={violation}
                existingAppeal={appeal}
                onSubmitted={() => {
                  void getMyViolationAppeals()
                    .then((appeals) => setAppeal(appeals.find((item) => item.violation_id === violation.id)))
                    .catch((e: unknown) => setAppealLoadError(e instanceof Error ? e.message : 'Could not refresh your appeal status.'))
                }}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
