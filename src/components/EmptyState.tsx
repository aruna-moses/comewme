import { Link } from 'react-router-dom'

export default function EmptyState({
  title,
  body,
  cta,
}: {
  title: string
  body: string
  cta?: { label: string; to: string }
}) {
  return (
    <div className="card mx-4 mt-6 flex flex-col items-center px-6 py-10 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 17.5 17 6.5M9.5 6.5h7.5V14"
            stroke="#0B0B0F"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[30ch] text-sm leading-relaxed text-muted">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-primary btn-sm mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  )
}
