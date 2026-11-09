import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createTask } from '../lib/api'
import { supabase } from '../lib/supabase'
import { detectCategory } from '../lib/categoryDetector'
import { AREAS, CATEGORIES } from '../types'
import type { Category } from '../types'

export default function PostTask() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [detectedCategory, setDetectedCategory] = useState<Category>('market_run')
  const [area, setArea] = useState(profile?.area || 'Yaba')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [spots, setSpots] = useState(2)
  const [busy, setBusy] = useState(false)
  const [postingControlLoading, setPostingControlLoading] = useState(true)
  const [postingControlReady, setPostingControlReady] = useState(false)
  const [postingSuspended, setPostingSuspended] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  useEffect(() => {
    let active = true
    async function checkPostingPermission() {
      if (!profile) return
      setPostingControlLoading(true)
      setPostingControlReady(false)
      const { data, error: controlError } = await supabase
        .from('account_posting_controls')
        .select('suspended_at')
        .eq('user_id', profile.id)
        .maybeSingle()
      if (!active) return
      if (controlError) {
        setError('Could not check posting eligibility. Please refresh and try again.')
      } else {
        setPostingSuspended(Boolean(data?.suspended_at))
        setPostingControlReady(true)
      }
      setPostingControlLoading(false)
    }
    void checkPostingPermission()
    return () => { active = false }
  }, [profile?.id])

  useEffect(() => {
    setDetectedCategory(detectCategory(title, description))
  }, [title, description])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)

    if (postingControlLoading || !postingControlReady) return
    if (postingSuspended) {
      setError('This account is currently unable to post activities. Contact support if you think this is a mistake.')
      return
    }

    if (!date || !time) {
      setError('Pick a date and a time.')
      return
    }

    const when = new Date(`${date}T${time}`)
    if (Number.isNaN(when.getTime())) {
      setError('That date and time did not parse. Try again.')
      return
    }
    if (when.getTime() < Date.now()) {
      setError('That time is in the past. Pick a future date.')
      return
    }

    if (step === 'form') {
      setStep('confirm')
      return
    }

    // step === 'confirm': actually post
    setBusy(true)
    try {
      const task = await createTask(
        {
          title: title.trim(),
          description: description.trim(),
          category: detectedCategory,
          area,
          meeting_point: meetingPoint.trim(),
          date_time: when.toISOString(),
          spots_needed: spots,
          fill_mode: 'review',
        },
        profile,
      )
      navigate(`/task/${task.id}`, { replace: true })
    } catch (e) {
      const message = e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
          ? e.message
          : null
      setError(
        message?.includes('fill_mode')
          ? 'Activity posting needs a database update. Please apply supabase/migrations/003_fill_mode.sql in your Supabase SQL Editor, then try again.'
          : message ?? 'Could not post this activity.',
      )
    } finally {
      setBusy(false)
    }
  }

  const categoryLabel = CATEGORIES.find((c) => c.value === detectedCategory)?.label ?? detectedCategory
  const categoryEmoji = CATEGORIES.find((c) => c.value === detectedCategory)?.emoji ?? '➕'

  const whenStr = date && time ? new Date(`${date}T${time}`).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-8 pt-5">
      {step === 'form' && (
        <>
          <h1 className="font-display text-[24px] font-bold">Post an activity</h1>
          <p className="mt-1 text-[13px] text-muted">
            Say what you're doing and how many people you need. Keep it real.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="title">
                What's the activity?
              </label>
              <input
                id="title"
                className="field"
                placeholder="Need 2 people for a Balogun market run"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div>
              <label className="label">Category</label>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-3">
                <span className="text-[13px] font-semibold text-ink">{categoryEmoji} {categoryLabel}</span>
                <span className="text-[11px] text-muted ml-auto">Auto-detected</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                We read your title and details to pick the category. You can edit the text above if the category looks wrong.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="desc">
                Details
              </label>
              <textarea
                id="desc"
                className="field min-h-[110px] resize-none"
                placeholder="What are we doing, how long will it take, anything to bring?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="area">
                  Area
                </label>
                <select
                  id="area"
                  className="field"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="spots">
                  People needed
                </label>
                <input
                  id="spots"
                  type="number"
                  min={1}
                  className="field"
                  value={spots}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    if (Number.isSafeInteger(value) && value >= 1 && value <= 2147483647) {
                      setSpots(value)
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="meeting">
                Meeting point
              </label>
              <input
                id="meeting"
                className="field"
                placeholder="Balogun Market main gate, Idumota"
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                maxLength={160}
                required
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                A public landmark only. Never a home address.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  className="field"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="time">
                  Time
                </label>
                <input
                  id="time"
                  type="time"
                  className="field"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {postingSuspended && (
            <p role="status" className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">
              This account is currently unable to post activities. Contact support if you think this is a mistake.
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>
          )}

          <button
            type="submit"
            className="btn-primary mt-6 w-full"
            disabled={busy || postingControlLoading || !postingControlReady || postingSuspended || !title.trim() || !meetingPoint.trim()}
          >
            {postingControlLoading ? 'Checking…' : 'Continue to review'}
          </button>
        </>
      )}

      {step === 'confirm' && (
        <>
          <h1 className="font-display text-[24px] font-bold">Review before posting</h1>
          <p className="mt-1 text-[13px] text-muted">
            Check everything looks right. Once posted, it appears in Discover for others to join.
          </p>

          <div className="mt-5 space-y-4">
            <div className="card p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Activity</p>
              <p className="mt-0.5 text-[15px] font-bold">{title.trim()}</p>
              <p className="mt-2 text-[13px] text-ink/80 whitespace-pre-wrap">{description.trim()}</p>
            </div>

            <div className="card p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Category</p>
              <div className="mt-1 flex items-center gap-3">
                <span className={`pill ${detectedCategory === 'other' ? 'bg-line text-muted' : 'bg-sun/25 text-ink'}`}>
                  {categoryEmoji} {categoryLabel}
                </span>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setStep('form')}
                >
                  Change category
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                We picked this based on your title and details. Tap "Change category" if it looks wrong.
              </p>
            </div>

            <div className="card p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Details</p>
              <div className="mt-1 space-y-1">
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">Area:</span> {area}
                </p>
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">Meeting point:</span> {meetingPoint.trim()}
                </p>
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">When:</span> {whenStr || date || '—'}
                </p>
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">People needed:</span> {spots}
                </p>
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">Fill mode:</span> Review applicants
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => setStep('form')}
            >
              Back to edit
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={busy || postingControlLoading || !postingControlReady || postingSuspended}
            >
              {busy ? 'Posting…' : 'Post activity'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
