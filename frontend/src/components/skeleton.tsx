/**
 * Skeleton loading components for async data states.
 * Used across dashboard, project pages, and reports.
 */

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-paper-sunken rounded-lg ${className ?? ""}`}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <SkeletonBlock className="w-9 h-9 rounded-lg" />
          <div className="space-y-1.5">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        </div>
      </div>
      <div className="mb-4">
        <SkeletonBlock className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-3 pt-3 border-t border-[#F6F4F4]">
        <SkeletonBlock className="h-3 w-12" />
        <SkeletonBlock className="h-3 w-12" />
        <SkeletonBlock className="h-3 w-16 ml-auto" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-32" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-8">
        <SkeletonBlock className="h-7 w-64 mb-3" />
        <SkeletonBlock className="h-4 w-full mb-2" />
        <SkeletonBlock className="h-4 w-5/6" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="h-3 w-full mb-2" />
          <SkeletonBlock className="h-3 w-4/5 mb-2" />
          <SkeletonBlock className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
