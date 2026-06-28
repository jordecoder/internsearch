import { useCallback, useRef, useState } from 'react';
import { KeyRound, Upload, Copy, Check, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getKey, saveKey, clearKey, validateKey, tailorResume } from '@/lib/gemini';
import { extractText } from '@/lib/extract-text';
import type { TailorResult } from '@/types/job';

/* ── Copyable section ── */
function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-sage-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── API Key setup panel ── */
function KeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    if (!key.startsWith('AIza')) { setError('Gemini keys start with "AIza".'); return; }
    setLoading(true);
    const { ok, error: err } = await validateKey(key);
    setLoading(false);
    if (!ok) { setError(err ?? 'Invalid key.'); return; }
    saveKey(key);
    onSaved();
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-5 py-16">
      <Card className="w-full max-w-sm animate-fade-up">
        <CardHeader className="pb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <KeyRound className="h-4.5 w-4.5 text-primary" />
          </div>
          <CardTitle className="text-base">Connect Gemini</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Get a free key at{' '}
            <span className="text-primary font-medium">aistudio.google.com</span> → Get API Key.
            Stored locally in your browser only.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <Input
            type="password"
            placeholder="AIza…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="font-mono text-sm"
          />
          <Button onClick={save} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save & continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

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
  const [hasKey, setHasKey]   = useState(() => !!getKey());
  const [jd, setJd]           = useState('');
  const [file, setFile]       = useState<File | null>(null);
  const [fileText, setFileText] = useState('');
  const [fileParsing, setFileParsing] = useState(false);
  const [fileError, setFileError]     = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<TailorResult | null>(null);
  const [error, setError]       = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setFileError('');
    setFileParsing(true);
    try {
      const text = await extractText(f);
      setFileText(text);
    } catch (e) {
      setFileError((e as Error).message);
      setFile(null);
    } finally {
      setFileParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

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
      if (msg === 'API_KEY_INVALID') { clearKey(); setHasKey(false); }
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) return <KeySetup onSaved={() => setHasKey(true)} />;

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
            onClick={() => { clearKey(); setHasKey(false); }}
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
          <div className="space-y-1.5">
            <Label>Resume</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150',
                dragging
                  ? 'border-primary bg-primary/5'
                  : file
                  ? 'border-sage-400 bg-sage-50 dark:border-sage-700 dark:bg-sage-900/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/40',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {fileParsing ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Parsing {file?.name}…</p>
                </div>
              ) : file && !fileError ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="text-left">
                    <p className="text-sm font-medium text-sage-700 dark:text-sage-400">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fileText.split(/\s+/).length} words extracted
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setFileText(''); }}
                    className="ml-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="h-7 w-7 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Drop your resume or{' '}
                    <span className="text-primary font-medium">browse</span>
                  </p>
                  <p className="text-xs mt-1 opacity-60">PDF, DOCX, or TXT · max 5 MB</p>
                </div>
              )}

              {fileError && (
                <p className="mt-2 text-xs text-destructive">{fileError}</p>
              )}
            </div>
          </div>

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
