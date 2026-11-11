import { ExternalLink, MapPin, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import type { RecentReview } from '../lib/moderation'
import { supabase } from '../lib/supabase'

const SEVERITY_LABEL: Record<string, string> = {
  warning: 'a warning',
  suspension_24h: 'a 24-hour suspension',
  suspension_7d: 'a 7-day suspension',
  suspension_30d: 'a 30-day suspension',
  permanent_ban: 'a permanent ban',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export default function ReviewDetailSheet({
  item,
  onClose,
}: {
  item: RecentReview | null
  onClose: () => void
}) {
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSelfieUrl(null)
    if (item?.kind === 'verification' && item.detail?.selfie_path) {
      supabase.storage
        .from('verifications')
        .createSignedUrl(item.detail.selfie_path, 60 * 60)
        .then(({ data }) => {
          if (active) setSelfieUrl(data?.signedUrl ?? null)
        })
    }
    return () => {
      active = false
    }
  }, [item?.kind, item?.detail?.selfie_path])

  if (!item) return null

  const d = item.detail ?? ({} as NonNullable<RecentReview['detail']>)
  const who = item.display_name || 'Member'
  const handle = item.username ? ` @${item.username}` : ''

  return (
    <Sheet open onClose={onClose} title="What happened">
      <div className="space-y-4 px-1 pb-4 pt-1">
        <div className="rounded-xl border border-line bg-canvas p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {item.kind === 'sos' ? 'SOS Alert' : item.kind === 'report' ? 'Report' : item.kind === 'appeal' ? 'Appeal' : item.kind === 'ad' ? 'Ad' : 'Verification'}
          </p>
          <p className="mt-1 text-[15px] font-bold text-ink">{item.title}</p>
          <p className="mt-1 text-[12px] text-muted">
            {who}
            {handle} · {timeAgo(item.reviewed_at)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber ring-1 ring-line">
            {item.status.toUpperCase()}
          </p>
        </div>

        {(() => {
          const related =
            item.related_kind === 'task' && item.related_id
              ? { label: 'Open activity', href: `/task/${item.related_id}` }
              : item.related_kind === 'profile' && item.related_id
                ? { label: 'Open member profile', href: `/profile/${item.related_id}` }
                : item.related_kind === 'admin_ads'
                  ? { label: 'Open ad review', href: '/admin/ads' }
                  : null
          return related ? (
            <a
              href={related.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-semibold text-ink transition hover:border-amber/40 hover:text-amber"
            >
              {related.label}
              <ExternalLink size={12} aria-hidden />
            </a>
          ) : null
        })()}

        {/* SOS detail */}
        {item.kind === 'sos' && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
              Where it happened
            </p>
            <p className="text-[13px] text-ink">
              {d.location_address || (d.location_lat && d.location_lng ? `Location (${d.location_lat.toFixed(5)}, ${d.location_lng.toFixed(5)})` : 'No location captured')}
            </p>
            {d.location_lat && d.location_lng && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${d.location_lat},${d.location_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-amber"
              >
                <MapPin size={13} />
                Open on map
                <ExternalLink size={11} />
              </a>
            )}
            {d.task_title && (
              <p className="text-[12px] text-muted">In activity: <strong className="text-ink">{d.task_title}</strong></p>
            )}
            {d.media_url && (
              <a href={d.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber">
                {d.media_type === 'video' ? 'Open video' : 'Open photo'}
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Report detail */}
        {item.kind === 'report' && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">What was reported</p>
            <p className="text-[13px] leading-relaxed text-ink">{d.description || '—'}</p>
            <p className="text-[12px] text-muted">
              Severity: <strong className="text-ink">{SEVERITY_LABEL[d.severity ?? ''] ?? d.severity ?? '—'}</strong>
              {d.reported_by && <> · Reported by {d.reported_by}</>}
            </p>
            {d.action_taken && (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">What you did</p>
                <p className="rounded-xl bg-canvas p-3 text-[13px] text-ink">{d.action_taken}</p>
              </>
            )}
          </div>
        )}

        {/* Appeal detail */}
        {item.kind === 'appeal' && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Original report</p>
            <p className="text-[13px] leading-relaxed text-ink">{d.violation_description || '—'}</p>

            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Appeal letter</p>
            <p className="rounded-xl bg-canvas p-3 text-[13px] leading-relaxed text-ink">{d.appeal_reason || '—'}</p>

            {d.admin_response && (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Your response</p>
                <p className="text-[13px] text-ink">{d.admin_response}</p>
              </>
            )}
          </div>
        )}

        {/* Ad detail */}
        {item.kind === 'ad' && (
          <div className="space-y-2">
            {d.image_url && (
              <img src={d.image_url} alt={d.brand_name ?? 'Ad'} className="h-36 w-full rounded-xl object-cover" loading="lazy" />
            )}
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl bg-canvas p-2">
                <p className="text-[10px] font-semibold uppercase text-muted">Brand</p>
                <p className="mt-0.5 font-semibold text-ink">{d.brand_name ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-canvas p-2">
                <p className="text-[10px] font-semibold uppercase text-muted">Schedule</p>
                <p className="mt-0.5 text-ink">
                  {d.start_date ?? ''}{d.start_date && d.end_date ? ' → ' : ''}{d.end_date ?? ''}
                </p>
              </div>
              <div className="rounded-xl bg-canvas p-2">
                <p className="text-[10px] font-semibold uppercase text-muted">Button</p>
                <p className="mt-0.5 text-ink">{d.cta_text ?? '—'}</p>
              </div>
              <a className="rounded-xl bg-canvas p-2 transition hover:bg-line" href={d.destination_url ?? undefined} target="_blank" rel="noreferrer">
                <p className="text-[10px] font-semibold uppercase text-muted">Link</p>
                <p className="mt-0.5 truncate font-semibold text-amber">{d.destination_url?.replace(/^https?:\/\//, '') ?? '—'}</p>
              </a>
            </div>
            {d.admin_response && (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Your note to advertiser</p>
                <p className="text-[13px] text-ink">{d.admin_response}</p>
              </>
            )}
          </div>
        )}

        {/* Verification detail */}
        {item.kind === 'verification' && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Selfie vs profile photo</p>
            <div className="grid grid-cols-2 gap-2">
              <figure className="overflow-hidden rounded-xl border border-line">
                <p className="border-b border-line bg-white px-2 py-1.5 text-[10px] font-semibold uppercase text-muted">Profile photo</p>
                {d.avatar_url ? (
                  <img src={d.avatar_url} alt="Profile" className="h-36 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-36 items-center justify-center text-[11px] text-muted">None</div>
                )}
              </figure>
              <figure className="overflow-hidden rounded-xl border border-line">
                <p className="border-b border-line bg-white px-2 py-1.5 text-[10px] font-semibold uppercase text-muted">Selfie</p>
                {selfieUrl ? (
                  <img src={selfieUrl} alt="Selfie" className="h-36 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-36 items-center justify-center text-[11px] text-muted">Loading…</div>
                )}
              </figure>
            </div>
          </div>
        )}

        {item.note && (
          <>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Your note</p>
            <p className="rounded-xl bg-canvas p-3 text-[13px] leading-relaxed text-ink">{item.note}</p>
          </>
        )}

        <p className="text-[11px] text-muted">
          <ShieldAlert size={11} className="mr-1 inline align-text-bottom text-amber" aria-hidden />
          This item is marked <strong className="text-ink">{item.status.toUpperCase()}</strong> and is locked — use the SOS or Reports sections to act on new information.
        </p>
      </div>
    </Sheet>
  )
}
