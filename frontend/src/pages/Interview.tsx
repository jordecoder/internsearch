import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Send, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import * as api from '@/lib/api';
import { useResumeFile } from '@/hooks/useResumeFile';
import { ResumeDropzone } from '@/components/ResumeDropzone';
import { RequireAuth } from '@/components/RequireAuth';
import { cn } from '@/lib/utils';
import type { ChatTurn, InterviewFeedback, InterviewMode } from '@/types/job';

const MODES: { id: InterviewMode; label: string; blurb: string }[] = [
  { id: 'behavioral', label: 'Behavioral', blurb: 'STAR-style questions about past experience, teamwork, motivation.' },
  { id: 'technical', label: 'Technical', blurb: 'Role-relevant technical questions grounded in your resume and the JD.' },
  { id: 'group_discussion', label: 'Group Discussion (GD/LGD)', blurb: 'Simulated multi-participant discussion round — a common intern-screening format.' },
];

function speakerColor(speaker: string | undefined): string {
  if (!speaker || speaker === 'Interviewer' || speaker === 'Moderator') return 'text-muted-foreground';
  // Deterministic-ish color per participant name so it stays consistent across turns.
  const hues = ['text-sage-600 dark:text-sage-400', 'text-amber-600 dark:text-amber-400', 'text-blue-600 dark:text-blue-400'];
  let hash = 0;
  for (const c of speaker) hash = (hash * 31 + c.charCodeAt(0)) % hues.length;
  return hues[hash];
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-1">
        {turn.speaker && (
          <p className={cn('text-[0.7rem] font-semibold uppercase tracking-wide px-1', speakerColor(turn.speaker))}>
            {turn.speaker}
          </p>
        )}
        <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
          {turn.text}
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: InterviewFeedback }) {
  return (
    <div className="space-y-3 animate-fade-up">
      <Card>
        <CardContent className="pt-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Overall
          </p>
          <p className="text-sm text-foreground leading-relaxed">{feedback.overall_impression}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Strengths</p>
          <ul className="space-y-1.5">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                <span className="text-sage-500 mt-0.5 flex-shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground mb-2">To Improve</p>
          <ul className="space-y-1.5">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">›</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {feedback.sample_better_answer && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground mb-2">A Stronger Answer</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{feedback.sample_better_answer}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function Interview() {
  const resume = useResumeFile();
  const { fileText } = resume;
  const [jd, setJd] = useState('');
  const [mode, setMode] = useState<InterviewMode>('behavioral');
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, feedback]);

  const start = async () => {
    setError('');
    setSending(true);
    try {
      const turns = await api.startInterview(mode, fileText, jd);
      setHistory(turns);
      setStarted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setError('');
    setSending(true);
    try {
      const newTurns = await api.continueInterview(mode, fileText, jd, history, msg);
      setHistory((h) => [...h, ...newTurns]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const endAndReview = async () => {
    setError('');
    setFeedbackLoading(true);
    try {
      const fb = await api.getInterviewFeedback(mode, jd, history);
      setFeedback(fb);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const restart = () => {
    setStarted(false);
    setHistory([]);
    setFeedback(null);
    setInput('');
    setError('');
  };

  return (
    <RequireAuth prompt="practice interviews">
    <div className="max-w-3xl mx-auto px-5 py-8 pb-20">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Mock Interview
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Practice live against a job description, including group-discussion rounds.
        </p>
      </div>

      {!started ? (
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <div className="space-y-1.5">
            <Label>Interview Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'text-left rounded-xl border p-3 transition-all',
                    mode === m.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/40',
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{m.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          <ResumeDropzone resume={resume} label="Resume (optional, sharpens the questions)" />

          <div className="space-y-1.5">
            <Label>Job Description (optional)</Label>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste a job description to ground the questions in a real role…"
              rows={6}
              className="resize-none text-sm leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
          )}

          <Button onClick={start} disabled={sending} className="w-full h-10">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
              </>
            ) : (
              <>
                Start interview <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {MODES.find((m) => m.id === mode)?.label}
            </p>
            <div className="flex items-center gap-3">
              {!feedback && (
                <button
                  onClick={endAndReview}
                  disabled={feedbackLoading || history.length === 0}
                  className="text-xs text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {feedbackLoading ? 'Reviewing…' : 'End & get feedback'}
                </button>
              )}
              <button onClick={restart} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Restart
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="border border-border rounded-xl p-4 space-y-4 max-h-[50vh] overflow-y-auto bg-background">
            {history.map((t, i) => (
              <ChatBubble key={i} turn={t} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
          )}

          {!feedback && (
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your response… (Enter to send, Shift+Enter for a new line)"
                rows={2}
                className="resize-none text-sm"
                disabled={sending}
              />
              <Button onClick={send} disabled={sending || !input.trim()} className="h-auto px-4">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}

          {feedbackLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your performance…
            </div>
          )}

          {feedback && <FeedbackCard feedback={feedback} />}
        </div>
      )}
    </div>
    </RequireAuth>
  );
}
