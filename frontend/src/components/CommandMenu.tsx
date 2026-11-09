import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  Briefcase, Bookmark, Kanban, Sparkles, MessagesSquare, Settings, Search, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobsQuery } from '@/hooks/useJobsQuery';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The search bar button this dropdown anchors to. */
  anchor: React.ReactNode;
}

const PAGES = [
  { to: '/', label: 'Jobs', icon: Briefcase },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/board', label: 'Application Board', icon: Kanban },
  { to: '/apply', label: 'Apply Agent', icon: Sparkles },
  { to: '/interview', label: 'Interview Prep', icon: MessagesSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Anchored search dropdown — appears directly under the search bar it's
 * attached to, like a conventional search/autocomplete dropdown (not a
 * centered command-palette overlay).
 */
export function CommandMenu({ open, onOpenChange, anchor }: CommandMenuProps) {
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
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{anchor}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          className="material-popover z-50 w-[min(520px,92vw)] overflow-hidden rounded-[18px] text-popover-foreground shadow-float"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5">
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              placeholder="Search jobs or jump to a page…"
              className="flex-1 bg-transparent text-[17px] tracking-[-0.012em] text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">esc</kbd>
          </div>

          <div className="max-h-[380px] overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-[14px] text-muted-foreground">No results for "{query}"</p>
            )}

            {filteredPages.length > 0 && (
              <div className="mb-1">
                <p className="px-2.5 pb-1 pt-2 text-[12px] font-semibold text-muted-foreground">Pages</p>
                {filteredPages.map((p) => {
                  const idx = results.findIndex((r) => r.type === 'page' && r.to === p.to);
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.to}
                      onClick={() => go(p.to)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-[14px] text-left',
                        idx === activeIndex ? 'bg-hint text-hint-foreground [&_svg]:text-hint-foreground [&_span]:text-hint-foreground' : 'text-foreground',
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
                <p className="px-2.5 pb-1 pt-2 text-[12px] font-semibold text-muted-foreground">Jobs</p>
                {filteredJobs.map((j) => {
                  const to = `/?job=${encodeURIComponent(j.stable_id)}`;
                  const idx = results.findIndex((r) => r.type === 'job' && r.to === to);
                  return (
                    <button
                      key={j.stable_id}
                      onClick={() => go(to)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-[14px] text-left',
                        idx === activeIndex ? 'bg-hint text-hint-foreground [&_svg]:text-hint-foreground [&_span]:text-hint-foreground' : 'text-foreground',
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
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
