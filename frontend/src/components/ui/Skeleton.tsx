
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function BoardCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="skeleton h-28 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="w-column shrink-0 rounded-surface bg-white/10 p-3 ring-1 ring-inset ring-white/10">
      <div className="skeleton mb-3 h-4 w-28 bg-white/15" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16 w-full rounded-control bg-white/10" />
        ))}
      </div>
    </div>
  );
}
