import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl, saveApiUrl, setRetryListener, DEFAULT_API_URL } from '@/lib/api';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [wakingUp, setWakingUp] = useState('');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(getApiUrl());

  const submit = async () => {
    if (!password) return;
    setError('');
    setWakingUp('');
    setLoading(true);
    setRetryListener((attempt, max) => {
      setWakingUp(
        attempt === 1
          ? "The backend looks asleep (Render's free tier does this after ~15 min idle) — waking it up…"
          : `Still waking up… (try ${attempt}/${max})`,
      );
    });
    try {
      await login(password);
      navigate('/board');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setWakingUp('');
      setRetryListener(null);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-16">
      <Card className="w-full max-w-sm animate-fade-up">
        <CardHeader className="pb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <Lock className="h-4.5 w-4.5 text-primary" />
          </div>
          <CardTitle className="text-base">Log in</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            This site is private. Enter the owner password to use the board, Apply Agent, and Interview Prep.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {wakingUp && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" /> {wakingUp}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <Button onClick={submit} disabled={loading || !password} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Log in <ArrowRight className="h-4 w-4" /></>}
          </Button>

          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="h-3 w-3" /> API URL
            </button>
            {showSettings && (
              <div className="mt-2 space-y-1.5">
                <Input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  onBlur={() => saveApiUrl(apiUrl || DEFAULT_API_URL)}
                  placeholder={DEFAULT_API_URL}
                  className="font-mono text-xs"
                />
                <p className="text-[0.65rem] text-muted-foreground">Only change this if you're running your own backend deployment.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
