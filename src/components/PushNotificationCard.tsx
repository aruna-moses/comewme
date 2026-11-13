import { Bell, BellOff, Share2, Smartphone } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'

const STATUS_META: Record<string, { badge: string; tone: string; blurb: string } | null> = {
  enabled: { badge: 'Enabled', tone: 'bg-verified/15 text-verified', blurb: "You'll get a heads-up even when Come w' me is closed." },
  default: { badge: 'Off', tone: 'bg-line text-muted', blurb: 'Enable pop-ups outside the app — chat messages, join requests, reminders.' },
  denied: { badge: 'Blocked', tone: 'bg-alert/10 text-alert', blurb: 'Allow notifications in your browser settings, then come back and try again.' },
  unsupported: { badge: 'Unavailable', tone: 'bg-line text-muted', blurb: "This browser can't push notifications now — in-app alerts still work." },
  'needs-install': { badge: 'Install first', tone: 'bg-sun/20 text-amber', blurb: 'iPhone and iPad need the app on your home screen first.' },
  'not-configured': { badge: 'In setup', tone: 'bg-sun/20 text-amber', blurb: 'The team is wiring up Firebase now — in-app alerts keep working meanwhile.' },
}

export default function PushNotificationCard() {
  const { status, busy, error, phase, requestPermissionAndRegister, removePush } = usePushNotifications()
  const enabled = status === 'enabled'
  const needsInstall = status === 'needs-install'
  const meta = STATUS_META[status]

  return (
    <section className="card p-4" aria-labelledby="push-heading">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sun/20 text-amber">
          <Bell size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p id="push-heading" className="text-[13px] font-semibold">Push notifications</p>
            {meta && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${meta.tone}`}>
                {meta.badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {meta?.blurb ?? ''}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted" aria-hidden="true">
            <span>Permission: {typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'n/a'}</span>
            <span>Standalone: {typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches ? 'yes' : 'no'}</span>
          </div>

          {needsInstall ? (
            <div className="mt-2 rounded-2xl border border-line bg-canvas p-3 text-[11px] leading-relaxed text-muted">
              <p className="flex items-center gap-1.5 font-bold text-ink">
                <Smartphone size={13} aria-hidden />
                On your iPhone or iPad:
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                <li className="flex items-center gap-1.5"><span className="font-semibold">Tap the</span> <Share2 size={11} className="text-amber" aria-hidden /> <span className="font-semibold">Share</span> button in Safari's bottom bar</li>
                <li>Scroll and tap <span className="font-semibold text-ink">“Add to Home Screen”</span></li>
                <li>Open <span className="font-semibold">Come w' me</span> from your home screen</li>
                <li>Then tap <span className="font-semibold">“Enable push notifications”</span> right here</li>
              </ol>
            </div>
          ) : null}

          {error && <p role="alert" className="mt-2 text-[11px] font-medium text-alert">{error}</p>}

          <div className="mt-2">
            {enabled ? (
              <button
                type="button"
                onClick={() => void removePush()}
                disabled={busy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[11px] font-semibold text-ink transition hover:border-alert/40 hover:text-alert disabled:opacity-50"
                aria-pressed={true}
              >
                {busy ? (
                  <span>Turning off…</span>
                ) : (
                  <>
                    <BellOff size={12} aria-hidden />
                    Turn off for this device
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void requestPermissionAndRegister()}
                disabled={busy || needsInstall}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-sun px-3 text-[11px] font-bold text-[#0B0B0F] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                aria-pressed={false}
              >
                {busy ? (
                  <span>
                    {phase === 'asking-permission'
                      ? 'Tap Allow in the popup…'
                      : phase === 'registering'
                        ? 'Finishing up…'
                        : 'Working…'}
                  </span>
                ) : (
                  <>
                    <Bell size={12} aria-hidden />
                    Enable push notifications
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
