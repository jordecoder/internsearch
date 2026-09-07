import { useState } from 'react';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveKey, validateKey } from '@/lib/gemini';

export function GeminiKeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    if (!key.startsWith('AIza')) {
      setError('Gemini keys start with "AIza".');
      return;
    }
    setLoading(true);
    const { ok, error: err } = await validateKey(key);
    setLoading(false);
    if (!ok) {
      setError(err ?? 'Invalid key.');
      return;
    }
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
