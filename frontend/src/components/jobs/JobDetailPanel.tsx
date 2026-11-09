import { useNavigate } from 'react-router-dom';
import { ExternalLink, Sparkles, CheckCircle2, Bookmark, BookmarkCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MatchScore } from '@/components/jobs/MatchScore';
import { MatchBreakdown } from '@/components/jobs/MatchBreakdown';
import { SkillBadge } from '@/components/jobs/SkillBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { CompanyMonogram } from '@/components/CompanyMonogram';
import { extractTags, matchTier, TIER_LABEL } from '@/lib/match';
import { formatTimeline, relativeTime, sourceLabel } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUpsertBoardEntry } from '@/hooks/useBoardQuery';
import type { BoardEntryStatus, Job } from '@/types/job';

interface JobDetailPanelProps {
  job: Job | null;
  onClose: () => void;
  savedStatus?: BoardEntryStatus;
}

const sectionLabel = 'mb-3 text-[13px] font-semibold tracking-[-0.003em] text-muted-foreground';

export function JobDetailPanel({ job, onClose, savedStatus }: JobDetailPanelProps) {
  const navigate = useNavigate();
  const { username } = useAuth();
  const upsert = useUpsertBoardEntry();

  if (!job) return null;
  const tags = extractTags(job.title);
  const navState = { company: job.company, title: job.title, url: job.url };
  const timeline = formatTimeline(job.score.timeline_match);

  const requireAuth = (action: () => void) => {
    if (!username) { navigate('/login'); return; }
    action();
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto">
          <SheetHeader className="gap-0 pb-6 pt-7">
            <div className="flex items-center gap-3">
              <CompanyMonogram name={job.company} size={44} />
              <div className="min-w-0">
                <SheetTitle className="truncate text-[15px] font-medium tracking-[-0.01em]">{job.company}</SheetTitle>
                <p className="truncate text-[13px] text-muted-foreground">
                  {[job.location || 'Singapore', sourceLabel(job.source), relativeTime(job.posted_time ?? job.first_seen_time)].join(' · ')}
                </p>
              </div>
            </div>
            <SheetDescription className="sr-only">Job details and match breakdown</SheetDescription>
            <h2 className="mt-5 text-[26px] font-semibold leading-[1.15] tracking-[-0.026em] text-foreground">{job.title}</h2>
            {(savedStatus || timeline) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {savedStatus && <StatusBadge status={savedStatus} />}
                {timeline && <span className="text-[13px] text-muted-foreground">{timeline}</span>}
              </div>
            )}
          </SheetHeader>

          <div className="space-y-8 px-6 pb-8">
            <section className="flex items-center gap-6 rounded-[20px] bg-background/70 p-5 shadow-control">
              <MatchScore score={job.score.overall} size="xl" />
              <div className="min-w-0">
                <p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">{TIER_LABEL[matchTier(job.score.overall)]}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
                  Scored on role, skills, location, timeline and degree fit.
                </p>
              </div>
            </section>

            <section>
              <h3 className={sectionLabel}>How it scores</h3>
              <MatchBreakdown score={job.score} />
            </section>

            {tags.length > 0 && (
              <section>
                <h3 className={sectionLabel}>Mentioned in the title</h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => <SkillBadge key={t}>{t}</SkillBadge>)}
                </div>
              </section>
            )}

            <section>
              <h3 className={sectionLabel}>About the role</h3>
              {job.description ? (
                <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-[18px] bg-background/70 px-4 py-3.5 text-[14px] leading-relaxed text-foreground shadow-control">
                  {job.description}
                </p>
              ) : (
                <p className="rounded-[18px] bg-background/70 px-4 py-3.5 text-[14px] leading-relaxed text-muted-foreground shadow-control">
                  No description was captured for this posting. Open it to read the requirements and how to apply.
                </p>
              )}
            </section>
          </div>
        </div>

        <footer className="material space-y-2.5 border-t border-border/70 p-5">
          <Button
            size="lg"
            onClick={() => requireAuth(() => navigate('/apply', { state: navState }))}
            className="w-full gap-2"
          >
            <Sparkles className="h-4 w-4" /> Prepare application with Claude
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="secondary"
              onClick={() => requireAuth(() => upsert.mutate({ url: job.url, status: 'applied', title: job.title, company: job.company }))}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> {savedStatus === 'applied' ? 'Applied' : 'Mark applied'}
            </Button>
            <Button variant="secondary" asChild>
              <a href={job.url} target="_blank" rel="noreferrer" className="gap-2">
                <ExternalLink className="h-4 w-4" /> Open posting
              </a>
            </Button>
          </div>
          <button
            onClick={() => requireAuth(() => upsert.mutate({
              url: job.url,
              status: savedStatus && savedStatus !== 'skipped' ? savedStatus : 'found',
              title: job.title,
              company: job.company,
            }))}
            className="pressable flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[13.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            {savedStatus ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {savedStatus ? 'Saved to your board' : 'Save for later'}
          </button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
