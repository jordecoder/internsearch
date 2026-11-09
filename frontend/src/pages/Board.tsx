import { Fragment, useState } from 'react';
import { Plus, Trash2, ExternalLink, ListPlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MatchScore } from '@/components/jobs/MatchScore';
import { JobPicker } from '@/components/jobs/JobPicker';
import { RequireAuth } from '@/components/RequireAuth';
import { PageHeader } from '@/components/PageHeader';
import { CountUp, Reveal } from '@/components/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, relativeTime } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBoardQuery, useUpsertBoardEntry, useDeleteBoardEntry } from '@/hooks/useBoardQuery';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import type { BoardEntry, BoardStatus, Job } from '@/types/job';

const COLUMNS: { id: BoardStatus; label: string; dot: string }[] = [
  { id: 'found', label: 'Saved', dot: 'bg-muted-foreground' },
  { id: 'tailoring', label: 'Tailoring', dot: 'bg-hint' },
  { id: 'applied', label: 'Applied', dot: 'bg-foreground' },
  { id: 'interviewing', label: 'Interviewing', dot: 'bg-warning' },
  { id: 'offer', label: 'Offer', dot: 'bg-success' },
  { id: 'rejected', label: 'Rejected', dot: 'bg-danger' },
];

const iconBtn =
  'pressable flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ApplicationCard({
  url, entry, matchScore, onSave, onDelete, onDragStart, onDragEnd,
}: {
  url: string;
  entry: BoardEntry;
  matchScore?: number;
  onSave: (notes: string, title: string, company: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(entry.notes);
  const [title, setTitle] = useState(entry.title ?? '');
  const [company, setCompany] = useState(entry.company ?? '');

  const save = () => {
    onSave(notes, title, company);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-[16px] bg-card p-3 shadow-tile">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-9 text-[14px]" aria-label="Title" />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="h-9 text-[14px]" aria-label="Company" />
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="min-h-[72px] resize-none text-[14px]" placeholder="Notes" aria-label="Notes" />
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group cursor-grab rounded-[16px] bg-card p-3.5 shadow-tile active:cursor-grabbing',
        'transition-[transform,box-shadow] duration-160 ease-out active:scale-[0.98] [@media(hover:hover)]:hover:shadow-float',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{entry.title || 'Untitled role'}</p>
          <div className="mt-1 flex items-center gap-1">
            <p className="truncate text-[12.5px] text-muted-foreground">{entry.company || 'Unknown company'}</p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label="Open posting"
                className="flex-shrink-0 rounded text-muted-foreground transition-colors hover:text-hint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
        {matchScore !== undefined && <MatchScore score={matchScore} size="sm" />}
      </div>

      {entry.notes && <p className="mt-2.5 line-clamp-3 text-[13px] leading-snug text-muted-foreground">{entry.notes}</p>}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">{relativeTime(entry.updated_at)}</p>
        <div className="flex items-center gap-0.5 transition-opacity duration-160 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
          <button onClick={() => setEditing(true)} className={iconBtn} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className={cn(iconBtn, 'hover:text-danger')} aria-label="Remove from board">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddJobForm({
  jobs, excludeUrls, onAddFromList, onAddManual,
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
      <div className="space-y-2 rounded-[16px] bg-card p-3 shadow-tile">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Job URL" className="h-9 text-[14px]" aria-label="Job URL" autoFocus />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-9 text-[14px]" aria-label="Title" />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="h-9 text-[14px]" aria-label="Company" />
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setManualOpen(false)}>Cancel</Button>
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <JobPicker onSelect={onAddFromList} excludeUrls={excludeUrls}>
        <button
          disabled={jobs.length === 0}
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-foreground/15 text-[13.5px] font-medium text-muted-foreground',
            'transition-[transform,background-color,border-color,color] duration-160 ease-out hover:border-foreground/25 hover:bg-card/70 hover:text-foreground enabled:active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <ListPlus className="h-4 w-4" /> Add from your listings
        </button>
      </JobPicker>
      <button
        onClick={() => setManualOpen(true)}
        className="pressable flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Track a job from elsewhere
      </button>
    </div>
  );
}

function StatStrip({ stats }: { stats: { label: string; value: number; suffix?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:items-stretch sm:gap-0">
      {stats.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && <span aria-hidden className="mx-6 hidden w-px self-stretch bg-border sm:block" />}
          <div className="min-w-[96px]">
            <dd className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground">
              <CountUp value={s.value} delay={i * 80} />
              {s.suffix && <span className="text-[20px] font-medium text-muted-foreground">{s.suffix}</span>}
            </dd>
            <dt className="mt-1.5 text-[13px] text-muted-foreground">{s.label}</dt>
          </div>
        </Fragment>
      ))}
    </dl>
  );
}

