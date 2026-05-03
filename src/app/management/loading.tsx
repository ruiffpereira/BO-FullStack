export default function Loading() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  )
}
