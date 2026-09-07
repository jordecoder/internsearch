import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Trash2, ExternalLink, GripVertical, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import type { BoardEntry, BoardStatus } from '@/types/job';

const COLUMNS: { id: BoardStatus; label: string }[] = [
  { id: 'found', label: 'Found' },
  { id: 'tailoring', label: 'Tailoring' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

interface BoardMap {
  [url: string]: BoardEntry;
}

function BoardCard({
  url,
  entry,
  onSave,
  onDelete,
  onDragStart,
}: {
  url: string;
  entry: BoardEntry;
  onSave: (notes: string, title: string, company: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(entry.notes);
  const [title, setTitle] = useState(entry.title ?? '');
  const [company, setCompany] = useState(entry.company ?? '');

  const save = () => {
    onSave(notes, title, company);
    setEditing(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-lg border border-border bg-card p-3 space-y-1.5 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-7 text-xs mb-1" />
          ) : (
            <p className="text-sm font-medium text-foreground truncate">{entry.title || '(untitled)'}</p>
          )}
          {editing ? (
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="h-7 text-xs" />
          ) : (
            <p className="text-xs text-muted-foreground truncate">{entry.company}</p>
          )}
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {editing ? (
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Notes…" />
      ) : (
        entry.notes && <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{entry.notes}</p>
      )}

      <div className="flex items-center justify-between pt-0.5">
        {editing ? (
          <div className="flex gap-2">
            <button onClick={save} className="text-[0.7rem] font-semibold text-primary hover:underline">Save</button>
            <button onClick={() => setEditing(false)} className="text-[0.7rem] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-[0.7rem] text-muted-foreground hover:text-foreground">Edit</button>
        )}
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function AddJobForm({ onAdd }: { onAdd: (url: string, title: string, company: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border-2 border-dashed border-border hover:border-primary/50 rounded-xl py-3 transition-colors"
      >
        <Plus className="h-4 w-4" /> Add a job to track
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Job URL" className="text-sm" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="text-sm" />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="text-sm" />
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            disabled={!url.trim()}
            onClick={() => {
              onAdd(url.trim(), title.trim(), company.trim());
              setUrl(''); setTitle(''); setCompany('');
              setOpen(false);
            }}
          >
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function Board() {
  const { username, loading: authLoading, logout } = useAuth();
  const [board, setBoard] = useState<BoardMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragUrl, setDragUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    api
      .getBoard()
      .then((r) => setBoard(r.jobs))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [username]);

  const grouped = useMemo(() => {
    const g: Record<BoardStatus, [string, BoardEntry][]> = { found: [], tailoring: [], applied: [], interviewing: [], offer: [], rejected: [] };
    for (const [url, entry] of Object.entries(board)) {
      if (!(entry.status in g)) continue; // legacy 'skipped' status, no longer a board column
      (g[entry.status as BoardStatus] ?? g.found).push([url, entry]);
    }
    for (const list of Object.values(g)) list.sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at));
    return g;
  }, [board]);

  const saveEntry = async (url: string, status: BoardStatus, notes: string, title: string, company: string) => {
    const prev = board;
    setBoard((b) => ({ ...b, [url]: { ...b[url], status, notes, title, company, updated_at: new Date().toISOString() } }));
    try {
      const res = await api.upsertBoardEntry({ url, status, notes, title, company });
      setBoard(res.jobs);
    } catch (e) {
      setBoard(prev);
      setError((e as Error).message);
    }
  };

  const deleteEntry = async (url: string) => {
    const prev = board;
    setBoard((b) => {
      const next = { ...b };
      delete next[url];
      return next;
    });
    try {
      const res = await api.deleteBoardEntry(url);
      setBoard(res.jobs);
    } catch (e) {
      setBoard(prev);
      setError((e as Error).message);
    }
  };

  if (authLoading || (loading && username)) {
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
            <p className="text-sm text-foreground font-medium">Log in to track your pipeline</p>
            <p className="text-xs text-muted-foreground">
              The board syncs across devices, so it needs an account.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Log in / Register</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[100rem] mx-auto px-5 py-8 pb-20">
      <div className="mb-6 flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            Pipeline Board
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Drag cards between columns as your applications move.</p>
        </div>
        <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <LogOut className="h-3 w-3" /> Log out ({username})
        </button>
      </div>

      {error && (
        <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragUrl && board[dragUrl] && board[dragUrl].status !== col.id) {
                const entry = board[dragUrl];
                saveEntry(dragUrl, col.id, entry.notes, entry.title ?? '', entry.company ?? '');
              }
              setDragUrl(null);
            }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</p>
              <span className="text-xs text-muted-foreground/60 tabular-nums">{grouped[col.id].length}</span>
            </div>
            <div className={cn('space-y-2 min-h-[80px] rounded-xl p-1.5 transition-colors', dragUrl && 'bg-muted/30')}>
              {grouped[col.id].map(([url, entry]) => (
                <BoardCard
                  key={url}
                  url={url}
                  entry={entry}
                  onDragStart={() => setDragUrl(url)}
                  onSave={(notes, title, company) => saveEntry(url, entry.status as BoardStatus, notes, title, company)}
                  onDelete={() => deleteEntry(url)}
                />
              ))}
              {col.id === 'found' && (
                <AddJobForm onAdd={(url, title, company) => saveEntry(url, 'found', '', title, company)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
