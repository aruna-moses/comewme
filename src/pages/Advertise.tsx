import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle, Image, Play, Send, X } from 'lucide-react'

export default function AdvertisePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    brandName: '',
    logoUrl: '',
    headline: '',
    ctaText: 'Book Now',
    destinationUrl: '',
    brandColor: '#FF9F1C',
    startDate: '',
    endDate: '',
    paymentProof: '',
  })
  const [previewOpen, setPreviewOpen] = useState(false)

  const steps = [
    { id: 1, label: 'Brand Details' },
    { id: 2, label: 'Ad Content' },
    { id: 3, label: 'Schedule' },
    { id: 4, label: 'Review & Submit' },
  ]

  const next = () => {
    if (step < 4) setStep(step + 1)
  }
  const prev = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPreviewOpen(false)
    // In production: submit to your admin dashboard for review
    alert(
      `Ad submitted for review!\n\nBrand: ${form.brandName}\nHeadline: ${form.headline}\nStarts: ${form.startDate}\nEnds: ${form.endDate}\n\nAn admin will review and approve it before it appears at the top of Discover.`
    )
    navigate('/settings')
  }

  const isLastStep = step === 4
  const isFirstStep = step === 1

  return (
    <div className="min-h-screen px-5 pb-10 pt-12 flex flex-col">
      {/* Header */}
      <div className="mx-auto w-full max-w-[480px]">
        <Link to="/settings" className="mb-6 flex items-center gap-2 cursor-pointer">
          <ArrowLeft size={18} className="text-muted" />
          <span className="text-sm font-semibold text-ink">Back to Settings</span>
        </Link>

        <h1 className="font-display text-[26px] font-bold leading-tight text-ink mb-1">
          Advertise with Come w' me
        </h1>
        <p className="text-[13px] text-muted">
          Reach thousands of people looking for things to do in Lagos.
        </p>

        {/* Progress steps */}
        <div className="mt-6 flex gap-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 transition-colors ${
                step >= s.id
                  ? 'text-ink font-semibold'
                  : 'text-muted font-medium'
              }`}
            >
              <span className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                step >= s.id ? 'bg-sun text-ink border border-sun' : 'bg-line text-muted border border-line'
              }`}>
                {s.id}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="mx-auto w-full max-w-[480px] flex-1 overflow-y-auto pb-8">
        {step === 1 && (
          <div className="space-y-5">
            <div className="card p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-3">
                Brand Information
              </p>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="brandName">
                    Brand Name
                  </label>
                  <input
                    id="brandName"
                    className="field"
                    placeholder="e.g. Taste of Lagos"
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  />
                  <p className="text-[11px] text-muted">
                    This is the name people will see in your ad.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="logoUrl">
                    Brand Logo or Photo
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="logoUrl"
                      type="text"
                      className="field flex-1"
                      placeholder="https://yourbrand.com/logo.png"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        // In real app: open image picker
                        setForm({ ...form, logoUrl: 'https://via.placeholder.com/150' })
                      }}
                    >
                      Pick Image
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">
                    Upload your logo or a photo that represents your brand.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="brandColor">
                    Brand Color
                  </label>
                  <div className="flex gap-2">
                    {['#FF9F1C', '#FFD93D', '#DC2626', '#16A34A', '#0B0B0F', '#3B82F6'].map(
                      (color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm({ ...form, brandColor: color })}
                          className={`h-8 w-8 rounded-full border-2 ${
                            form.brandColor === color ? 'ring-2 ring-ink' : 'border-transparent'
                          } bg-[${color}]`}
                        />
                      )
                    )}
                  </div>
                  <p className="text-[11px] text-muted">
                    Choose your brand color for the ad card border.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" className="btn-ghost flex-1" disabled>
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={next}
                disabled={!form.brandName.trim()}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="card p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-3">
                Ad Content
              </p>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="headline">
                    Headline
                  </label>
                  <input
                    id="headline"
                    className="field"
                    placeholder="e.g. Buffet Deal This Weekend"
                    value={form.headline}
                    onChange={(e) => setForm({ ...form, headline: e.target.value })}
                    maxLength={60}
                  />
                  <p className="text-[11px] text-muted">
                    Short and catchy — this is what grabs attention.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="ctaText">
                    Call-to-Action Button Text
                  </label>
                  <select
                    id="ctaText"
                    className="field"
                    value={form.ctaText}
                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                  >
                    <option value="Book Now">Book Now</option>
                    <option value="Order Food">Order Food</option>
                    <option value="Visit Website">Visit Website</option>
                    <option value="Learn More">Learn More</option>
                    <option value="Call Now">Call Now</option>
                  </select>
                  <p className="text-[11px] text-muted">
                    What people click to take action.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="destinationUrl">
                    Where should people go after clicking?
                  </label>
                  <input
                    id="destinationUrl"
                    type="url"
                    className="field"
                    placeholder="https://yourwebsite.com or https://wa.me/2348012345678"
                    value={form.destinationUrl}
                    onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
                  />
                  <p className="text-[11px] text-muted">
                    Your website, WhatsApp, Instagram, or reservation link.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={prev}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={next}
                disabled={!form.headline.trim() || !form.destinationUrl.trim()}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="card p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-3">
                Schedule
              </p>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="startDate">
                    Start Date
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    className="field"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="endDate">
                    End Date
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    className="field"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  <p className="text-[11px] text-muted">
                    Your ad will show from start to end date, then stop automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={prev}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={next}
                disabled={!form.startDate || !form.endDate}
              >
                Review & Submit
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="card p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-3">
                Preview — How Your Ad Will Look
              </p>
              <p className="text-[12px] text-muted mb-4">
                This is exactly how your ad will appear at the top of the Discover feed.
              </p>

              {/* Ad Preview */}
              <div className="w-full h-24 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-center overflow-hidden relative p-2">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#1d1d1f]">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="brand" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[#cbd5e1]" />
                  )}
                  <div className="text-center">
                    <p className="text-[12px] font-bold text-ink">{form.headline}</p>
                    <p className="text-[9px] text-[#86868b]">{form.ctaText}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-lg border border-[#f3f4f6] bg-[#f9fafb]">
                <p className="text-[11px] font-semibold text-[#6b7280] uppercase mb-2">
                  Summary
                </p>
                <div className="space-y-2 text-[12px] text-ink/80">
                  <div className="flex justify-between">
                    <span>Brand:</span>
                    <span className="font-medium">{form.brandName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Headline:</span>
                    <span className="font-medium">{form.headline}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Starts:</span>
                    <span className="font-medium">{form.startDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ends:</span>
                    <span className="font-medium">{form.endDate}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={prev}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => setPreviewOpen(true)}
              >
                Submit for Review
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Confirm Submission</h2>
              <button
                type="button"
                className="p-2 text-muted hover:text-ink"
                onClick={() => setPreviewOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-sun/20 flex items-center justify-center shrink-0">
                  <Send size={16} className="text-amber" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink">Submit your ad for review?</p>
                  <p className="text-[12px] text-muted">
                    An admin will review your ad before it appears at the top of Discover.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-[12px] text-ink/80">
                <div className="flex justify-between">
                  <span>Brand:</span>
                  <span className="font-medium">{form.brandName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Headline:</span>
                  <span className="font-medium">{form.headline}</span>
                </div>
                <div className="flex justify-between">
                  <span>Schedule:</span>
                  <span className="font-medium">{form.startDate} → {form.endDate}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => setPreviewOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={handleSubmit}
                >
                  Submit for Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}