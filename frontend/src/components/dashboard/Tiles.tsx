import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, BookmarkCheck } from 'lucide-react';
import { MatchScore } from '@/components/jobs/MatchScore';
import { CompanyMonogram } from '@/components/CompanyMonogram';
import { StatusBadge, STATUS_LABEL } from '@/components/StatusBadge';
import { CountUp, useSpotlight } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { matchRecommendation, matchTier, TIER_LABEL } from '@/lib/match';
import { cn, relativeTime, sourceLabel } from '@/lib/utils';
import type { BoardEntry, BoardEntryStatus, Job } from '@/types/job';

const BREAKDOWN = [
  { key: 'role', label: 'Role' },
  { key: 'skill', label: 'Skills' },
  { key: 'location', label: 'Location' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'degree', label: 'Degree' },
] as const;

/** The single best-scoring listing, presented like a product hero. */
export function TopMatchTile({
  job, saved, onOpen, onSave,
}: { job: Job; saved?: BoardEntryStatus; onOpen: (j: Job) => void; onSave: (j: Job) => void }) {
  const spot = useSpotlight();
  const tier = matchTier(job.score.overall);
  const time = relativeTime(job.posted_time ?? job.first_seen_time);

  return (
    <article {...spot} className="tile spotlight flex h-full flex-col p-6 sm:p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="type-eyebrow text-hint">Top match</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{TIER_LABEL[tier]}</p>
        </div>
        <MatchScore score={job.score.overall} size="xl" className="-mr-1 -mt-1" />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <CompanyMonogram name={job.company} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-foreground">{job.company}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {[job.location || 'Singapore', time, sourceLabel(job.source)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <h3 className="mt-4 text-[22px] font-semibold leading-[1.18] tracking-[-0.022em] text-foreground sm:text-[24px]">
        {job.title}
      </h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{matchRecommendation(job.score)}</p>

      <dl className="mt-6 space-y-2.5">
        {BREAKDOWN.map(({ key, label }, i) => {
          const v = job.score[key];
          return (
            <div key={key} className="grid grid-cols-[72px_1fr_32px] items-center gap-3 text-[12.5px]">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                <span
                  className={cn('grow-x block h-full rounded-full', v >= 70 ? 'bg-foreground/85' : v >= 50 ? 'bg-foreground/45' : 'bg-warning')}
                  style={{ width: `${v}%`, ['--seg' as string]: i }}
                />
              </dd>
              <dd className="text-right font-medium tabular-nums text-foreground">{v}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-7">
        <Button onClick={() => onOpen(job)} className="gap-1.5">
          View role <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={() => onSave(job)} className="gap-1.5">
          {saved ? <BookmarkCheck className="h-4 w-4 text-hint" /> : <Bookmark className="h-4 w-4" />}
          {saved ? STATUS_LABEL[saved] ?? 'Saved' : 'Save'}
        </Button>
        {saved && <StatusBadge status={saved} className="ml-auto hidden xl:inline-flex" />}
      </div>
    </article>
  );
}

const PIPELINE: { status: BoardEntryStatus; bar: string }[] = [
  { status: 'found', bar: 'bg-muted-foreground/45' },
  { status: 'tailoring', bar: 'bg-hint' },
  { status: 'applied', bar: 'bg-foreground/85' },
  { status: 'interviewing', bar: 'bg-warning' },
  { status: 'offer', bar: 'bg-success' },
  { status: 'rejected', bar: 'bg-danger/60' },
];

/** Where every tracked application sits, as one proportional bar. */
export function PipelineTile({ board, loggedIn }: { board: Record<string, BoardEntry> | undefined; loggedIn: boolean }) {
  const spot = useSpotlight();
  const entries = Object.values(board ?? {}).filter((e) => e.status !== 'skipped');
  const counts = Object.fromEntries(PIPELINE.map((p) => [p.status, entries.filter((e) => e.status === p.status).length])) as Record<string, number>;
  const total = entries.length;
  const active = counts.applied + counts.interviewing + counts.offer;

  return (
    <article {...spot} className="tile spotlight flex h-full flex-col p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <p className="type-eyebrow text-muted-foreground">Your pipeline</p>
        {loggedIn && (
          <Link to="/board" className="group inline-flex items-center gap-1 rounded-full text-[13px] font-medium text-hint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Open board <ArrowRight className="h-3.5 w-3.5 transition-transform duration-160 ease-out [@media(hover:hover)]:group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {loggedIn ? (
        <>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-[56px] font-semibold leading-none tracking-[-0.045em] text-foreground">
              <CountUp value={total} />
            </span>
            <span className="text-[15px] text-muted-foreground">
              tracked · <span className="text-foreground">{active}</span> in play
            </span>
          </div>

          <div className="mt-7 flex h-3 w-full gap-[3px] overflow-hidden rounded-full bg-foreground/[0.06]" role="img" aria-label={PIPELINE.map((p) => `${STATUS_LABEL[p.status]} ${counts[p.status]}`).join(', ')}>
            {total > 0 &&
              PIPELINE.filter((p) => counts[p.status] > 0).map((p, i) => (
                <span
                  key={p.status}
                  className={cn('grow-x h-full first:rounded-l-full last:rounded-r-full', p.bar)}
                  style={{ width: `${(counts[p.status] / total) * 100}%`, ['--seg' as string]: i }}
                />
              ))}
          </div>

          <dl className="mb-6 mt-6 grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-6">
            {PIPELINE.map((p) => (
              <div key={p.status} className="min-w-0">
                <dt className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', p.bar)} aria-hidden />
                  {STATUS_LABEL[p.status]}
                </dt>
                <dd className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                  <CountUp value={counts[p.status]} duration={1100} delay={200} />
                </dd>
              </div>
            ))}
          </dl>

          {counts.applied + counts.interviewing + counts.offer + counts.rejected > 0 && (
            <p className="mt-auto border-t border-border/70 pt-4 text-[13px] text-muted-foreground">
              {(() => {
                const sent = counts.applied + counts.interviewing + counts.offer + counts.rejected;
                const heard = counts.interviewing + counts.offer;
                return (
                  <>
                    <span className="font-medium text-foreground">{Math.round((heard / sent) * 100)}%</span> of the {sent} applications you've sent
                    have turned into an interview or offer.
                  </>
                );
              })()}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-between gap-6">
          <p className="max-w-sm text-[22px] font-semibold leading-tight tracking-[-0.022em] text-foreground">
            Track every application from first look to offer.
          </p>
          <Button asChild className="self-start">
            <Link to="/login">Log in to see your pipeline</Link>
          </Button>
        </div>
      )}
    </article>
  );
}

/** A single headline number with context. */
export function MetricTile({ label, value, caption, suffix }: { label: string; value: number; caption: React.ReactNode; suffix?: string }) {
  const spot = useSpotlight();
  return (
    <article {...spot} className="tile spotlight flex h-full flex-col justify-between p-6 sm:p-7">
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      <div className="mt-6">
        <p className="text-[48px] font-semibold leading-none tracking-[-0.045em] text-foreground">
          <CountUp value={value} />
          {suffix && <span className="ml-0.5 text-[24px] font-medium tracking-[-0.02em] text-muted-foreground">{suffix}</span>}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{caption}</p>
      </div>
    </article>
  );
}
