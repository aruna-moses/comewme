import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchActiveAds } from '../lib/ads'
import type { Ad } from '../lib/ads'
import { AD_SLOT_ASPECT } from '../lib/adSlot'

/** Shown when no paid ads are live yet, so the slot never looks broken. */
const HOUSE_AD: Ad = {
  id: 'house-advertise',
  advertiser_id: null,
  brand_name: "Come w' me",
  headline: 'Put your business in front of Lagos',
  cta_text: 'Advertise',
  destination_url: '/advertise',
  image_url: null,
  brand_color: '#FF9F1C',
  start_date: '',
  end_date: '',
  status: 'approved',
  admin_note: null,
  created_at: '',
  reviewed_at: null,
}

/** Black or white text on an arbitrary brand colour. */
function readableOn(hex: string): string {
  const raw = hex.replace('#', '').trim()
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const value = Number.parseInt(full, 16)
  if (full.length !== 6 || Number.isNaN(value)) return '#ffffff'
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.68 ? '#0B0B0F' : '#ffffff'
}

/**
 * The creative itself. `banner` is the edge-to-edge Discover slot; `card` keeps
 * the rounded look used in previews and the review queue.
 */
export function AdFace({ ad, variant = 'card' }: { ad: Ad; variant?: 'card' | 'banner' }) {
  const banner = variant === 'banner'
  const radius = banner ? '' : 'rounded-[10px]'
  const textColor = readableOn(ad.brand_color)

  const cta = (
    <span
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold leading-none"
      style={{ backgroundColor: ad.brand_color, color: textColor }}
    >
      {ad.cta_text || 'View'}
    </span>
  )

  if (ad.image_url) {
    return (
      <div className={`relative h-full w-full overflow-hidden ${radius}`}>
        <img
          src={ad.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
        <div className={`relative flex h-full items-center gap-3 ${banner ? 'px-4' : 'px-3'}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
              {ad.brand_name}
            </p>
            <p
              className={`mt-0.5 text-[16px] font-bold leading-tight text-white ${
                banner ? 'line-clamp-2' : 'truncate'
              }`}
            >
              {ad.headline}
            </p>
          </div>
          {cta}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex h-full w-full items-center gap-3 overflow-hidden ${radius} ${banner ? 'px-4' : 'px-3'}`}
      style={{ backgroundColor: `${ad.brand_color}14` }}
    >
      <span
        className="h-8 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: ad.brand_color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {ad.brand_name}
        </p>
        <p
          className={`mt-0.5 text-[16px] font-bold leading-tight text-ink ${
            banner ? 'line-clamp-2' : 'truncate'
          }`}
        >
          {ad.headline}
        </p>
      </div>
      {cta}
    </div>
  )
}

export default function AdCarousel() {
  const [liveAds, setLiveAds] = useState<Ad[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let active = true
    fetchActiveAds()
      .then((rows) => {
        if (active) setLiveAds(rows)
      })
      .catch(() => {
        if (active) setLiveAds([])
      })
    return () => {
      active = false
    }
  }, [])

  const ads = useMemo(() => (liveAds.length > 0 ? liveAds : [HOUSE_AD]), [liveAds])

  useEffect(() => {
    setIndex(0)
  }, [ads.length])

  useEffect(() => {
    if (ads.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % ads.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [ads])

  const current = ads[index] ?? HOUSE_AD
  const isExternal = /^https?:\/\//i.test(current.destination_url)
  const isInternal = current.destination_url.startsWith('/')

  const body = (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: String(AD_SLOT_ASPECT) }}>
      <AdFace ad={current} variant="banner" />
    </div>
  )

  return (
    /* Full-bleed: the sponsored strip runs from one edge of the app column to
       the other instead of sitting inside the feed gutter. */
    <div className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          Sponsored
        </span>
        {ads.length > 1 ? (
          <div className="flex items-center gap-1">
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                aria-label={`Show ad ${i + 1} of ${ads.length}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-amber' : 'w-1 bg-line'}`}
              />
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-semibold text-muted/70">Ad</span>
        )}
      </div>

      {isExternal ? (
        <a
          href={current.destination_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`${current.brand_name}: ${current.headline}`}
          className="block"
        >
          {body}
        </a>
      ) : isInternal ? (
        <Link
          to={current.destination_url}
          aria-label={`${current.brand_name}: ${current.headline}`}
          className="block"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  )
}