function BoardContent() {
  const { username } = useAuth();
  const { data: board, isLoading, error } = useBoardQuery(!!username);
  const { jobs } = useJobsQuery();
  const upsert = useUpsertBoardEntry();
  const remove = useDeleteBoardEntry();
  const [dragUrl, setDragUrl] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<BoardStatus | null>(null);

  const scoreByUrl = new Map(jobs.map((j) => [j.url, j.score.overall]));
  const entries = Object.entries(board ?? {}).filter(([, e]) => e.status !== 'skipped');

  const grouped: Record<BoardStatus, [string, BoardEntry][]> = {
    found: [], tailoring: [], applied: [], interviewing: [], offer: [], rejected: [],
  };
  for (const [url, entry] of entries) {
    (grouped[entry.status as BoardStatus] ?? grouped.found).push([url, entry]);
  }
  for (const list of Object.values(grouped)) list.sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at));

  const totalApplications = entries.filter(([, e]) => e.status !== 'found' && e.status !== 'tailoring').length;
  const interviews = grouped.interviewing.length;
  const offers = grouped.offer.length;
  const conversionRate = totalApplications > 0 ? Math.round((offers / totalApplications) * 100) : 0;

  const saveEntry = (url: string, status: BoardStatus, notes: string, title: string, company: string) => {
    upsert.mutate({ url, status, notes, title, company });
  };

  const header = (
    <PageHeader
      eyebrow="Track"
      title={[{ text: 'Board.' }, { text: ' Drag a card when things move.', className: 'text-muted-foreground' }]}
    />
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        {header}
        <div className="flex gap-4 overflow-hidden">
          {COLUMNS.slice(0, 5).map((c) => <Skeleton key={c.id} className="h-[420px] w-[272px] flex-shrink-0 rounded-[22px]" />)}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        {header}
        <p className="text-[15px] text-danger">Couldn't load your board. Try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-24 sm:px-8">
      {header}

      {totalApplications > 0 && (
        <Reveal className="mb-10">
          <StatStrip
            stats={[
              { label: 'Applications sent', value: totalApplications },
              { label: interviews === 1 ? 'Interview' : 'Interviews', value: interviews },
              { label: offers === 1 ? 'Offer' : 'Offers', value: offers },
              { label: 'Offer rate', value: conversionRate, suffix: '%' },
            ]}
          />
        </Reveal>
      )}

      <div className="relative -mx-5 sm:-mx-8">
        <div className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto scroll-px-5 px-5 pb-6 sm:scroll-px-8 sm:px-8">
          {COLUMNS.map((col, ci) => {
            const items = grouped[col.id];
            const isOver = dragUrl !== null && overCol === col.id && board?.[dragUrl]?.status !== col.id;
            return (
              <Reveal
                key={col.id}
                index={ci}
                as="section"
                aria-label={col.label}
                onDragOver={(e: React.DragEvent) => { e.preventDefault(); if (overCol !== col.id) setOverCol(col.id); }}
                onDragLeave={(e: React.DragEvent) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === col.id ? null : c));
                }}
                onDrop={(e: React.DragEvent) => {
                  e.preventDefault();
                  if (dragUrl && board?.[dragUrl] && board[dragUrl].status !== col.id) {
                    const entry = board[dragUrl];
                    saveEntry(dragUrl, col.id, entry.notes, entry.title ?? '', entry.company ?? '');
                  }
                  setDragUrl(null);
                  setOverCol(null);
                }}
                className={cn(
                  'w-[272px] flex-shrink-0 snap-start rounded-[22px] bg-foreground/[0.035] p-2',
                  'transition-[background-color,box-shadow] duration-250 ease-out',
                  isOver && 'bg-hint-soft/70 shadow-[inset_0_0_0_2px_hsl(var(--hint)/0.35)]',
                )}
              >
                <header className="flex items-center gap-2 px-2.5 pb-2.5 pt-2">
                  <span className={cn('h-2 w-2 rounded-full', col.dot)} aria-hidden />
                  <h2 className="flex-1 text-[14px] font-semibold tracking-[-0.01em] text-foreground">{col.label}</h2>
                  <span className="min-w-[24px] rounded-full bg-foreground/[0.06] px-2 py-0.5 text-center text-[12px] font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </header>
                <div className="min-h-[96px] space-y-2">
                  {items.map(([url, entry]) => (
                    <ApplicationCard
                      key={url}
                      url={url}
                      entry={entry}
                      matchScore={scoreByUrl.get(url)}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragUrl(url); }}
                      onDragEnd={() => { setDragUrl(null); setOverCol(null); }}
                      onSave={(notes, title, company) => saveEntry(url, entry.status as BoardStatus, notes, title, company)}
                      onDelete={() => remove.mutate(url)}
                    />
                  ))}
                  {items.length === 0 && col.id !== 'found' && (
                    <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">Drop a card here</p>
                  )}
                  {col.id === 'found' && (
                    <AddJobForm
                      jobs={jobs}
                      excludeUrls={new Set(entries.map(([url]) => url))}
                      onAddFromList={(job) => saveEntry(job.url, 'found', '', job.title, job.company)}
                      onAddManual={(url, title, company) => saveEntry(url, 'found', '', title, company)}
                    />
                  )}
                </div>
              </Reveal>
            );
          })}
          <span aria-hidden className="w-px flex-shrink-0" />
        </div>
        {/* Edge fade: makes it obvious the lanes keep going */}
        <div aria-hidden className="pointer-events-none absolute bottom-6 right-0 top-0 w-16 bg-gradient-to-l from-background to-transparent" />
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
