import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, SearchX } from 'lucide-react';
import { FilterBar, DEFAULT_FILTERS, type JobFilters } from '@/components/jobs/FilterBar';
import { JobRow } from '@/components/jobs/JobCard';
import { JobDetailPanel } from '@/components/jobs/JobDetailPanel';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/motion';
import { TopMatchTile, PipelineTile, MetricTile } from '@/components/dashboard/Tiles';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import { useAuth } from '@/hooks/useAuth';
import { useBoardQuery, useUpsertBoardEntry } from '@/hooks/useBoardQuery';
import { sourceLabel, relativeTime } from '@/lib/utils';
import { roleFamily } from '@/lib/roleFamily';
import type { Job } from '@/types/job';

const DAY_MS = 86_400_000;

function matchesDate(job: Job, bucket: string): boolean {
  if (bucket === '__all__') return true;
  const age = Date.now() - new Date(job.first_seen_time).getTime();
  if (bucket === 'today') return age < DAY_MS;
  if (bucket === '3d') return age < 3 * DAY_MS;
  if (bucket === '7d') return age < 7 * DAY_MS;
  return true;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Group the visible list the way the current sort reads best. */
function groupJobs(list: Job[], sort: string): { label: string; jobs: Job[] }[] {
  if (sort === 'score') {
    const bands = [
      { label: 'Good fit or better', test: (j: Job) => j.score.overall >= 70 },
      { label: 'Worth a look', test: (j: Job) => j.score.overall >= 55 && j.score.overall < 70 },
      { label: 'Long shots', test: (j: Job) => j.score.overall < 55 },
    ];
    return bands.map((b) => ({ label: b.label, jobs: list.filter(b.test) })).filter((g) => g.jobs.length);
  }
  if (sort === 'newest') {
    const age = (j: Job) => Date.now() - new Date(j.first_seen_time).getTime();
    const bands = [
      { label: 'Today', test: (j: Job) => age(j) < DAY_MS },
      { label: 'This week', test: (j: Job) => age(j) >= DAY_MS && age(j) < 7 * DAY_MS },
      { label: 'Earlier', test: (j: Job) => age(j) >= 7 * DAY_MS },
    ];
    return bands.map((b) => ({ label: b.label, jobs: list.filter(b.test) })).filter((g) => g.jobs.length);
  }
  return [{ label: 'A to Z', jobs: list }];
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

  const groups = useMemo(() => groupJobs(filtered, filters.sort), [filtered, filters.sort]);

  const stats = useMemo(() => {
    const week = jobs.filter((j) => Date.now() - new Date(j.first_seen_time).getTime() < 7 * DAY_MS).length;
    const goodFit = jobs.filter((j) => j.score.overall >= 70).length;
    const top = [...jobs].sort((a, b) => b.score.overall - a.score.overall)[0] ?? null;
    return { week, goodFit, top };
  }, [jobs]);

  const handleSave = (job: Job) => {
    if (!username) { navigate('/login'); return; }
    const current = board?.[job.url]?.status;
    const status = current && current !== 'skipped' ? current : 'found';
    upsert.mutate({ url: job.url, status, title: job.title, company: job.company });
  };

  const today = new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-28 sm:px-8">
      <PageHeader
        size="hero"
        eyebrow={
          <>
            <span>{today}</span>
            {exportedAt && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-hint" aria-hidden />
                  Updated {relativeTime(exportedAt)}
                </span>
              </>
            )}
          </>
        }
        title={[
          { text: `${greeting()}${username ? `, ${titleCase(username)}` : ''}.` },
          { text: loading ? ' Finding your next role.' : ` ${jobs.length} internships, ranked by how well they fit you.`, className: 'text-muted-foreground' },
        ]}
      />

      {/* Bento */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-[460px] rounded-[22px] lg:col-span-5" />
          <div className="grid gap-4 lg:col-span-7">
            <Skeleton className="h-[260px] rounded-[22px]" />
            <Skeleton className="h-[184px] rounded-[22px]" />
          </div>
        </div>
      ) : stats.top ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-label="Overview">
          <Reveal className="lg:col-span-5 lg:row-span-2">
            <TopMatchTile job={stats.top} saved={board?.[stats.top.url]?.status} onOpen={setActiveJob} onSave={handleSave} />
          </Reveal>
          <Reveal index={1} className="lg:col-span-7">
            <PipelineTile board={board} loggedIn={!!username} />
          </Reveal>
          <div className="grid grid-cols-2 gap-4 lg:col-span-7">
            <Reveal index={2}>
              <MetricTile label="New this week" value={stats.week} caption="First seen in the last 7 days" />
            </Reveal>
            <Reveal index={3}>
              <MetricTile label="Good fit or better" value={stats.goodFit} caption={`Scored 70% or higher, out of ${jobs.length}`} />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* Listings */}
      <section className="mt-16 sm:mt-24" aria-labelledby="listings-title">
        <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="listings-title" className="type-title text-foreground">All listings</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {filtered.length === jobs.length ? `${jobs.length} roles` : `${filtered.length} of ${jobs.length} roles`}
            </p>
          </div>
        </Reveal>

        <Reveal index={1} className="mb-8">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            categories={categories}
            companies={companies}
            sources={sources}
            resultCount={filtered.length}
          />
        </Reveal>

        {loading ? (
          <div className="tile overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-border/70 px-5 py-4 first:border-t-0">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Sparkles}
            title="Couldn't load job data"
            description="Enable GitHub Pages under Settings → Pages → Branch: main, /docs, then wait for the next workflow run."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nothing matches those filters"
            description="Try a broader search, or clear the filters to see every role."
            action={<Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>}
          />
        ) : (
          <div className="space-y-10">
            {groups.map((group, gi) => (
              <Reveal key={group.label} index={gi === 0 ? 2 : 0} as="section" aria-label={group.label}>
                <div className="mb-3 flex items-baseline justify-between px-1">
                  <h3 className="text-[15px] font-semibold tracking-[-0.012em] text-foreground">{group.label}</h3>
                  <span className="text-[13px] tabular-nums text-muted-foreground">{group.jobs.length}</span>
                </div>
                <div className="tile overflow-hidden">
                  {group.jobs.map((job, i) => (
                    <JobRow
                      key={job.stable_id ?? job.url}
                      job={job}
                      saved={board?.[job.url]?.status}
                      onOpen={setActiveJob}
                      onSave={handleSave}
                      divider={i > 0}
                    />
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <JobDetailPanel job={activeJob} onClose={closeDetail} savedStatus={activeJob ? board?.[activeJob.url]?.status : undefined} />
    </div>
  );
}
