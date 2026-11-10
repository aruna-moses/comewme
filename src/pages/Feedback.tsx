import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { submitReport } from '../lib/api'
import { clearDraftGroup, usePersistedState } from '../lib/drafts'
import DraftNotice from '../components/DraftNotice'

type FeedbackType = 'bug' | 'complaint' | 'suggestion' | 'other'

const DRAFT = 'feedback'

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug report' },
  { value: 'complaint', label: 'Member complaint' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Something else' },
]

export default function Feedback() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [type, setType] = usePersistedState<FeedbackType>(`${DRAFT}:type`, 'bug')
  const [subject, setSubject] = usePersistedState(`${DRAFT}:subject`, '')
  const [message, setMessage] = usePersistedState(`${DRAFT}:message`, '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const sentRef = useRef(false)
  useEffect(() => {
    sentRef.current = sent
  }, [sent])
  useEffect(() => {
    return () => {
      if (sentRef.current) clearDraftGroup(DRAFT)
    }
  }, [])

  if (!profile) return null
  const reporterId = profile.id

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (subject.trim().length < 3 || message.trim().length < 3) return
    setBusy(true)
    try {
      await submitReport({
        reporter_id: reporterId,
        category: type === 'complaint' ? 'harassment' : 'feedback',
        details: `Subject: ${subject.trim()}\n\n${message.trim()}`,
        reported_user_id: null,
      })
      setSent(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not send feedback')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-72px)] flex-col pb-6">
      <header className="px-5 pb-2 pt-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-ink" aria-label="Back">
            <ArrowLeft size={22} aria-hidden />
          </button>
          <h1 className="font-display text-[23px] font-bold leading-tight">
            {sent ? 'Thanks for your feedback' : 'Feedback & complaints'}
          </h1>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Tell us how we can improve or report a problem. We&apos;re listening.
        </p>
      </header>

      {sent ? (
        <div className="mx-5 mt-5 flex-1">
          <div className="flex items-start gap-2.5 rounded-[13px] border border-[#cce4d4] bg-[#eaf6ee] p-3 text-[#26815d]">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden />
            <p className="text-[12px] leading-relaxed">
              Your feedback is sent. Thank you for helping make Come w&apos; me better.
            </p>
          </div>
          <div className="card mt-5 rounded-[18px] p-4">
            <p className="text-[12px] text-muted">Your subject</p>
            <p className="mt-2 text-[14px] font-semibold">{subject}</p>
            <p className="mt-3 text-[14px] text-muted">Our team will review your message.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col px-5 pt-5">
          <DraftNotice
            group={DRAFT}
            what="message"
            onDiscard={() => {
              setType('bug')
              setSubject('')
              setMessage('')
            }}
          />
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="feedback-type">Type</label>
              <select
                id="feedback-type"
                className="field"
                value={type}
                onChange={(e) => setType(e.target.value as FeedbackType)}
              >
                {FEEDBACK_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="feedback-subject">Subject</label>
              <input
                id="feedback-subject"
                className="field"
                placeholder="Finding tasks near me"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="feedback-message">Message</label>
              <textarea
                id="feedback-message"
                className="field min-h-[128px] resize-y"
                placeholder="Tell us what happened or how we can improve."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={3800}
                required
              />
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              Please don&apos;t include passwords, verification codes or anyone else&apos;s private details.
            </p>
          </div>
          <div className="mt-auto pt-8">
            <button
              type="submit"
              className="btn-primary w-full rounded-[16px]"
              disabled={busy || subject.trim().length < 3 || message.trim().length < 3}
            >
              <Send size={18} aria-hidden />
              {busy ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </form>
      )}

      {sent && (
        <div className="px-5 pt-8">
          <Link to={`/profile/${profile.id}`} className="btn-primary w-full rounded-[16px]">
            Back to profile
          </Link>
        </div>
      )}
    </div>
  )
}
