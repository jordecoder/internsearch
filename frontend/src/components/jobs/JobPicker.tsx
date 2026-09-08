import { useMemo, useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Search } from 'lucide-react';
import { MatchScore } from '@/components/jobs/MatchScore';
import { sourceLabel } from '@/lib/utils';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import type { Job } from '@/types/job';

interface JobPickerProps {
  /** The trigger element this dropdown anchors to — rendered as-is via Popover's asChild. */
  children: React.ReactNode;
  onSelect: (job: Job) => void;
  /** Jobs to hide from the list, e.g. ones already on the board. */
  excludeUrls?: Set<string>;
}

/**
 * Searchable dropdown for picking a job from the scraped listings (the same
 * data the Jobs dashboard shows), so pages that act on a specific job don't
 * need it re-entered by hand.
 */
export function JobPicker({ children, onSelect, excludeUrls }: JobPickerProps) {
  const { jobs } = useJobsQuery();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    let list = excludeUrls ? jobs.filter((j) => !excludeUrls.has(j.url)) : jobs;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => b.score.overall - a.score.overall).slice(0, 50);
  }, [jobs, excludeUrls, query]);

  const pick = (job: Job) => {
    onSelect(job);
    setOpen(false);
    setQuery('');
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => { setOpen(next); if (next) setTimeout(() => inputRef.current?.focus(), 0); }}
    >
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          className="z-50 w-[min(380px,90vw)] rounded-lg border border-border bg-popover shadow-lg data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your jobs…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {jobs.length === 0 ? 'No jobs loaded yet' : 'No matches'}
              </p>
            ) : (
              results.map((job) => (
                <button
                  key={job.stable_id ?? job.url}
                  onClick={() => pick(job)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.company} · {sourceLabel(job.source)}
                    </p>
                  </div>
                  <MatchScore score={job.score.overall} size="sm" />
                </button>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
