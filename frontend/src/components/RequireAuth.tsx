import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppMark } from '@/components/AppMark';
import { WordReveal } from '@/components/motion';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth({ children, prompt = 'track your pipeline' }: { children: React.ReactNode; prompt?: string }) {
  const { username, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (!username) {
    return (
      <div className="flex min-h-[72vh] items-center justify-center px-5">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-7 w-fit animate-icon-in"><AppMark size={56} /></div>
          <WordReveal as="h1" segments={[`Log in to ${prompt}.`]} className="type-title text-foreground" delay={120} />
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground [animation:word-in_900ms_var(--ease-expo)_300ms_both]">
            This is a private workspace. Only its owner can sign in.
          </p>
          <div className="mt-7 [animation:word-in_900ms_var(--ease-expo)_420ms_both]">
            <Button asChild size="lg"><Link to="/login">Log in</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
