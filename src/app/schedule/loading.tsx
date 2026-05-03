export default function ScheduleLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-slate-700" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-800" />
        ))}
      </div>
    </div>
  )
}
