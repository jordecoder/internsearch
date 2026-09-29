import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Link2, ListFilter, ExternalLink, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/lib/api';
import { useResumeFile } from '@/hooks/useResumeFile';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import { ResumeDropzone } from '@/components/ResumeDropzone';
import { RequireAuth } from '@/components/RequireAuth';
import { CopyButton } from '@/components/CopyButton';
import { JobPicker } from '@/components/jobs/JobPicker';
import type { ApplyPack, Job } from '@/types/job';

const DEFAULT_QUESTION = 'Why do you want to work here?';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function TextCard({ label, text }: { label: string; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>{label}</SectionLabel>
          <CopyButton getText={() => ref.current?.textContent ?? ''} />
        </div>
        <p ref={ref} className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
      </CardContent>
    </Card>
  );
}

function ListCard({ label, items, copy = false }: { label: string; items: string[]; copy?: boolean }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>{label}</SectionLabel>
          {copy && <CopyButton getText={() => items.map((b) => `• ${b}`).join('\n')} />}
        </div>
        <ul className="space-y-2">
          {items.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
              <span className="text-primary mt-0.5 flex-shrink-0">›</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Results ── */
function Results({ pack }: { pack: ApplyPack }) {
  return (
    <div className="space-y-3 animate-fade-up">
      {/* Coverage header */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>Role detected</SectionLabel>
              <p className="mt-0.5 text-base font-bold text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {pack.role_title}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-2xl font-light tabular-nums text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {pack.coverage_percent}%
              </span>
              <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wide">Coverage</p>
            </div>
          </div>
          <Progress value={pack.coverage_percent} className="h-1.5" />
          {pack.board_updated && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Kanban className="h-3 w-3" /> Moved to Tailoring on your Application Board.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <SectionLabel>Skills</SectionLabel>
          {pack.matched_skills.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Matched</p>
              <div className="flex flex-wrap gap-1.5">
                {pack.matched_skills.map((s) => <Badge key={s} variant="actionable">{s}</Badge>)}
              </div>
            </div>
          )}
          {pack.missing_skills.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Missing</p>
              <div className="flex flex-wrap gap-1.5">
                {pack.missing_skills.map((s) => (
                  <Badge key={s} className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TextCard label="Tailored Summary" text={pack.tailored_summary} />
      <ListCard label="Priority Bullets" items={pack.prioritised_bullets} copy />
      <ListCard label="Worth Adding (if true)" items={pack.suggested_additions} />

      <Card>
        <CardContent className="pt-5">
          <SectionLabel>ATS Keyword Tips</SectionLabel>
          <p className="mt-3 text-sm text-foreground leading-relaxed">{pack.keyword_tips}</p>
        </CardContent>
      </Card>

      <TextCard label="Cover Letter" text={pack.cover_letter} />
      <TextCard label="Essay Answer" text={pack.essay_answer} />
      <ListCard label="Stress in Interviews" items={pack.interview_focus} />
    </div>
  );
}

/* ── Main page ── */
export function ApplyAgent() {
  const location = useLocation();
  const navState = location.state as { company?: string; title?: string; url?: string } | null;
  const { jobs } = useJobsQuery();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jd, setJd] = useState('');
  const [jdLocked, setJdLocked] = useState(false);
  const [company, setCompany] = useState(navState?.company ?? '');
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const resume = useResumeFile();
  const { file } = resume;
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<ApplyPack | null>(null);
  const [error, setError] = useState('');

  const pickJob = (job: Job) => {
    setSelectedJob(job);
    setCompany(job.company);
    if (job.description) {
      setJd(job.description);
      setJdLocked(true);
    } else {
      setJdLocked(false);
    }
  };

  useEffect(() => {
    if (navState?.url && jobs.length) {
      const found = jobs.find((j) => j.url === navState.url);
      if (found) pickJob(found);
    }
    // Only react to a fresh navigation state, not every jobs refetch.
  }, [navState?.url, jobs.length]);

  const submit = async () => {
    if (!file || jd.trim().length < 50) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.runApplyAgent(file, {
        jobDescription: jd,
        companyName: company.trim(),
        jobTitle: selectedJob?.title ?? '',
        jobUrl: selectedJob?.url ?? '',
        essayQuestion: question.trim(),
      });
      setPack(res);
      if (res.board_updated) queryClient.invalidateQueries({ queryKey: ['board'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireAuth prompt="use the apply agent">
    <div className="max-w-5xl mx-auto px-5 py-8 pb-20">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Apply Agent
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Claude reads the posting and your resume, then drafts everything you need to apply. Check it, then submit it yourself.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {selectedJob && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border rounded-md px-3 py-1.5 w-fit">
              <Link2 className="h-3 w-3" />
              Applying to <span className="font-medium text-foreground">{selectedJob.title}</span> at{' '}
              <span className="font-medium text-foreground">{selectedJob.company}</span>
              <a href={selectedJob.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                Open posting <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          <JobPicker onSelect={pickJob}>
            <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <ListFilter className="h-3 w-3" /> {selectedJob ? 'Change job' : 'Select from your jobs'}
            </button>
          </JobPicker>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-start">

        {/* ── LEFT: Inputs ── */}
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <ResumeDropzone resume={resume} />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Job Description</Label>
              {jdLocked && (
                <button type="button" onClick={() => setJdLocked(false)} className="text-xs font-medium text-primary hover:underline">
                  Edit
                </button>
              )}
            </div>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              disabled={jdLocked}
              placeholder="Paste the full job description here…"
              rows={10}
              className="resize-none text-sm leading-relaxed"
            />
            {jdLocked ? (
              <p className="text-xs text-muted-foreground">
                Filled in from the selected job's listing — Claude also reads the full posting if this looks cut off.
              </p>
            ) : (
              jd.trim().length > 0 && jd.trim().length < 50 && (
                <p className="text-xs text-destructive">Paste a bit more of the job description</p>
              )
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Company Name (optional)</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Grab" className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label>Essay Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={DEFAULT_QUESTION} className="text-sm" />
            <p className="text-xs text-muted-foreground">Swap in whatever the application actually asks — leave as-is for the generic version.</p>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
          )}

          <Button onClick={submit} disabled={loading || !file || jd.trim().length < 50} className="w-full h-10">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Claude is preparing your application… (up to a minute or two)
              </>
            ) : (
              <>
                Prepare application
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* ── RIGHT: Results ── */}
        <div>
          {pack ? (
            <Results pack={pack} />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] text-center text-muted-foreground/50 border-2 border-dashed border-border rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium">Your application pack will appear here</p>
                <p className="text-xs">Tailored resume points, cover letter, essay answer, and interview focus</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </RequireAuth>
  );
}
