import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Crop,
  ImagePlus,
  Loader2,
  Settings as SettingsIcon,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { daysBetween, normalizeDestinationUrl, submitAd } from '../lib/ads'
import type { Ad } from '../lib/ads'
import { AD_SLOT_ASPECT, lagosTodayISO } from '../lib/adSlot'
import { clearDraftGroup, usePersistedState } from '../lib/drafts'
import { AdFace } from '../components/AdCarousel'
import AdImageCropper from '../components/AdImageCropper'
import DraftNotice from '../components/DraftNotice'

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

const today = lagosTodayISO()
const DRAFT = 'advertise'

const EMPTY_FORM = {
  brandName: '',
  headline: '',
  ctaText: 'Book Now',
  destinationUrl: '',
  brandColor: '#FF9F1C',
  startDate: today,
  endDate: '',
}

export default function AdvertisePage() {
  const { profile } = useAuth()
  const [step, setStep] = usePersistedState(`${DRAFT}:step`, 1)
  const [form, setForm] = usePersistedState(`${DRAFT}:form`, EMPTY_FORM)
  const [imageData, setImageData] = usePersistedState<string | null>(`${DRAFT}:image`, null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [cropperSrc, setCropperSrc] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const imagePreview = imageData

  // Once submitted, drop the saved draft when the person leaves this screen.
  const doneRef = useRef(false)
  useEffect(() => {
    doneRef.current = done
  }, [done])
  useEffect(() => {
    return () => {
      if (doneRef.current) clearDraftGroup(DRAFT)
    }
  }, [])

  // A restored draft carries the cropped picture as a data URL — rebuild the File to upload.
  useEffect(() => {
    if (!imageData) {
      setImageFile(null)
      return
    }
    let active = true
    fetch(imageData)
      .then((res) => res.blob())
      .then((blob) => {
        if (active) {
          setImageFile(new File([blob], 'ad-picture.jpg', { type: blob.type || 'image/jpeg' }))
        }
      })
      .catch(() => {
        if (active) setImageFile(null)
      })
    return () => {
      active = false
    }
  }, [imageData])

  useEffect(() => {
    return () => {
      if (originalSrc?.startsWith('blob:')) URL.revokeObjectURL(originalSrc)
    }
  }, [originalSrc])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setDuration(days: number) {
    const start = form.startDate || today
    setForm((prev) => ({ ...prev, startDate: start, endDate: addDays(start, days - 1) }))
  }

  function pickFile(file: File | undefined) {
    setImageError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('That file is not an image. Please choose a JPG or PNG.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageError('That image is larger than 12MB. Please choose a smaller one.')
      return
    }
    if (originalSrc) URL.revokeObjectURL(originalSrc)
    const url = URL.createObjectURL(file)
    setOriginalSrc(url)
    setCropperSrc(url)
    if (fileRef.current) fileRef.current.value = ''
  }

  function applyCrop(file: File) {
    void fileToDataUrl(file)
      .then((dataUrl) => setImageData(dataUrl))
      .catch(() => setImageError('Could not read that picture. Please choose another one.'))
    setCropperSrc(null)
  }

  function clearImage() {
    if (originalSrc) URL.revokeObjectURL(originalSrc)
    setImageData(null)
    setImageFile(null)
    setOriginalSrc(null)
    setCropperSrc(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function resetDraft() {
    setStep(1)
    setForm(EMPTY_FORM)
    clearImage()
  }

  const step1Valid = form.brandName.trim().length > 0
  const destination = normalizeDestinationUrl(form.destinationUrl)
  const destinationInvalid = form.destinationUrl.trim().length > 0 && !destination
  const step2Valid = form.headline.trim().length > 0 && Boolean(destination)
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
      setSubmitError(
        destinationInvalid
          ? 'Check the link on step 2 — it needs to be a real web address.'
          : 'Please complete every step before submitting.',
      )
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
          destinationUrl: destination ?? form.destinationUrl,
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
            <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Submitted for review</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              We usually check within 24 hours and message you on WhatsApp if anything is missing.
            </p>

            <div className="mt-5 rounded-xl border border-line bg-canvas p-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Your ad
              </p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{form.brandName}</p>
              <p className="text-[14px] text-muted">{form.headline}</p>
              <p className="mt-1 text-[13px] text-muted">
                {form.startDate} → {form.endDate}
              </p>
              <span className="mt-2 inline-block rounded-full bg-sun/20 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-amber">
                In review
              </span>
            </div>

            <ol className="mt-4 space-y-2 text-left">
              {[
                'We check the picture, copy and link.',
                'We send a payment request on WhatsApp.',
                'It goes live on Discover the moment payment lands.',
              ].map((text, i) => (
                <li key={text} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-canvas">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>

            <Link to="/advertise/campaigns" className="btn-primary mt-5 w-full">
              View your ads
            </Link>
            <Link to="/" className="btn-ghost mt-2 w-full">
              Back to Discover
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
        <p className="mt-1 text-[15px] leading-relaxed text-muted">
          Reach Lagosians looking for something to do this week. Four short steps, about 3 minutes.
        </p>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Step {step} of {STEPS.length}
            </p>
            <p className="text-[13px] font-semibold text-ink">{STEPS[step - 1].hint}</p>
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
                className={`text-[12px] ${step === s.id ? 'font-bold text-ink' : 'text-muted'}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-[480px] px-5">
        <DraftNotice group={DRAFT} what="ad" onDiscard={resetDraft} />
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
              <p className="mt-1 text-[13px] text-muted">
                Shown in small letters above your headline. Keep it short.
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-ink">Ad picture</p>
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Optional
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Pick any picture — then drag to choose the exact strip that shows in the feed.
                Wider pictures work best.
              </p>

              <input
                ref={fileRef}
                id="ad-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {/* Exactly the shape of the feed slot */}
              <div
                className="mt-3 w-full overflow-hidden rounded-[10px] border border-dashed border-line bg-canvas"
                style={{ aspectRatio: String(AD_SLOT_ASPECT) }}
              >
                {imagePreview ? (
                  <img loading="lazy" decoding="async" src={imagePreview} alt="Ad crop preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center gap-2 text-muted">
                    <ImagePlus size={16} />
                    <span className="text-[13px]">Nothing selected yet</span>
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
                {originalSrc && (
                  <button
                    type="button"
                    onClick={() => setCropperSrc(originalSrc)}
                    className="btn-ghost btn-sm"
                  >
                    <Crop size={14} />
                    Adjust crop
                  </button>
                )}
                {imagePreview && (
                  <button type="button" onClick={clearImage} className="btn-ghost btn-sm">
                    <X size={14} />
                    Remove
                  </button>
                )}
              </div>

              {imageError && (
                <p role="alert" className="mt-2 text-[13px] font-medium text-alert">
                  {imageError}
                </p>
              )}
            </div>

            <div className="card p-4">
              <p className="text-[15px] font-semibold text-ink">Brand colour</p>
              <p className="mt-1 text-[13px] text-muted">
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
                <span className="text-[14px] font-medium text-ink">Use my own colour</span>
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-muted">{form.brandColor.toUpperCase()}</span>
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
                <p className="text-[13px] text-muted">One clear offer. This is the biggest text.</p>
                <p className="text-[12px] text-muted">{form.headline.length}/48</p>
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
              <p className="mt-1 text-[13px] text-muted">
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
                className={`field ${destinationInvalid ? 'border-alert focus:border-alert' : ''}`}
                placeholder="wa.me/2348012345678"
                value={form.destinationUrl}
                onChange={(e) => set('destinationUrl', e.target.value)}
                aria-invalid={destinationInvalid}
                aria-describedby="destination-help"
              />
              {destinationInvalid ? (
                <p role="alert" className="mt-1 text-[13px] font-medium text-alert">
                  That does not look like a web address. Try something like tasteoflagos.com or
                  wa.me/2348012345678.
                </p>
              ) : destination ? (
                <p className="mt-1 truncate text-[13px] text-verified">
                  Opens {destination}
                </p>
              ) : null}
              <p id="destination-help" className="mt-1 text-[13px] leading-relaxed text-muted">
                Your website, Instagram, booking page or a WhatsApp chat link. You can paste it
                without <span className="font-mono text-[12px]">https://</span> — we add it for you.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-4">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <CalendarDays size={15} className="text-amber" />
                When should it run?
              </p>

              <div className="mt-3 flex gap-2">
                {[7, 14, 30].map((days) => {
                  const active =
                    form.endDate === addDays(form.startDate || today, days - 1)
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDuration(days)}
                      className={`chip flex-1 justify-center ${active ? 'chip-active' : ''}`}
                      aria-pressed={active}
                    >
                      {days} days
                    </button>
                  )
                })}
              </div>

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
                <p className="mt-2 text-[13px] font-medium text-verified">
                  Runs for {daysBetween(form.startDate, form.endDate)} day
                  {daysBetween(form.startDate, form.endDate) === 1 ? '' : 's'}, then stops by
                  itself.
                </p>
              )}
              {form.endDate && form.endDate < form.startDate && (
                <p role="alert" className="mt-2 text-[13px] font-medium text-alert">
                  The end date must be on or after the start date.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#edd996] bg-[#fff4d1] p-3">
              <p className="text-[13px] leading-relaxed text-[#7a622f]">
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
                <p className="text-[15px] font-semibold text-ink">How it looks in the app</p>
                <p className="text-[13px] text-muted">
                  Real size, edge to edge at the top of Discover, pinned above the activity list.
                </p>
              </div>

              {/* Fake Discover screen — the real full-bleed strip */}
              <div className="bg-canvas p-3">
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="px-3 pb-2 pt-3">
                    <p className="font-display text-[15px] font-bold text-ink">COME W&apos; ME</p>
                  </div>
                  <div className="border-y border-line bg-canvas/95">
                    <div className="flex items-center justify-between px-4 pb-1 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                        Sponsored
                      </span>
                      <span className="text-[10px] font-semibold text-muted/70">Ad</span>
                    </div>
                    <div className="w-full overflow-hidden" style={{ aspectRatio: String(AD_SLOT_ASPECT) }}>
                      <AdFace ad={previewAd} variant="banner" />
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
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Summary
              </p>
              <dl className="mt-2 space-y-2 text-[14px]">
                <Row label="Brand" value={form.brandName} />
                <Row label="Headline" value={form.headline} />
                <Row label="Button" value={form.ctaText} />
                <Row label="Link" value={destination ?? form.destinationUrl} />
                <Row label="Colour" value={form.brandColor.toUpperCase()} />
                <Row label="Picture" value={imageFile ? imageFile.name : 'None'} />
                <Row label="Runs" value={`${form.startDate} → ${form.endDate}`} />
              </dl>
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl border border-alert/30 bg-alert/5 p-3 text-[14px] text-alert">
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

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-muted">
          <SettingsIcon size={12} />
          You can track status in Settings any time.
        </p>
      </div>

      {cropperSrc && (
        <AdImageCropper
          src={cropperSrc}
          onCancel={() => setCropperSrc(null)}
          onDone={applyCrop}
        />
      )}
    </div>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that picture.'))
    reader.readAsDataURL(file)
  })
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate text-right font-medium text-ink">{value || '—'}</dd>
    </div>
  )
}
