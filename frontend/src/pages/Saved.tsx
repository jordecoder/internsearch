import { Link } from 'react-router-dom';
import { ExternalLink, Trash2, ArrowRight, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/hooks/useAuth';
import { useBoardQuery, useDeleteBoardEntry, useUpsertBoardEntry } from '@/hooks/useBoardQuery';
import { relativeTime } from '@/lib/utils';

function SavedContent() {
  const { username } = useAuth();
  const { data: board, isLoading } = useBoardQuery(!!username);
  const upsert = useUpsertBoardEntry();
  const remove = useDeleteBoardEntry();

  const saved = Object.entries(board ?? {}).filter(([, entry]) => entry.status === 'found');

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-8 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Saved jobs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs you've bookmarked from Discover — move them along on the{' '}
          <Link to="/board" className="text-primary hover:underline">Application Board</Link> when you're ready.
        </p>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved jobs yet"
          description="Save jobs from the Jobs page to keep track of them here."
          action={<Button asChild size="sm"><Link to="/">Browse jobs</Link></Button>}
        />
      ) : (
        <div className="space-y-2">
          {saved.map(([url, entry]) => (
            <Card key={url}>
              <CardContent className="pt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.title || '(untitled)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.company}</p>
                  <p className="text-[0.7rem] text-muted-foreground/70 mt-1">Saved {relativeTime(entry.updated_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={url} target="_blank" rel="noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => upsert.mutate({ url, status: 'applied', title: entry.title, company: entry.company })}
                    title="Move to Applied"
                    className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-accent"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove.mutate(url)}
                    title="Remove"
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-accent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function Saved() {
  return (
    <RequireAuth prompt="save jobs">
      <SavedContent />
    </RequireAuth>
  );
}
