import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyViolationAppeals } from '../lib/api'
import type { ViolationAppeal } from '../types'
import { VIOLATION_CATEGORIES } from '../types'
import AppealForm from '../components/AppealForm'
import Spinner from '../components/Spinner'

export default function Violations() {
  const { violations, refreshCompliance } = useAuth()
  const [appeals, setAppeals] = useState<ViolationAppeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAppeals = useCallback(async () => {
    setError(null)
    try {
      setAppeals(await getMyViolationAppeals())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your appeals.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAppeals() }, [loadAppeals])

  return (
    <div className="min-h-[100dvh] pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-[13px] font-semibold text-amber">Back</Link>
        <h1 className="font-display text-[18px] font-bold">Your reports &amp; decisions</h1>
      </header>
      <main className="mx-auto max-w-[640px] space-y-3 px-4 py-5">
        <p className="text-[13px] leading-relaxed text-muted">
          This history is private to you. You can appeal a moderation decision if you think we got it wrong.
        </p>
        {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-[13px] text-alert">{error}</p>}
        {loading ? <Spinner /> : violations.length === 0 ? (
          <div className="card rounded-2xl p-5 text-center">
            <p className="font-semibold">You&apos;re all clear</p>
            <p className="mt-1 text-[13px] text-muted">There are no reports or moderation decisions on your account.</p>
          </div>
        ) : violations.map((violation) => {
          const appeal = appeals.find((item) => item.violation_id === violation.id)
          const category = VIOLATION_CATEGORIES.find((item) => item.value === violation.category)?.label ?? violation.category
          const reason = violation.action_taken
            ?? `Our moderation team reviewed a concern related to ${category.toLowerCase()} and applied this decision.`
          const mayAppeal = ['reviewed', 'appealed'].includes(violation.status)
          return (
            <article key={violation.id} className="card rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{category}</p>
                  <p className="mt-1 text-[12px] text-muted">{new Date(violation.created_at).toLocaleDateString()} · <span className="capitalize">{violation.status}</span></p>
                </div>
                <span className="pill bg-[#fff4d1] text-[#7a622f]">{violation.severity.replace(/_/g, ' ')}</span>
              </div>
              {violation.status === 'pending' ? (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">A report about your account is under review. Any moderation decision will appear here.</p>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed">{reason}</p>
              )}
              {violation.banned_until && <p className="mt-2 text-[12px] text-muted">Access returns: {new Date(violation.banned_until).toLocaleString()}</p>}
              {mayAppeal && (
                <AppealForm
                  violation={violation}
                  existingAppeal={appeal}
                  onSubmitted={() => { void Promise.all([loadAppeals(), refreshCompliance()]) }}
                />
              )}
            </article>
          )
        })}
      </main>
    </div>
  )
}
