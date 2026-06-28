import { useMemo, useState } from 'react';
import { Hero } from '@/components/Hero';
import { FilterBar } from '@/components/FilterBar';
import { JobList } from '@/components/JobList';
import { useJobs } from '@/hooks/useJobs';
import { sourceLabel } from '@/lib/utils';

export function Dashboard() {
  const { jobs, exportedAt, loading, error } = useJobs();

  const [search,     setSearch]     = useState('');
  const [source,     setSource]     = useState('__all__');
  const [actionable, setActionable] = useState('__all__');
  const [sort,       setSort]       = useState('__all__');

  const sources = useMemo(
    () => [...new Set(jobs.map((j) => sourceLabel(j.source)))].sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = jobs.filter((j) => {
      if (q && !`${j.title} ${j.company}`.toLowerCase().includes(q)) return false;
      if (source !== '__all__' && sourceLabel(j.source) !== source)   return false;
      if (actionable === 'actionable' && !j.actionable)               return false;
      if (actionable === 'notified'   && !j.notified)                 return false;
      return true;
    });

    if (sort === 'score')   list = [...list].sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0));
    else if (sort === 'company') list = [...list].sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''));
    else list = [...list].sort((a, b) => new Date(b.first_seen_time).getTime() - new Date(a.first_seen_time).getTime());

    return list;
  }, [jobs, search, source, actionable, sort]);

  return (
    <div className="min-h-screen">
      <Hero jobs={jobs} exportedAt={exportedAt} />

      <main className="max-w-5xl mx-auto px-5 pt-5 pb-20 space-y-4">
        <FilterBar
          search={search}
          source={source}
          actionable={actionable}
          sort={sort}
          sources={sources}
          resultCount={filtered.length}
          onSearch={setSearch}
          onSource={setSource}
          onActionable={setActionable}
          onSort={setSort}
        />
        <JobList jobs={filtered} loading={loading} error={error} />
      </main>
    </div>
  );
}
