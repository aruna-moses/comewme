import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createTask } from '../lib/api'
import { AREAS, CATEGORIES } from '../types'
import type { Category } from '../types'

export default function PostTask() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('market_run')
  const [area, setArea] = useState(profile?.area || 'Yaba')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [spots, setSpots] = useState(2)
  const [fillMode, setFillMode] = useState<'review' | 'first_come'>('review')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)

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

    setBusy(true)
    try {
      const task = await createTask(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          area,
          meeting_point: meetingPoint.trim(),
          date_time: when.toISOString(),
          spots_needed: spots,
          fill_mode: fillMode,
        },
        profile,
      )
      navigate(`/task/${task.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post this activity')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-8 pt-5">
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
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`chip ${category === c.value ? 'chip-active' : ''}`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
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
              max={50}
              className="field"
              value={spots}
              onChange={(e) => setSpots(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
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

      {error && (
        <p className="mt-4 rounded-xl bg-alert/10 p-3 text-[13px] font-medium text-alert">{error}</p>
      )}

      <button
        type="submit"
        className="btn-primary mt-6 w-full"
        disabled={busy || !title.trim() || !meetingPoint.trim()}
      >
        {busy ? 'Posting…' : 'Post activity'}
      </button>
    </form>
  )
}
