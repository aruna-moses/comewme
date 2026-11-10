import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Settings as SettingsIcon,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { submitAd } from '../lib/ads'
import type { Ad } from '../lib/ads'
import { AdFace } from '../components/AdCarousel'

const BRAND_COLORS = [
  '#FF9F1C', '#FFD93D', '#DC2626', '#16A34A', '#0B0B0F', '#3B82F6',
  '#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  '#7C3AED', '#0EA5E9', '#84CC16', '#F97316', '#DB2777', '#334155',
]

const STEPS = [
  { id: 1, label: 'Brand', hint: 'Who is advertising' },
  { id: 2, label: 'Ad content', hint: 'What people will see' },
  { id: 3, label: 'Schedule', hint: 'When it runs' },
  { id: 4, label: 'Preview', hint: 'Check and submit' },
]

const today = new Date().toISOString().slice(0, 10)

export default function AdvertisePage() {
  const { profile } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    brandName: '',
    headline: '',
    ctaText: 'Book Now',
    destinationUrl: '',
    brandColor: '#FF9F1C',
    startDate: today,
    endDate: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function pickFile(file: File | undefined) {
    setImageError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('That file is not an image. Please choose a JPG or PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('That image is larger than 5MB. Please choose a smaller one.')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const step1Valid = form.brandName.trim().length > 0
  const step2Valid = form.headline.trim().length > 0 && form.destinationUrl.trim().length > 0
  const step3Valid =
    form.startDate.length > 0 && form.endDate.length > 0 && form.endDate >= form.startDate
  const canSubmit = step1Valid && step2Valid && step3Valid

  async function handleSubmit() {
    setSubmitError(null)
    if (!profile?.id) {
      setSubmitError('You need to be signed in to submit an ad.')
      return
    }
    if (!canSubmit) {
      setSubmitError('Please complete every step before submitting.')
      return
    }
    setSubmitting(true)
    try {
      await submitAd(
        profile.id,
        {
          brandName: form.brandName,
          headline: form.headline,
          ctaText: form.ctaText,
          destinationUrl: form.destinationUrl,
          brandColor: form.brandColor,
          startDate: form.startDate,
          endDate: form.endDate,
        },
        imageFile,
      )
      setDone(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not submit your ad. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // What the live ad will look like, using the exact component the feed uses.
  const previewAd: Ad = {
    id: 'preview',
    advertiser_id: null,
    brand_name: form.brandName.trim() || 'Your brand',
    headline: form.headline.trim() || 'Your headline goes here',
    cta_text: form.ctaText,
    destination_url: form.destinationUrl,
    image_url: imagePreview,
    brand_color: form.brandColor,
    start_date: form.startDate,
    end_date: form.endDate,
    status: 'pending',
    admin_note: null,
    created_at: '',
    reviewed_at: null,
  }

  if (done) {
    return (
      <div className="min-h-screen px-5 pb-10 pt-12">
        <div className="mx-auto w-full max-w-[480px]">
          <div className="card p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verified/15">
              <CheckCircle2 size={28} className="text-verified" />
            </div>
            <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Ad submitted</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Your ad is waiting for review. We usually check within 24 hours and message you on
              WhatsApp if anything is missing.
            </p>
            <div className="mt-5 rounded-xl border border-line bg-canvas p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Your ad
              </p>
              <p className="mt-1 text-[13px] font-semibold text-ink">{form.brandName}</p>
              <p className="text-[12px] text-muted">{form.headline}</p>
              <p className="mt-1 text-[11px] text-muted">
                {form.startDate} → {form.endDate}
              </p>
              <span className="mt-2 inline-block rounded-full bg-sun/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                Pending review
              </span>
            </div>
            <Link to="/" className="btn-primary mt-5 w-full">
              Back to Discover
            </Link>
            <Link to="/settings" className="btn-ghost mt-2 w-full">
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-10 pt-12">
      <div className="mx-auto w-full max-w-[480px] px-5">
        <Link to="/settings" className="mb-5 inline-flex items-center gap-2">
          <ArrowLeft size={18} className="text-muted" />
          <span className="text-sm font-semibold text-ink">Back to Settings</span>
        </Link>

        <h1 className="font-display text-[24px] font-bold leading-tight text-ink">
          Advertise with Come w&apos; me
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Reach Lagosians looking for something to do this week. Four short steps, about 3 minutes.
        </p>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Step {step} of {STEPS.length}
            </p>
            <p className="text-[11px] font-semibold text-ink">{STEPS[step - 1].hint}</p>
          </div>
          <div className="mt-2 flex gap-1.5">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${step >= s.id ? 'bg-amber' : 'bg-line'}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            {STEPS.map((s) => (
              <span
                key={s.id}
                className={`text-[10px] ${step === s.id ? 'font-bold text-ink' : 'text-muted'}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-[480px] px-5">
        {step === 1 && (
          <div className="space-y-4">
            <div className="card p-4">
              <label className="label" htmlFor="brandName">
                Brand name
              </label>
              <input
                id="brandName"
                className="field"
                placeholder="e.g. Taste of Lagos"
                value={form.brandName}
                onChange={(e) => set('brandName', e.target.value)}
                maxLength={40}
              />
              <p className="mt-1 text-[11px] text-muted">
                Shown in small letters above your headline. Keep it short.
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink">Ad picture</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Optional
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Best size is <strong className="text-ink">1200 × 400px</strong> (wide). We crop from
                the centre to fit the strip, so keep the important part in the middle.
              </p>

              <input
                ref={fileRef}
                id="ad-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {/* Real-size crop preview — this is the actual shape of the feed slot */}
              <div className="mt-3 h-16 w-full overflow-hidden rounded-[10px] border border-dashed border-line bg-canvas">
                {imagePreview ? (
                  <img src={imagePreview} alt="Ad crop preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center gap-2 text-muted">
                    <ImagePlus size={16} />
                    <span className="text-[11px]">Nothing selected yet</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost btn-sm flex-1"
                >
                  <ImagePlus size={14} />
                  {imagePreview ? 'Change picture' : 'Choose picture'}
                </button>
                {imagePreview && (
                  <button type="button" onClick={clearImage} className="btn-ghost btn-sm">
                    <X size={14} />
                    Remove
                  </button>
                )}
              </div>

              {imageError && (
                <p role="alert" className="mt-2 text-[11px] font-medium text-alert">
                  {imageError}
                </p>
              )}
            </div>

            <div className="card p-4">
              <p className="text-[13px] font-semibold text-ink">Brand colour</p>
              <p className="mt-1 text-[11px] text-muted">
                Used on your call-to-action button and accent bar.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    onClick={() => set('brandColor', color)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                      form.brandColor.toLowerCase() === color.toLowerCase()
                        ? 'border-ink ring-2 ring-ink/20'
                        : 'border-black/10'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {form.brandColor.toLowerCase() === color.toLowerCase() && (
                      <Check size={14} className={color === '#FFD93D' || color === '#84CC16' ? 'text-ink' : 'text-white'} />
                    )}
                  </button>
                ))}
              </div>

              <label className="mt-3 flex items-center justify-between rounded-xl border border-line px-3 py-2">
                <span className="text-[12px] font-medium text-ink">Use my own colour</span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted">{form.brandColor.toUpperCase()}</span>
                  <input
                    type="color"
                    value={form.brandColor}
                    onChange={(e) => set('brandColor', e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent p-0.5"
                    aria-label="Pick a custom brand colour"
                  />
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="card p-4">
              <label className="label" htmlFor="headline">
                Headline
              </label>
              <input
                id="headline"
                className="field"
                placeholder="e.g. Weekend buffet — 2 for ₦15,000"
                value={form.headline}
                onChange={(e) => set('headline', e.target.value)}
                maxLength={48}
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-muted">One clear offer. This is the biggest text.</p>
                <p className="text-[10px] text-muted">{form.headline.length}/48</p>
              </div>
            </div>

            <div className="card p-4">
              <label className="label" htmlFor="ctaText">
                Button text
              </label>
              <select
                id="ctaText"
                className="field"
                value={form.ctaText}
                onChange={(e) => set('ctaText', e.target.value)}
              >
                <option value="Book Now">Book Now</option>
                <option value="Order Food">Order Food</option>
                <option value="Visit Website">Visit Website</option>
                <option value="Learn More">Learn More</option>
                <option value="Call Now">Call Now</option>
                <option value="Shop Now">Shop Now</option>
              </select>
              <p className="mt-1 text-[11px] text-muted">
                The small label on the button that people tap.
              </p>
            </div>

            <div className="card p-4">
              <label className="label" htmlFor="destinationUrl">
                Link people should land on
              </label>
              <input
                id="destinationUrl"
                type="url"
                inputMode="url"
                className="field"
                placeholder="https://wa.me/2348012345678"
                value={form.destinationUrl}
                onChange={(e) => set('destinationUrl', e.target.value)}
              />
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                This is where a tap on your ad takes people. It can be your website, Instagram,
                booking page, or a WhatsApp chat link
                (<span className="font-mono text-[10px]">https://wa.me/234…</span>). Without it the
                ad would lead nowhere, so it is required.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <CalendarDays size={15} className="text-amber" />
                When should it run?
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="startDate">
                    Start
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    className="field"
                    min={today}
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="endDate">
                    End
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    className="field"
                    min={form.startDate || today}
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                </div>
              </div>

              {form.startDate && form.endDate && form.endDate >= form.startDate && (
                <p className="mt-2 text-[11px] font-medium text-verified">
                  Runs for {daysBetween(form.startDate, form.endDate)} day
                  {daysBetween(form.startDate, form.endDate) === 1 ? '' : 's'}, then stops by
                  itself.
                </p>
              )}
              {form.endDate && form.endDate < form.startDate && (
                <p role="alert" className="mt-2 text-[11px] font-medium text-alert">
                  The end date must be on or after the start date.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#edd996] bg-[#fff4d1] p-3">
              <p className="text-[11px] leading-relaxed text-[#7a622f]">
                Nothing is charged automatically. After we approve your ad we send a payment
                request on WhatsApp, and it goes live the moment payment lands.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="card overflow-hidden p-0">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[13px] font-semibold text-ink">How it looks in the app</p>
                <p className="text-[11px] text-muted">
                  Real size, on the Discover feed, pinned above the activity list.
                </p>
              </div>

              {/* Fake Discover screen */}
              <div className="bg-canvas p-3">
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="px-3 pt-3">
                    <p className="font-display text-[13px] font-bold text-ink">COME W&apos; ME</p>
                  </div>
                  <div className="mt-2 rounded-xl border border-line bg-white p-2.5 mx-2">
                    <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Advertisement
                    </p>
                    <div className="h-16 w-full">
                      <AdFace ad={previewAd} />
                    </div>
                  </div>
                  <div className="space-y-1 px-3 py-3">
                    <div className="h-2.5 w-3/5 rounded bg-line" />
                    <div className="h-2 w-2/5 rounded bg-line" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Summary
              </p>
              <dl className="mt-2 space-y-2 text-[12px]">
                <Row label="Brand" value={form.brandName} />
                <Row label="Headline" value={form.headline} />
                <Row label="Button" value={form.ctaText} />
                <Row label="Link" value={form.destinationUrl} />
                <Row label="Colour" value={form.brandColor.toUpperCase()} />
                <Row label="Picture" value={imageFile ? imageFile.name : 'None'} />
                <Row label="Runs" value={`${form.startDate} → ${form.endDate}`} />
              </dl>
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl border border-alert/30 bg-alert/5 p-3 text-[12px] text-alert">
                {submitError}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-5 flex gap-3">
          {step > 1 && (
            <button type="button" className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={15} />
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : !step3Valid}
              onClick={() => setStep(step + 1)}
            >
              Next
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!canSubmit || submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit for review'
              )}
            </button>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <SettingsIcon size={12} />
          You can track status in Settings any time.
        </p>
      </div>
    </div>
  )
}

function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime()
  const b = new Date(`${end}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate text-right font-medium text-ink">{value || '—'}</dd>
    </div>
  )
}
