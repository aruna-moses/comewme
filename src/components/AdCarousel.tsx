import { useEffect, useMemo, useState } from 'react'
import { fetchActiveAds } from '../lib/ads'
import type { Ad } from '../lib/ads'

/** Shown when no paid ads are live yet, so the slot never looks broken. */
const HOUSE_AD: Ad = {
  id: 'house-apple',
  advertiser_id: null,
  brand_name: 'Apple',
  headline: 'iPhone',
  cta_text: 'Shop now',
  destination_url: 'https://www.apple.com',
  image_url: null,
  brand_color: '#1d1d1f',
  start_date: '',
  end_date: '',
  status: 'approved',
  admin_note: null,
  created_at: '',
  reviewed_at: null,
}

export function AdFace({ ad }: { ad: Ad }) {
  if (ad.image_url) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[10px]">
        <img
          src={ad.image_url}
          alt={ad.brand_name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70">
            {ad.brand_name}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[13px] font-bold leading-tight text-white">
            {ad.headline}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold" style={{ color: ad.brand_color }}>
            {ad.cta_text} →
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full w-full items-center gap-3 overflow-hidden rounded-[10px] px-3"
      style={{ backgroundColor: `${ad.brand_color}14` }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white"
        style={{ backgroundColor: ad.brand_color }}
        aria-hidden
      >
        {ad.brand_name.trim().charAt(0).toUpperCase() || 'A'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold leading-tight text-ink">{ad.brand_name}</p>
        <p className="truncate text-[10px] leading-tight text-muted">
          {ad.headline}
          {ad.cta_text ? ` · ${ad.cta_text}` : ''}
        </p>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white"
        style={{ backgroundColor: ad.brand_color }}
      >
        {ad.cta_text || 'View'}
      </span>
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
  const clickable = /^https?:\/\//i.test(current.destination_url)

  const body = (
    <div className="h-16 w-full">
      <AdFace ad={current} />
    </div>
  )

  return (
    <div className="sticky top-0 z-40 mx-5 mt-4 rounded-xl border border-line bg-white p-2.5 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
          Advertisement
        </span>
        {ads.length > 1 && (
          <div className="flex items-center gap-1">
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                aria-label={`Show ad ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1 rounded-full transition-all ${
                  i === index ? 'w-3.5 bg-amber' : 'w-1 bg-line'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {clickable ? (
        <a href={current.destination_url} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  )
}
