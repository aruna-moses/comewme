import type { VerificationStatus } from '../types'

export function VerifiedBadge({ status, size = 15 }: { status?: VerificationStatus; size?: number }) {
  if (status !== 'verified') return null
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-verified"
      style={{ width: size, height: size }}
      title="Selfie verified"
      aria-label="Selfie verified"
    >
      <svg width={Math.max(8, Math.round(size * 0.62))} height={Math.max(8, Math.round(size * 0.62))} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function TrustPill({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Newcomer: 'bg-line text-muted',
    Explorer: 'bg-sun/30 text-amber-900',
    Regular: 'bg-sun/50 text-ink',
    Trusted: 'bg-ink text-sun',
  }
  return (
    <span className={`pill ${styles[level] ?? 'bg-line text-muted'}`}>{level}</span>
  )
}
