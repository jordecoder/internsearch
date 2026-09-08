import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Briefcase, Bookmark, Kanban, FileEdit, Mail, MessagesSquare, Settings, Search, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobsQuery } from '@/hooks/useJobsQuery';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGES = [
  { to: '/', label: 'Jobs', icon: Briefcase },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/board', label: 'Application Board', icon: Kanban },
  { to: '/tailor', label: 'Resume Tailor', icon: FileEdit },
  { to: '/cover-letter', label: 'Cover Letter', icon: Mail },
  { to: '/interview', label: 'Interview Prep', icon: MessagesSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { jobs } = useJobsQuery();

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const filteredPages = useMemo(
    () => (q ? PAGES.filter((p) => p.label.toLowerCase().includes(q)) : PAGES),
    [q],
  );

  const filteredJobs = useMemo(() => {
    if (!q) return [];
    return jobs.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(q)).slice(0, 6);
  }, [q, jobs]);

  const results = useMemo(
    () => [
      ...filteredPages.map((p) => ({ type: 'page' as const, ...p })),
      ...filteredJobs.map((j) => ({ type: 'job' as const, to: `/?job=${encodeURIComponent(j.stable_id)}`, label: j.title, sub: j.company })),
    ],
    [filteredPages, filteredJobs],
  );

  const go = (to: string) => {
    navigate(to);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      go(results[activeIndex].to);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 rounded-lg border border-border bg-popover shadow-xl data-[state=open]:animate-fade-up"
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              placeholder="Search jobs or jump to a page…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="text-[0.65rem] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for "{query}"</p>
            )}

            {filteredPages.length > 0 && (
              <div className="mb-1">
                <p className="px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Pages</p>
                {filteredPages.map((p) => {
                  const idx = results.findIndex((r) => r.type === 'page' && r.to === p.to);
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.to}
                      onClick={() => go(p.to)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors',
                        idx === activeIndex ? 'bg-accent text-foreground' : 'text-foreground/90',
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredJobs.length > 0 && (
              <div>
                <p className="px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70">Jobs</p>
                {filteredJobs.map((j) => {
                  const to = `/?job=${encodeURIComponent(j.stable_id)}`;
                  const idx = results.findIndex((r) => r.type === 'job' && r.to === to);
                  return (
                    <button
                      key={j.stable_id}
                      onClick={() => go(to)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors',
                        idx === activeIndex ? 'bg-accent text-foreground' : 'text-foreground/90',
                      )}
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{j.title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{j.company}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
