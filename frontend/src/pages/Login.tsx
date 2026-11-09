import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AppMark } from '@/components/AppMark';
import { WordReveal } from '@/components/motion';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl, saveApiUrl, setRetryListener, DEFAULT_API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

const rise = (ms: number) => ({ animation: `word-in 1000ms var(--ease-expo) ${ms}ms both` });

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
    if (!password || loading) return;
    setError('');
    setWakingUp('');
    setLoading(true);
    setRetryListener((attempt, max) => {
      setWakingUp(
        attempt === 1
          ? 'The server is waking up after a nap. This can take up to a minute.'
          : `Still waking up… (attempt ${attempt} of ${max})`,
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
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden">
      {/* Ambient aurora: sand light, a breath of blue. Drifts slowly; static under reduced motion. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-[12%] -top-[18%] h-[62vmax] w-[62vmax] rounded-full bg-warning-soft opacity-90 blur-[110px] animate-aurora-1 dark:opacity-60" />
        <div className="absolute -right-[16%] top-[8%] h-[52vmax] w-[52vmax] rounded-full bg-hint/20 blur-[120px] animate-aurora-2 dark:bg-hint/15" />
        <div className="absolute -bottom-[30%] left-[22%] h-[58vmax] w-[58vmax] rounded-full bg-card opacity-90 blur-[110px] animate-aurora-3 dark:opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background))_100%)]" />
      </div>

      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AppMark size={28} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">Intern Scout</span>
        </Link>
        <Link
          to="/"
          className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-medium text-hint hover:bg-hint/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Browse jobs <ArrowUpRight className="h-4 w-4 transition-transform duration-160 ease-out [@media(hover:hover)]:group-hover:-translate-y-px [@media(hover:hover)]:group-hover:translate-x-px" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-24 pt-6">
        <div className="w-full max-w-[560px] text-center">
          <div className="mx-auto mb-9 w-fit animate-icon-in">
            <AppMark size={76} className="shadow-float" />
          </div>

          <WordReveal
            segments={[{ text: 'Welcome back.' }, { text: ' Your pipeline is waiting.', className: 'text-muted-foreground' }]}
            className="type-hero text-foreground"
            delay={150}
          />
          <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground" style={rise(450)}>
            Sign in to track applications, tailor your resume with Claude, and practise for interviews.
          </p>

          <form
            className="mx-auto mt-10 max-w-[400px]"
            style={rise(600)}
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <label htmlFor="password" className="sr-only">Password</label>
            <div
              className={cn(
                'relative flex h-14 items-center rounded-[18px] bg-card shadow-float transition-shadow duration-250',
                'focus-within:ring-[3px] focus-within:ring-hint/35',
                error && 'ring-[3px] ring-danger/35',
              )}
            >
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                autoComplete="current-password"
                autoFocus
                placeholder="Password"
                className="h-full w-full rounded-[18px] bg-transparent pl-5 pr-16 text-[17px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                disabled={!password || loading}
                aria-label="Sign in"
                className={cn(
                  'pressable absolute right-2 flex h-10 w-10 items-center justify-center rounded-full',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  password ? 'bg-primary text-primary-foreground' : 'bg-foreground/[0.06] text-muted-foreground',
                )}
              >
                {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ArrowRight className="h-[18px] w-[18px]" />}
              </button>
            </div>

            <div aria-live="polite" className="min-h-[3rem] pt-4">
              {error && <p className="animate-fade-up text-[14px] leading-relaxed text-danger">{error}</p>}
              {wakingUp && !error && (
                <p className="inline-flex animate-fade-up items-center gap-2 text-[14px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-warning" /> {wakingUp}
                </p>
              )}
            </div>
          </form>

          <div className="mx-auto mt-2 max-w-[400px]" style={rise(750)}>
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-expanded={showSettings}
              className="pressable rounded-full px-3 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Server settings
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-400 ease-out',
                showSettings ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="space-y-2 px-1 pb-1 pt-3 text-left">
                  <label htmlFor="api-url" className="text-[13px] font-medium text-foreground">API URL</label>
                  <Input
                    id="api-url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    onBlur={() => saveApiUrl(apiUrl || DEFAULT_API_URL)}
                    placeholder={DEFAULT_API_URL}
                    className="font-mono text-[13px]"
                  />
                  <p className="text-[12.5px] text-muted-foreground">Only change this if you run your own backend.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center text-[12.5px] text-muted-foreground">
        Private workspace · only the owner can sign in
      </footer>
    </div>
  );
}
