import { Bookmark, BookmarkCheck, ChevronRight } from 'lucide-react';
import { MatchScore } from '@/components/jobs/MatchScore';
import { StatusBadge } from '@/components/StatusBadge';
import { CompanyMonogram } from '@/components/CompanyMonogram';
import { cn, relativeTime, sourceLabel } from '@/lib/utils';
import { extractTags } from '@/lib/match';
import type { BoardEntryStatus, Job } from '@/types/job';

interface JobRowProps {
  job: Job;
  saved?: BoardEntryStatus;
  onOpen: (job: Job) => void;
  onSave: (job: Job) => void;
  /** Draw an inset hairline above this row (every row but the first in a group). */
  divider?: boolean;
}

/** One listing in an inset grouped list. The whole row opens the detail sheet. */
export function JobRow({ job, saved, onOpen, onSave, divider }: JobRowProps) {
  const time = relativeTime(job.posted_time ?? job.first_seen_time);
  const loc = (job.location ?? '').toLowerCase();
  const showLoc = job.location && loc !== 'singapore' && loc !== 'singapore, singapore';
  const tags = extractTags(job.title);
  const isNew = Date.now() - new Date(job.first_seen_time).getTime() < 86_400_000;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(job); }
      }}
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 px-4 py-4 sm:px-5',
        'transition-colors duration-160 ease-out hover:bg-foreground/[0.025] active:bg-foreground/[0.05]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      {divider && <span aria-hidden className="pointer-events-none absolute right-0 top-0 h-px bg-border/80 left-[76px] sm:left-[80px]" />}

      <CompanyMonogram name={job.company} size={44} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] text-muted-foreground">{job.company}</p>
          {isNew && (
            <span className="flex-shrink-0 text-[11px] font-semibold text-hint">New</span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.012em] text-foreground">
          {job.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
          {showLoc && <span>{job.location}</span>}
          {showLoc && <span aria-hidden>·</span>}
          <span>{time}</span>
          <span aria-hidden>·</span>
          <span>{sourceLabel(job.source)}</span>
          {tags.length > 0 && (
            <span className="ml-1 hidden gap-1 sm:inline-flex">
              {tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-foreground/[0.05] px-2 py-px text-[11.5px] font-medium text-foreground/80">{t}</span>
              ))}
            </span>
          )}
        </div>
        {saved && <StatusBadge status={saved} className="mt-2 sm:hidden" />}
      </div>

      {saved && <StatusBadge status={saved} className="hidden sm:inline-flex" />}

      <MatchScore score={job.score.overall} size="md" />

      <button
        onClick={(e) => { e.stopPropagation(); onSave(job); }}
        aria-label={saved ? 'Saved — update on your board' : 'Save job'}
        className={cn(
          'pressable flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          saved ? 'text-foreground hover:bg-foreground/[0.06]' : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
        )}
      >
        {saved ? <BookmarkCheck className="h-[18px] w-[18px]" /> : <Bookmark className="h-[18px] w-[18px]" />}
      </button>

      <ChevronRight className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground/70 transition-transform duration-160 ease-out [@media(hover:hover)]:group-hover:translate-x-0.5 sm:block" />
    </div>
  );
}

/** @deprecated kept for older imports — use JobRow. */
export const JobCard = JobRow;
