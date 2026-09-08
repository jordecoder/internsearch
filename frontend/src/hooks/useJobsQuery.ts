import { useQuery } from '@tanstack/react-query';
import type { JobsData } from '@/types/job';

async function fetchJobs(): Promise<JobsData> {
  const r = await fetch('./jobs.json');
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export function useJobsQuery() {
  const query = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
    staleTime: 5 * 60_000,
  });

  return {
    jobs: query.data?.jobs ?? [],
    exportedAt: query.data?.exported_at ?? null,
    loading: query.isLoading,
    error: query.isError,
  };
}
