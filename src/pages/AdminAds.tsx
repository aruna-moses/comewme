import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Pause, X } from 'lucide-react'
import { isModerator } from '../lib/api'
import { fetchAdsForReview, reviewAd } from '../lib/ads'
import type { Ad } from '../lib/ads'
import { AdFace } from '../components/AdCarousel'
import { AD_SLOT_ASPECT } from '../lib/adSlot'
import Spinner from '../components/Spinner'

const STATUS_STYLE: Record<Ad['status'], string> = {
  pending: 'bg-sun/20 text-amber',
  approved: 'bg-verified/15 text-verified',
  rejected: 'bg-alert/10 text-alert',
  paused: 'bg-line text-muted',
}

export default function AdminAds() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [ads, setAds] = useState<Ad[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const ok = await isModerator()
      setAllowed(ok)
      if (!ok) return
      setAds(await fetchAdsForReview())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ads.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(ad: Ad, status: 'approved' | 'rejected' | 'paused') {
    setBusy(ad.id)
    setError(null)
    try {
      await reviewAd(ad.id, status, notes[ad.id]?.trim() || null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this ad.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="min-h-screen px-5 pb-10 pt-12">
      <div className="mx-auto w-full max-w-[480px]">
        <Link to="/admin/moderation" className="mb-5 inline-flex items-center gap-2">
          <ArrowLeft size={18} className="text-muted" />
          <span className="text-sm font-semibold text-ink">Moderation</span>
        </Link>

        <h1 className="font-display text-[24px] font-bold text-ink">Ad review</h1>
        <p className="mt-1 text-[13px] text-muted">
          Approve an ad and it appears in the Discover carousel during its run dates.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[12px] text-alert">
            {error}
          </p>
        )}

        {allowed === false && (
          <p className="mt-6 rounded-xl border border-line bg-canvas p-4 text-[12px] text-muted">
            This page is for moderators only.
          </p>
        )}

        {allowed && ads.length === 0 && (
          <p className="mt-6 rounded-xl border border-line bg-canvas p-4 text-[12px] text-muted">
            No ad submissions yet.
          </p>
        )}

        <div className="mt-4 space-y-4">
          {allowed &&
            ads.map((ad) => (
              <div key={ad.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{ad.brand_name}</p>
                    <p className="truncate text-[12px] text-muted">{ad.headline}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[ad.status]}`}
                  >
                    {ad.status}
                  </span>
                </div>

                <div className="mt-3 w-full overflow-hidden rounded-[10px]" style={{ aspectRatio: String(AD_SLOT_ASPECT) }}>
                  <AdFace ad={ad} />
                </div>

                <dl className="mt-3 space-y-1 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Button</dt>
                    <dd className="font-medium text-ink">{ad.cta_text}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Link</dt>
                    <dd className="truncate font-medium text-ink">{ad.destination_url}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Runs</dt>
                    <dd className="font-medium text-ink">
                      {ad.start_date} → {ad.end_date}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Sent</dt>
                    <dd className="font-medium text-ink">
                      {new Date(ad.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </dd>
                  </div>
                </dl>

                {ad.admin_note && (
                  <p className="mt-2 rounded-lg bg-canvas p-2 text-[11px] text-muted">
                    Note: {ad.admin_note}
                  </p>
                )}

                <input
                  className="field mt-3 py-2 text-[12px]"
                  placeholder="Optional note to the advertiser"
                  value={notes[ad.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [ad.id]: e.target.value }))}
                />

                <div className="mt-3 flex gap-2">
                  {ad.status !== 'approved' && (
                    <button
                      type="button"
                      className="btn-primary btn-sm flex-1"
                      disabled={busy === ad.id}
                      onClick={() => void act(ad, 'approved')}
                    >
                      <Check size={14} />
                      Approve
                    </button>
                  )}
                  {ad.status === 'approved' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm flex-1"
                      disabled={busy === ad.id}
                      onClick={() => void act(ad, 'paused')}
                    >
                      <Pause size={14} />
                      Pause
                    </button>
                  )}
                  {ad.status !== 'rejected' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm flex-1 text-alert"
                      disabled={busy === ad.id}
                      onClick={() => void act(ad, 'rejected')}
                    >
                      <X size={14} />
                      Reject
                    </button>
                  )}
                </div>

                {ad.image_url && (
                  <a
                    href={ad.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-center text-[11px] font-semibold text-amber"
                  >
                    Open full picture
                  </a>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
