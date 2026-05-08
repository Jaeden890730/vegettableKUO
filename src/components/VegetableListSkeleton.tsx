import { Skeleton } from '@/components/ui/skeleton';

export function VegetableListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-3 w-8" />
      </div>
      {/* Grid skeleton - 2 columns matching actual layout */}
      <div className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-2.5 space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
