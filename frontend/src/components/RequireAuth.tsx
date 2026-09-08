import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth({ children, prompt = 'track your pipeline' }: { children: React.ReactNode; prompt?: string }) {
  const { username, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!username) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-5">
        <Card className="max-w-sm w-full text-center animate-fade-up">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-foreground font-medium">Log in to {prompt}</p>
            <p className="text-xs text-muted-foreground">
              This runs on the shared backend, so it needs an account — no API key required.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Log in / Register</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
