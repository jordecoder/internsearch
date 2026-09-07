import { useRef, useState } from 'react';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getKey, tailorResume } from '@/lib/gemini';
import { useResumeFile } from '@/hooks/useResumeFile';
import { useGeminiKey } from '@/hooks/useGeminiKey';
import { ResumeDropzone } from '@/components/ResumeDropzone';
import { GeminiKeySetup } from '@/components/GeminiKeySetup';
import { CopyButton } from '@/components/CopyButton';
import type { TailorResult } from '@/types/job';

/* ── Results ── */
function Results({ result }: { result: TailorResult }) {
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const bulletsRef = useRef<HTMLUListElement>(null);

  return (
    <div className="space-y-3 animate-fade-up">
      {/* Coverage header */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.8rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Role detected
              </p>
              <p className="mt-0.5 text-base font-bold text-foreground"
                 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {result.role_title}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-2xl font-light tabular-nums text-foreground"
                    style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {result.coverage_percent}%
              </span>
              <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wide">Coverage</p>
            </div>
          </div>
          <Progress value={result.coverage_percent} className="h-1.5" />
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
          {result.matched_skills.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Matched</p>
              <div className="flex flex-wrap gap-1.5">
                {result.matched_skills.map((s) => (
                  <Badge key={s} variant="actionable">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          {result.missing_skills.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Missing</p>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_skills.map((s) => (
                  <Badge key={s} className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Tailored Summary
            </p>
            <CopyButton getText={() => summaryRef.current?.textContent ?? ''} />
          </div>
          <p ref={summaryRef} className="text-sm text-foreground leading-relaxed">
            {result.tailored_summary}
          </p>
        </CardContent>
      </Card>

      {/* Bullets */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Priority Bullets
            </p>
            <CopyButton getText={() => result.prioritised_bullets.map((b) => `• ${b}`).join('\n')} />
          </div>
          <ul ref={bulletsRef} className="space-y-2">
            {result.prioritised_bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                <span className="text-primary mt-0.5 flex-shrink-0">›</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Keyword tips */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            ATS Keyword Tips
          </p>
          <p className="text-sm text-foreground leading-relaxed">{result.keyword_tips}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Tailor page ── */
export function Tailor() {
  const { hasKey, markSaved, changeKey } = useGeminiKey();
  const [jd, setJd]           = useState('');
  const resume = useResumeFile();
  const { fileText } = resume;
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<TailorResult | null>(null);
  const [error, setError]       = useState('');

  const submit = async () => {
    if (!fileText || jd.trim().length < 50) return;
    setError('');
    setLoading(true);
    try {
      const key = getKey()!;
      const res = await tailorResume(fileText, jd, key);
      setResult(res);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'API_KEY_INVALID') changeKey();
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) return <GeminiKeySetup onSaved={markSaved} />;

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 pb-20">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight text-foreground"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              Resume Tailor
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Upload your resume, paste a job description, get a targeted match.
            </p>
          </div>
          <button
            onClick={changeKey}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <KeyRound className="h-3 w-3" /> Change key
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-start">

        {/* ── LEFT: Inputs ── */}
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '60ms' }}>

          {/* Resume upload */}
          <ResumeDropzone resume={resume} />

          {/* Job description */}
          <div className="space-y-1.5">
            <Label>Job Description</Label>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={10}
              className="resize-none text-sm leading-relaxed"
            />
            {jd.trim().length > 0 && jd.trim().length < 50 && (
              <p className="text-xs text-destructive">Paste a bit more of the job description</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={submit}
            disabled={loading || !fileText || jd.trim().length < 50}
            className="w-full h-10"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing with Gemini…
              </>
            ) : (
              <>
                Tailor my resume
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* ── RIGHT: Results ── */}
        <div>
          {result ? (
            <Results result={result} />
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] text-center text-muted-foreground/50 border-2 border-dashed border-border rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium">Results will appear here</p>
                <p className="text-xs">Upload your resume and paste a JD to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
