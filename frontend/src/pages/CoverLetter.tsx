import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Loader2, Link2, ListFilter, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/lib/api';
import { useResumeFile } from '@/hooks/useResumeFile';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import { ResumeDropzone } from '@/components/ResumeDropzone';
import { RequireAuth } from '@/components/RequireAuth';
import { CopyButton } from '@/components/CopyButton';
import { JobPicker } from '@/components/jobs/JobPicker';
import type { ApplicationMaterials, Job } from '@/types/job';

const DEFAULT_QUESTION = 'Why do you want to work here?';

function Results({ result }: { result: ApplicationMaterials }) {
  const letterRef = useRef<HTMLParagraphElement>(null);
  const essayRef = useRef<HTMLParagraphElement>(null);

  return (
    <div className="space-y-3 animate-fade-up">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">Cover Letter</p>
            <CopyButton getText={() => letterRef.current?.textContent ?? ''} />
          </div>
          <p ref={letterRef} className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {result.cover_letter}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">Essay Answer</p>
            <CopyButton getText={() => essayRef.current?.textContent ?? ''} />
          </div>
          <p ref={essayRef} className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {result.essay_answer}
          </p>
        </CardContent>
      </Card>

      {result.key_points_used.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Resume Facts Used
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.key_points_used.map((p) => (
                <Badge key={p} variant="actionable">{p}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function CoverLetter() {
  const location = useLocation();
  const navState = location.state as { company?: string; title?: string; url?: string } | null;
  const { jobs } = useJobsQuery();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState(navState?.company ?? '');
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const resume = useResumeFile();
  const { fileText } = resume;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApplicationMaterials | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (navState?.url && jobs.length) {
      const found = jobs.find((j) => j.url === navState.url);
      if (found) setSelectedJob(found);
    }
    // Only react to a fresh navigation state, not every jobs refetch.
  }, [navState?.url, jobs.length]);

  const pickJob = (job: Job) => {
    setSelectedJob(job);
    setCompany(job.company);
  };

  const submit = async () => {
    if (!fileText || jd.trim().length < 50) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.generateMaterials(fileText, jd, company.trim(), question.trim());
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireAuth prompt="draft cover letters">
    <div className="max-w-5xl mx-auto px-5 py-8 pb-20">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Cover Letter & Essays
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Draft a ready-to-send cover letter and answer "why this company" style essay questions.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {selectedJob && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border rounded-md px-3 py-1.5 w-fit">
              <Link2 className="h-3 w-3" />
              Prefilled from <span className="font-medium text-foreground">{selectedJob.title}</span> at{' '}
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <ResumeDropzone resume={resume} />

          <div className="space-y-1.5">
            <Label>Job Description</Label>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={8}
              className="resize-none text-sm leading-relaxed"
            />
            {jd.trim().length > 0 && jd.trim().length < 50 && (
              <p className="text-xs text-destructive">Paste a bit more of the job description</p>
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

          <Button onClick={submit} disabled={loading || !fileText || jd.trim().length < 50} className="w-full h-10">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Writing with Gemini…
              </>
            ) : (
              <>
                Generate materials
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div>
          {result ? (
            <Results result={result} />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] text-center text-muted-foreground/50 border-2 border-dashed border-border rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium">Your cover letter & essay answer will appear here</p>
                <p className="text-xs">Upload your resume and paste a JD to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </RequireAuth>
  );
}
