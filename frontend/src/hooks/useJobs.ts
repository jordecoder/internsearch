import { useEffect, useState } from 'react';
import type { Job, JobsData } from '@/types/job';

interface UseJobsReturn {
  jobs: Job[];
  exportedAt: string | null;
  loading: boolean;
  error: boolean;
}

export function useJobs(): UseJobsReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('./jobs.json')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<JobsData>;
      })
      .then((data) => {
        setJobs(data.jobs ?? []);
        setExportedAt(data.exported_at ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { jobs, exportedAt, loading, error };
}
