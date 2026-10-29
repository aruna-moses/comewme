import type { VerificationStatus } from '../types'

export function VerifiedBadge({ status }: { status?: VerificationStatus }) {
  if (status !== 'verified') return null
  return (
    <span
      className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-verified"
      title="Verified human"
      aria-label="Verified human"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
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
