import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { submitReport } from '../lib/api'

type FeedbackType = 'bug' | 'complaint' | 'suggestion' | 'other'

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug report' },
  { value: 'complaint', label: 'Complaint about a member' },
  { value: 'suggestion', label: 'Suggestion / feature request' },
  { value: 'other', label: 'Something else' },
]

export default function Feedback() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [type, setType] = useState<FeedbackType>('bug')
  const [details, setDetails] = useState('')
  const [targetMember, setTargetMember] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (!profile) return null

  async function handleSubmit() {
    if (!details.trim() || details.trim().length < 3) {
      alert('Please tell us what happened.')
      return
    }
    setBusy(true)
    try {
      const reporterId = profile!.id
      await submitReport({
        reporter_id: reporterId,
        category: type === 'complaint' ? 'harassment' : 'feedback',
        details: details.trim(),
        reported_user_id: targetMember.trim() || null,
      })
      setSent(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send feedback')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} className="p-1" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-[20px] font-bold leading-none">Feedback &amp; Help</h1>
      </div>

      <div className="px-4 pt-4">
        {sent ? (
          <div className="card mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M22 11.08V12a10 10 0 1 1-5.93-9.149"
                  stroke="#0B0B0F"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline points="22 4 12 14.01 9 11.01" stroke="#0B0B0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-ink">Thanks</h3>
            <p className="mt-1 text-[13px] text-muted">
              We’ve received your feedback. A human reviews every message.
            </p>
            <Link to="/settings" className="btn-primary mt-6">
              Back to Settings
            </Link>
          </div>
        ) : (
          <div className="card mx-4 mt-6 p-6">
            <p className="text-[13px] text-muted mb-5">
              Tell us what’s on your mind. If this is about a specific member,
              include their name or username so we can look into it.
            </p>

            <div className="space-y-4">
              <div>
                <label className="label">What type of feedback?</label>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`chip flex-1 ${type === t.value ? 'chip-active' : ''}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="details">
                  Details
                </label>
                <textarea
                  id="details"
                  className="field min-h-[120px] resize-none"
                  placeholder="What happened, when, and who was involved?"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={4000}
                />
              </div>

              {type === 'complaint' && (
                <div>
                  <label className="label" htmlFor="target">
                    About which member? (optional)
                  </label>
                  <input
                    id="target"
                    className="field"
                    placeholder="@username or full name"
                    value={targetMember}
                    onChange={(e) => setTargetMember(e.target.value)}
                    maxLength={80}
                  />
                </div>
              )}

              <div className="pt-2 text-[12px] leading-relaxed text-muted">
                We don’t share your contact details with other members. All
                coordination should stay in the app chat.
              </div>

              <button
                className="btn-primary w-full"
                disabled={busy || details.trim().length < 3}
                onClick={handleSubmit}
              >
                {busy ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
