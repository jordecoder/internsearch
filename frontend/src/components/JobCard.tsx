import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, relativeTime, sourceLabel, formatTimeline, scoreVariant } from '@/lib/utils';
import type { Job } from '@/types/job';

interface JobCardProps {
  job: Job;
  style?: React.CSSProperties;
}

const SCORE_BADGE: Record<ReturnType<typeof scoreVariant>, React.ComponentProps<typeof Badge>['variant']> = {
  high: 'score-high',
  mid:  'score-mid',
  low:  'score-low',
};

export function JobCard({ job, style }: JobCardProps) {
  const sc       = job.score ?? {};
  const overall  = sc.overall ?? 0;
  const variant  = scoreVariant(overall);
  const timeline = formatTimeline(sc.timeline_match);

  const time   = relativeTime(job.posted_time ?? job.first_seen_time);
  const src    = sourceLabel(job.source);
  const loc    = (job.location ?? '').toLowerCase();
  const showLoc = job.location && loc !== 'singapore' && loc !== 'singapore, singapore';

  const meta = [src, job.company, showLoc ? job.location : null, time]
    .filter(Boolean)
    .join(' · ');

  const isNew = Date.now() - new Date(job.first_seen_time).getTime() < 7_200_000;

  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      className={cn(
        'group block rounded-xl border bg-card text-card-foreground transition-all duration-150',
        'hover:-translate-y-[1px] hover:shadow-md hover:border-sage-300 dark:hover:border-sage-700',
        'animate-fade-up',
        job.actionable
          ? 'border-l-[3px] border-l-sage-400 dark:border-l-sage-600'
          : 'border-l-[3px] border-l-transparent',
      )}
    >
      <div className="px-4 py-3.5">
        {/* Top row: title + score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-[0.875rem] font-semibold leading-snug truncate transition-colors',
                'text-foreground group-hover:text-sage-600 dark:group-hover:text-sage-400',
              )}
            >
              {job.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground truncate">{meta}</p>
          </div>

          {/* Score + external link icon */}
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Badge
              variant={SCORE_BADGE[variant]}
              className="tabular-nums text-[0.72rem] px-2 py-0.5 font-bold"
              title={`Role ${sc.role} · Skill ${sc.skill} · Location ${sc.location} · Timeline ${sc.timeline}`}
            >
              {overall}
            </Badge>
          </div>
        </div>

        {/* Badges row */}
        {(job.actionable || job.notified || timeline || isNew) && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {isNew     && <Badge variant="actionable" className="border-sage-300 bg-sage-100 text-sage-600 dark:border-sage-700 dark:bg-sage-900/20 dark:text-sage-400">New</Badge>}
            {job.actionable && <Badge variant="actionable">Actionable</Badge>}
            {job.notified   && <Badge variant="notified">Notified</Badge>}
            {timeline       && <Badge variant="timeline">{timeline}</Badge>}
          </div>
        )}
      </div>
    </a>
  );
}
