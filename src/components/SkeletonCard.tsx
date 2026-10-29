export default function SkeletonCard() {
  return (
    <div className="card p-4">
      <div className="skeleton h-6 w-24 rounded-full" />
      <div className="skeleton mt-3 h-5 w-11/12" />
      <div className="skeleton mt-2 h-5 w-7/12" />
      <div className="skeleton mt-3 h-3.5 w-5/12" />
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="skeleton h-7 w-7 rounded-full" />
          <div className="skeleton h-3.5 w-24" />
        </div>
        <div className="skeleton h-3.5 w-12" />
      </div>
    </div>
  )
}
