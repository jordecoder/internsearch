import { Skeleton } from '@/components/ui/skeleton';
import { JobCard } from '@/components/JobCard';
import type { Job } from '@/types/job';

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 space-y-2.5">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-8 flex-shrink-0" />
      </div>
    </div>
  );
}

interface JobListProps {
  jobs: Job[];
  loading: boolean;
  error: boolean;
}

export function JobList({ jobs, loading, error }: JobListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm font-medium text-foreground">Could not load job data</p>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
          Enable GitHub Pages under Settings → Pages → Branch: main, /docs,
          then wait for the next workflow run.
        </p>
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm font-medium text-foreground">No listings match your filters</p>
        <p className="mt-1 text-xs text-muted-foreground">Try widening your search</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job, i) => (
        <JobCard
          key={job.stable_id ?? job.url}
          job={job}
          style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
        />
      ))}
    </div>
  );
}
