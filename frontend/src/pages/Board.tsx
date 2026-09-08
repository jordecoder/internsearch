import { useState } from 'react';
import { Plus, Trash2, ExternalLink, GripVertical, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { MatchScore } from '@/components/jobs/MatchScore';
import { JobPicker } from '@/components/jobs/JobPicker';
import { RequireAuth } from '@/components/RequireAuth';
import { cn, relativeTime } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBoardQuery, useUpsertBoardEntry, useDeleteBoardEntry } from '@/hooks/useBoardQuery';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import type { BoardEntry, BoardStatus, Job } from '@/types/job';

const COLUMNS: { id: BoardStatus; label: string }[] = [
  { id: 'found', label: 'Saved' },
  { id: 'tailoring', label: 'Tailoring' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

function ApplicationCard({
  url,
  entry,
  matchScore,
  onSave,
  onDelete,
  onDragStart,
}: {
  url: string;
  entry: BoardEntry;
  matchScore?: number;
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
            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{entry.title || '(untitled)'}</p>
          )}
          {editing ? (
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="h-7 text-xs mt-1" />
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-xs text-muted-foreground truncate">{entry.company}</p>
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
        {matchScore !== undefined && <MatchScore score={matchScore} size="sm" />}
      </div>

      {editing ? (
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Notes…" />
      ) : (
        entry.notes && <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{entry.notes}</p>
      )}

      <div className="flex items-center justify-between pt-0.5">
        <p className="text-[0.65rem] text-muted-foreground/70">{relativeTime(entry.updated_at)}</p>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={save} className="text-[0.7rem] font-semibold text-primary hover:underline">Save</button>
            <button onClick={() => setEditing(false)} className="text-[0.7rem] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="text-[0.7rem] text-muted-foreground hover:text-foreground">Edit</button>
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddJobForm({
  jobs,
  excludeUrls,
  onAddFromList,
  onAddManual,
}: {
  jobs: Job[];
  excludeUrls: Set<string>;
  onAddFromList: (job: Job) => void;
  onAddManual: (url: string, title: string, company: string) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');

  if (manualOpen) {
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
                onAddManual(url.trim(), title.trim(), company.trim());
                setUrl(''); setTitle(''); setCompany('');
                setManualOpen(false);
              }}
            >
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setManualOpen(false)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      <JobPicker onSelect={onAddFromList} excludeUrls={excludeUrls}>
        <button
          disabled={jobs.length === 0}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border-2 border-dashed border-border hover:border-primary/50 rounded-lg py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ListPlus className="h-4 w-4" /> Choose a job from your listings
        </button>
      </JobPicker>
      <button
        onClick={() => setManualOpen(true)}
        className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground py-0.5"
      >
        <Plus className="h-3 w-3" /> or track a job not in your listings
      </button>
    </div>
  );
}

function BoardContent() {
  const { username } = useAuth();
  const { data: board, isLoading, error } = useBoardQuery(!!username);
  const { jobs } = useJobsQuery();
  const upsert = useUpsertBoardEntry();
  const remove = useDeleteBoardEntry();
  const [dragUrl, setDragUrl] = useState<string | null>(null);

  const scoreByUrl = new Map(jobs.map((j) => [j.url, j.score.overall]));
  const entries = Object.entries(board ?? {}).filter(([, e]) => e.status !== 'skipped');

  const grouped: Record<BoardStatus, [string, BoardEntry][]> = {
    found: [], tailoring: [], applied: [], interviewing: [], offer: [], rejected: [],
  };
  for (const [url, entry] of entries) {
    (grouped[entry.status as BoardStatus] ?? grouped.found).push([url, entry]);
  }
  for (const list of Object.values(grouped)) list.sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at));

  const totalApplications = entries.filter(([, e]) => e.status !== 'found').length;
  const interviews = grouped.interviewing.length;
  const offers = grouped.offer.length;
  const conversionRate = totalApplications > 0 ? Math.round((offers / totalApplications) * 100) : null;

  const saveEntry = (url: string, status: BoardStatus, notes: string, title: string, company: string) => {
    upsert.mutate({ url, status, notes, title, company });
  };

  if (isLoading) {
    return <div className="max-w-[100rem] mx-auto px-5 py-8 text-sm text-muted-foreground">Loading your pipeline…</div>;
  }
  if (error) {
    return <div className="max-w-[100rem] mx-auto px-5 py-8 text-sm text-destructive">Could not load your board. Try refreshing.</div>;
  }

  return (
    <div className="max-w-[100rem] mx-auto px-5 py-6 pb-20">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Application Board
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Drag cards between columns as your applications move.</p>
      </div>

      {totalApplications > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <StatCard label="Total applications" value={totalApplications} />
          <StatCard label="Interviews" value={interviews} />
          <StatCard label="Offers" value={offers} />
          <StatCard label="Conversion" value={conversionRate !== null ? `${conversionRate}%` : '—'} sub="offers / applications" />
        </div>
      )}

      <div className="relative">
        <div className="flex gap-3 items-start overflow-x-auto pb-4 -mx-5 px-5 sm:mx-0 sm:px-0">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragUrl && board?.[dragUrl] && board[dragUrl].status !== col.id) {
                  const entry = board[dragUrl];
                  saveEntry(dragUrl, col.id, entry.notes, entry.title ?? '', entry.company ?? '');
                }
                setDragUrl(null);
              }}
              className="space-y-2 w-[260px] flex-shrink-0"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</p>
                <span className="text-xs text-muted-foreground/60 tabular-nums">{grouped[col.id].length}</span>
              </div>
              <div className={cn('space-y-2 min-h-[80px] rounded-xl p-1.5 transition-colors', dragUrl && 'bg-muted/30')}>
                {grouped[col.id].map(([url, entry]) => (
                  <ApplicationCard
                    key={url}
                    url={url}
                    entry={entry}
                    matchScore={scoreByUrl.get(url)}
                    onDragStart={() => setDragUrl(url)}
                    onSave={(notes, title, company) => saveEntry(url, entry.status as BoardStatus, notes, title, company)}
                    onDelete={() => remove.mutate(url)}
                  />
                ))}
                {col.id === 'found' && (
                  <AddJobForm
                    jobs={jobs}
                    excludeUrls={new Set(entries.map(([url]) => url))}
                    onAddFromList={(job) => saveEntry(job.url, 'found', '', job.title, job.company)}
                    onAddManual={(url, title, company) => saveEntry(url, 'found', '', title, company)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-10 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>
    </div>
  );
}

export function Board() {
  return (
    <RequireAuth prompt="track your pipeline">
      <BoardContent />
    </RequireAuth>
  );
}
