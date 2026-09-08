import { Bookmark, BookmarkCheck } from 'lucide-react';
import { MatchScore } from '@/components/jobs/MatchScore';
import { SkillBadge } from '@/components/jobs/SkillBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { cn, relativeTime, sourceLabel } from '@/lib/utils';
import { extractTags } from '@/lib/match';
import type { BoardEntryStatus, Job } from '@/types/job';

interface JobCardProps {
  job: Job;
  saved?: BoardEntryStatus;
  onOpen: (job: Job) => void;
  onSave: (job: Job) => void;
  style?: React.CSSProperties;
}

export function JobCard({ job, saved, onOpen, onSave, style }: JobCardProps) {
  const sc = job.score;
  const time = relativeTime(job.posted_time ?? job.first_seen_time);
  const src = sourceLabel(job.source);
  const loc = (job.location ?? '').toLowerCase();
  const showLoc = job.location && loc !== 'singapore' && loc !== 'singapore, singapore';
  const tags = extractTags(job.title);
  const isNew = Date.now() - new Date(job.first_seen_time).getTime() < 7_200_000;

  return (
    <div
      style={style}
      onClick={() => onOpen(job)}
      className={cn(
        'group cursor-pointer rounded-lg border border-border bg-card px-4 py-3.5 transition-colors animate-fade-up',
        'hover:border-primary/40 hover:bg-accent/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground truncate">{job.company}</p>
            {isNew && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary" title="New" />}
          </div>
          <p className="mt-0.5 text-[0.9rem] font-semibold text-foreground leading-snug truncate group-hover:text-primary transition-colors">
            {job.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {[showLoc ? job.location : 'Singapore', 'Internship', time].filter(Boolean).join(' · ')} · {src}
          </p>
        </div>
        <MatchScore score={sc.overall} size="sm" />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {tags.map((t) => <SkillBadge key={t}>{t}</SkillBadge>)}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/70">
        <div className="flex items-center gap-2">
          {saved && <StatusBadge status={saved} />}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onSave(job); }}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              saved ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {saved ? 'Saved' : 'Save'}
          </button>
          <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1">
            View details →
          </span>
        </div>
      </div>
    </div>
  );
}
