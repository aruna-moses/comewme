import { initials } from '../lib/format'

interface Props {
  src?: string | null
  name: string
  size?: number
  className?: string
}

/** Avatar with an initials fallback, so a missing image never breaks a card. */
export default function Avatar({ src, name, size = 40, className = '' }: Props) {
  const style = { width: size, height: size }
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={style}
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full object-cover bg-line ring-1 ring-black/5 ${className}`}
      />
    )
  }
  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-sun/40 font-display font-bold text-ink ring-1 ring-black/5 ${className}`}
      aria-hidden
    >
      <span style={{ fontSize: Math.max(11, size * 0.36) }}>{initials(name)}</span>
    </div>
  )
}
