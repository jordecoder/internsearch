import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, TrendingUp, Bookmark, CheckCircle2, CalendarClock } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { FilterBar, DEFAULT_FILTERS, type JobFilters } from '@/components/jobs/FilterBar';
import { JobCard } from '@/components/jobs/JobCard';
import { JobDetailPanel } from '@/components/jobs/JobDetailPanel';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import { useAuth } from '@/hooks/useAuth';
import { useBoardQuery, useUpsertBoardEntry } from '@/hooks/useBoardQuery';
import { sourceLabel, relativeTime } from '@/lib/utils';
import { roleFamily } from '@/lib/roleFamily';
import type { Job } from '@/types/job';

const DAY_MS = 86_400_000;

function matchesDate(job: Job, bucket: string): boolean {
  if (bucket === '__all__') return true;
  const seen = new Date(job.first_seen_time).getTime();
  const age = Date.now() - seen;
  if (bucket === 'today') return age < DAY_MS;
  if (bucket === '3d') return age < 3 * DAY_MS;
  if (bucket === '7d') return age < 7 * DAY_MS;
  return true;
}

export function Dashboard() {
  const { jobs, exportedAt, loading, error } = useJobsQuery();
  const { username } = useAuth();
  const { data: board } = useBoardQuery(!!username);
  const upsert = useUpsertBoardEntry();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  // Deep link from the command menu (?job=<stable_id>)
  useEffect(() => {
    const jobId = searchParams.get('job');
    if (jobId && jobs.length) {
      const found = jobs.find((j) => j.stable_id === jobId);
      if (found) setActiveJob(found);
    }
  }, [searchParams, jobs]);

  const closeDetail = () => {
    setActiveJob(null);
    if (searchParams.has('job')) {
      searchParams.delete('job');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const categories = useMemo(() => [...new Set(jobs.map((j) => roleFamily(j.title)))].sort(), [jobs]);
  const companies = useMemo(() => [...new Set(jobs.map((j) => j.company))].sort(), [jobs]);
  const sources = useMemo(() => [...new Set(jobs.map((j) => sourceLabel(j.source)))].sort(), [jobs]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let list = jobs.filter((j) => {
      if (q && !`${j.title} ${j.company}`.toLowerCase().includes(q)) return false;
      if (filters.category !== '__all__' && roleFamily(j.title) !== filters.category) return false;
      if (filters.company !== '__all__' && j.company !== filters.company) return false;
      if (filters.source !== '__all__' && sourceLabel(j.source) !== filters.source) return false;
      if (filters.minScore !== '__all__' && j.score.overall < Number(filters.minScore)) return false;
      if (!matchesDate(j, filters.datePosted)) return false;
      return true;
    });

    if (filters.sort === 'score') list = [...list].sort((a, b) => b.score.overall - a.score.overall);
    else if (filters.sort === 'company') list = [...list].sort((a, b) => a.company.localeCompare(b.company));
    else list = [...list].sort((a, b) => new Date(b.first_seen_time).getTime() - new Date(a.first_seen_time).getTime());

    return list;
  }, [jobs, filters]);

  const stats = useMemo(() => {
    const newToday = jobs.filter((j) => Date.now() - new Date(j.first_seen_time).getTime() < DAY_MS).length;
    const highMatches = jobs.filter((j) => j.score.overall >= 85).length;
    const savedCount = Object.values(board ?? {}).filter((e) => e.status !== 'skipped').length;
    const appliedCount = Object.values(board ?? {}).filter((e) => ['applied', 'interviewing', 'offer'].includes(e.status)).length;
    return { newToday, highMatches, savedCount, appliedCount };
  }, [jobs, board]);

  const handleSave = (job: Job) => {
    if (!username) { navigate('/login'); return; }
    const current = board?.[job.url]?.status;
    const status = current && current !== 'skipped' ? current : 'found';
    upsert.mutate({ url: job.url, status, title: job.title, company: job.company });
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-6 pb-20">
      <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            Your internship search
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Singapore tech internships, discovered and scored daily.</p>
        </div>
        {exportedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Updated {relativeTime(exportedAt)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        <StatCard label="New today" value={stats.newToday} icon={Sparkles} />
        <StatCard label="High matches" value={stats.highMatches} icon={TrendingUp} sub="85%+ fit" />
        <StatCard label="Saved" value={stats.savedCount} icon={Bookmark} />
        <StatCard label="Applied" value={stats.appliedCount} icon={CheckCircle2} />
      </div>

      <div className="mb-4">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
          companies={companies}
          sources={sources}
          resultCount={filtered.length}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)}
        </div>
      ) : error ? (
        <EmptyState
          icon={Sparkles}
          title="Could not load job data"
          description="Enable GitHub Pages under Settings → Pages → Branch: main, /docs, then wait for the next workflow run."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Sparkles} title="No listings match your filters" description="Try widening your search or resetting filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filtered.map((job, i) => (
            <JobCard
              key={job.stable_id ?? job.url}
              job={job}
              saved={board?.[job.url]?.status}
              onOpen={setActiveJob}
              onSave={handleSave}
              style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
            />
          ))}
        </div>
      )}

      <JobDetailPanel job={activeJob} onClose={closeDetail} savedStatus={activeJob ? board?.[activeJob.url]?.status : undefined} />
    </div>
  );
}
