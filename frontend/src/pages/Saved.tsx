import { Link } from 'react-router-dom';
import { ExternalLink, Trash2, ArrowRight, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { RequireAuth } from '@/components/RequireAuth';
import { PageHeader } from '@/components/PageHeader';
import { CompanyMonogram } from '@/components/CompanyMonogram';
import { Reveal } from '@/components/motion';
import { useAuth } from '@/hooks/useAuth';
import { useBoardQuery, useDeleteBoardEntry, useUpsertBoardEntry } from '@/hooks/useBoardQuery';
import { cn, relativeTime } from '@/lib/utils';

const iconBtn =
  'pressable flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function SavedContent() {
  const { username } = useAuth();
  const { data: board, isLoading } = useBoardQuery(!!username);
  const upsert = useUpsertBoardEntry();
  const remove = useDeleteBoardEntry();

  const saved = Object.entries(board ?? {})
    .filter(([, entry]) => entry.status === 'found')
    .sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at));

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
      <PageHeader
        eyebrow="Discover"
        title={[{ text: 'Saved.' }, { text: ' Roles you want a closer look at.', className: 'text-muted-foreground' }]}
        description={
          <>
            When you're ready, send one on to your{' '}
            <Link to="/board" className="font-medium text-hint hover:underline">board</Link>.
          </>
        }
      />

      {isLoading ? (
        <div className="tile overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-border/70 px-5 py-4 first:border-t-0">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-2/3" /></div>
            </div>
          ))}
        </div>
      ) : saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Tap the bookmark on any role in Jobs and it lands here."
          action={<Button asChild><Link to="/">Browse jobs</Link></Button>}
        />
      ) : (
        <Reveal className="tile overflow-hidden">
          {saved.map(([url, entry], i) => (
            <div key={url} className="group relative flex items-center gap-4 px-4 py-4 sm:px-5">
              {i > 0 && <span aria-hidden className="pointer-events-none absolute left-[76px] right-0 top-0 h-px bg-border/80 sm:left-[80px]" />}
              <CompanyMonogram name={entry.company || entry.title || '?'} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-muted-foreground">{entry.company || 'Unknown company'}</p>
                <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.012em] text-foreground">{entry.title || 'Untitled role'}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">Saved {relativeTime(entry.updated_at)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <a href={url} target="_blank" rel="noreferrer" className={iconBtn} aria-label="Open posting">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button onClick={() => remove.mutate(url)} className={cn(iconBtn, 'hover:text-danger')} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => upsert.mutate({ url, status: 'applied', title: entry.title, company: entry.company })}
                  className="ml-1 gap-1"
                >
                  Applied <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </Reveal>
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
