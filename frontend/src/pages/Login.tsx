import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, ArrowRight, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl, saveApiUrl, DEFAULT_API_URL } from '@/lib/api';

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(getApiUrl());

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password, inviteCode);
      navigate('/board');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-5 py-16">
      <Card className="w-full max-w-sm animate-fade-up">
        <CardHeader className="pb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <UserRound className="h-4.5 w-4.5 text-primary" />
          </div>
          <CardTitle className="text-base">{mode === 'login' ? 'Log in' : 'Create account'}</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Sign in to sync your pipeline board across devices.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>

          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label>Invite Code</Label>
              <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            </div>
          )}

          <Button onClick={submit} disabled={loading || !username || !password} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}
          </button>

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
