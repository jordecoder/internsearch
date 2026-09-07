import { useRef, useState } from 'react';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getKey, generateApplicationMaterials } from '@/lib/gemini';
import { useResumeFile } from '@/hooks/useResumeFile';
import { useGeminiKey } from '@/hooks/useGeminiKey';
import { ResumeDropzone } from '@/components/ResumeDropzone';
import { GeminiKeySetup } from '@/components/GeminiKeySetup';
import { CopyButton } from '@/components/CopyButton';
import type { ApplicationMaterials } from '@/types/job';

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
  const { hasKey, markSaved, changeKey } = useGeminiKey();
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState('');
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const resume = useResumeFile();
  const { fileText } = resume;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApplicationMaterials | null>(null);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!fileText || jd.trim().length < 50) return;
    setError('');
    setLoading(true);
    try {
      const key = getKey()!;
      const res = await generateApplicationMaterials(fileText, jd, company.trim(), question.trim(), key);
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
      <div className="mb-8 animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              Cover Letter & Essays
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Draft a ready-to-send cover letter and answer "why this company" style essay questions.
            </p>
          </div>
          <button onClick={changeKey} className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> <span className="hidden sm:inline">Change key</span>
          </button>
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
  );
}
