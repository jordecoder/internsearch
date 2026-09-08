import { useNavigate } from 'react-router-dom';
import { ExternalLink, FileEdit, Mail, CheckCircle2, Bookmark, BookmarkCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MatchScore } from '@/components/jobs/MatchScore';
import { MatchBreakdown } from '@/components/jobs/MatchBreakdown';
import { SkillBadge } from '@/components/jobs/SkillBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { extractTags } from '@/lib/match';
import { relativeTime, sourceLabel } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUpsertBoardEntry } from '@/hooks/useBoardQuery';
import type { BoardEntryStatus, Job } from '@/types/job';

interface JobDetailPanelProps {
  job: Job | null;
  onClose: () => void;
  savedStatus?: BoardEntryStatus;
}

export function JobDetailPanel({ job, onClose, savedStatus }: JobDetailPanelProps) {
  const navigate = useNavigate();
  const { username } = useAuth();
  const upsert = useUpsertBoardEntry();

  if (!job) return null;
  const tags = extractTags(job.title);
  const navState = { company: job.company, title: job.title, url: job.url };

  const requireAuth = (action: () => void) => {
    if (!username) { navigate('/login'); return; }
    action();
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="p-0 flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-xs uppercase tracking-wide text-muted-foreground">{job.company}</SheetTitle>
          <SheetDescription className="sr-only">Job details and match breakdown</SheetDescription>
          <p className="text-base font-bold text-foreground leading-snug" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            {job.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {[job.location || 'Singapore', sourceLabel(job.source), relativeTime(job.posted_time ?? job.first_seen_time)].join(' · ')}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Overall match</p>
              {savedStatus && <div className="mt-1"><StatusBadge status={savedStatus} /></div>}
            </div>
            <MatchScore score={job.score.overall} size="lg" />
          </div>

          {tags.length > 0 && (
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Technologies mentioned</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => <SkillBadge key={t}>{t}</SkillBadge>)}
              </div>
            </div>
          )}

          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Match breakdown</p>
            <MatchBreakdown score={job.score} />
          </div>

          <div className="rounded-lg border border-dashed border-border px-3.5 py-3 text-xs text-muted-foreground leading-relaxed">
            Full job description lives on the original posting — this dashboard tracks postings across sources but
            doesn't store full descriptions. Open the posting for requirements and how to apply.
          </div>
        </div>

        <div className="border-t border-border p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => requireAuth(() => navigate('/tailor', { state: navState }))}
              className="gap-1.5"
            >
              <FileEdit className="h-3.5 w-3.5" /> Tailor resume
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => requireAuth(() => navigate('/cover-letter', { state: navState }))}
              className="gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" /> Cover letter
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={savedStatus === 'applied' ? 'secondary' : 'default'}
              size="sm"
              onClick={() => requireAuth(() => upsert.mutate({ url: job.url, status: 'applied', title: job.title, company: job.company }))}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {savedStatus === 'applied' ? 'Applied' : 'Mark applied'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={job.url} target="_blank" rel="noreferrer" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Open posting
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
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1"
          >
            {savedStatus ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
            {savedStatus ? 'Saved to your board' : 'Save for later'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
