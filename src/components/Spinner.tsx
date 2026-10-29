export default function Spinner({ full = false }: { full?: boolean }) {
  const dot = (
    <span className="block h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-amber" />
  )
  if (!full) return <div className="flex justify-center py-8">{dot}</div>
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        {dot}
        <p className="font-display text-sm font-semibold text-muted">Come w' me</p>
      </div>
    </div>
  )
}
