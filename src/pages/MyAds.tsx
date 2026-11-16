import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Megaphone, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  AD_RUN_LABEL,
  adRunState,
  daysBetween,
  fetchMyAds,
  withdrawAd,
} from '../lib/ads'
import type { Ad, AdRunState } from '../lib/ads'
import { AD_SLOT_ASPECT } from '../lib/adSlot'
import { AdFace } from '../components/AdCarousel'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'

const STATE_STYLE: Record<AdRunState, string> = {
  live: 'bg-verified/15 text-verified',
  scheduled: 'bg-ink/5 text-ink',
  pending: 'bg-sun/25 text-amber',
  ended: 'bg-line text-muted',
  paused: 'bg-line text-muted',
  rejected: 'bg-alert/10 text-alert',
}

export default function MyAds() {
  const { profile } = useAuth()
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState<Ad | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setError(null)
    try {
      setAds(await fetchMyAds(profile.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your ads.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <Spinner />

  const live = ads.filter((ad) => adRunState(ad) === 'live').length

  return (
    <div className="min-h-screen px-5 pb-10 pt-12">
      <div className="mx-auto w-full max-w-[480px]">
        <Link to="/settings" className="mb-5 inline-flex items-center gap-2">
          <ArrowLeft size={18} className="text-muted" />
          <span className="text-sm font-semibold text-ink">Settings</span>
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-bold leading-tight text-ink">Your ads</h1>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              {ads.length === 0
                ? 'Ads you submit show up here with their live status.'
                : live > 0
                  ? `${live} running now · ${ads.length} in total`
                  : `${ads.length} ad${ads.length === 1 ? '' : 's'} submitted so far`}
            </p>
          </div>
          <Link
            to="/advertise"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink"
            aria-label="Create another ad"
          >
            <Plus size={18} />
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[14px] text-alert">
            {error}
          </p>
        )}

        {ads.length === 0 && !error ? (
          <div className="card mt-5 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sun/25 text-amber">
              <Megaphone size={22} />
            </div>
            <p className="mt-3 font-display text-[18px] font-bold text-ink">No ads yet</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              Put your business at the top of Discover. Four short steps, about three minutes.
            </p>
            <Link to="/advertise" className="btn-primary mt-4 w-full">
              Create an ad
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {ads.map((ad) => {
              const state = adRunState(ad)
              const days = daysBetween(ad.start_date, ad.end_date)
              return (
                <article key={ad.id} className="card overflow-hidden p-0">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{ad.brand_name}</p>
                      <p className="truncate text-[13px] text-muted">{ad.headline}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATE_STYLE[state]}`}
                    >
                      {AD_RUN_LABEL[state]}
                    </span>
                  </div>

                  <div className="px-4 pt-3">
                    <div
                      className="w-full overflow-hidden rounded-[10px] border border-line"
                      style={{ aspectRatio: String(AD_SLOT_ASPECT) }}
                    >
                      <AdFace ad={ad} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 px-4 py-3 text-[13px]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Runs</p>
                      <p className="mt-0.5 font-medium text-ink">
                        {shortDate(ad.start_date)} → {shortDate(ad.end_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {state === 'live' ? 'Days left' : 'Duration'}
                      </p>
                      <p className="mt-0.5 font-medium text-ink">
                        {state === 'live' ? `${daysLeft(ad.end_date)} of ${days}` : `${days} day${days === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Link</p>
                      <p className="mt-0.5 truncate font-medium text-ink">{ad.destination_url}</p>
                    </div>
                  </div>

                  {ad.admin_note && (
                    <p className="mx-4 mb-3 rounded-xl bg-canvas p-3 text-[13px] leading-relaxed text-muted">
                      <span className="font-semibold text-ink">Note from review:</span> {ad.admin_note}
                    </p>
                  )}

                  {state === 'pending' && (
                    <div className="border-t border-line px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] leading-relaxed text-muted">
                          We usually review within 24 hours.
                        </p>
                        <button
                          type="button"
                          className="shrink-0 text-[13px] font-semibold text-alert"
                          onClick={() => setWithdrawing(ad)}
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}

            <Link to="/advertise" className="btn-primary w-full">
              Create another ad
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {withdrawing && (
        <ConfirmDialog
          open
          destructive
          title={`Withdraw ${withdrawing.brand_name}?`}
          message="The submission is removed and will not be reviewed. You can create a new ad whenever you like."
          cancelLabel="Keep it"
          confirmLabel="Withdraw"
          busy={busy}
          onCancel={() => setWithdrawing(null)}
          onConfirm={() => {
            const target = withdrawing
            setWithdrawing(null)
            setBusy(true)
            void withdrawAd(target)
              .then(() => load())
              .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Could not withdraw that ad.'),
              )
              .finally(() => setBusy(false))
          }}
        />
      )}
    </div>
  )
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function daysLeft(end: string) {
  const today = new Date()
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(endDate.getTime())) return 0
  const ms = endDate.getTime() - new Date(today.toDateString()).getTime()
  return Math.max(0, Math.round(ms / 86_400_000) + 1)
}
