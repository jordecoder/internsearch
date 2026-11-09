import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface JobFilters {
  search: string;
  category: string;
  company: string;
  source: string;
  minScore: string;
  datePosted: string;
  sort: string;
}

export const DEFAULT_FILTERS: JobFilters = {
  search: '',
  category: '__all__',
  company: '__all__',
  source: '__all__',
  minScore: '__all__',
  datePosted: '__all__',
  sort: 'newest',
};

interface FilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  categories: string[];
  companies: string[];
  sources: string[];
  resultCount: number;
}

const MIN_SCORE_OPTIONS = [
  { value: '85', label: '85%+ strong' },
  { value: '70', label: '70%+ good' },
  { value: '55', label: '55%+ moderate' },
];

const DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'score', label: 'Best match' },
  { value: 'company', label: 'A–Z' },
];

function activeCount(filters: JobFilters): number {
  return (['category', 'company', 'source', 'minScore', 'datePosted'] as const).filter((k) => filters[k] !== '__all__').length;
}

const pill =
  'h-10 rounded-full bg-card px-4 text-[14px] shadow-control hover:bg-accent/60 focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** A pill-shaped select; turns charcoal-on-sand inverted when a value is chosen. */
function PillSelect({
  value, onValueChange, placeholder, options, className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const active = value !== '__all__';
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(pill, 'w-auto gap-2 border-0', active && 'bg-primary text-primary-foreground hover:bg-primary/90 [&_svg]:text-primary-foreground', className)}
        aria-label={placeholder}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{`Any ${placeholder.toLowerCase()}`}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Apple-style segmented control with a sliding thumb. */
export function Segmented({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);
  useEffect(() => {
    // Enable the slide only after the first placement, so it doesn't fly in on load.
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div role="radiogroup" aria-label={label} className="relative inline-flex h-10 items-center rounded-full bg-foreground/[0.06] p-1">
      {thumb && (
        <span
          aria-hidden
          className={cn('absolute top-1 bottom-1 rounded-full bg-card shadow-control', ready && 'transition-[left,width] duration-400 ease-spring')}
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(el) => { refs.current[o.value] = el; }}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 h-8 rounded-full px-4 text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-160',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar(props: FilterBarProps) {
  const { filters, onChange, categories, companies, sources } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const more = (['company', 'source', 'datePosted'] as const).filter((k) => filters[k] !== '__all__').length;
  const anyActive = activeCount(filters) > 0 || filters.search !== '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const set = (patch: Partial<JobFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="group relative flex h-10 min-w-[200px] flex-1 items-center rounded-full bg-card shadow-control transition-shadow duration-160 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
        <input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search roles or companies"
          aria-label="Search roles or companies"
          className="h-full w-full rounded-full bg-transparent pl-10 pr-9 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {filters.search ? (
          <button
            onClick={() => set({ search: '' })}
            aria-label="Clear search"
            className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/[0.08] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3.5 hidden font-sans text-[12px] text-muted-foreground sm:block">/</kbd>
        )}
      </label>

      <div className="hidden items-center gap-2.5 md:flex">
        <PillSelect value={filters.category} onValueChange={(v) => set({ category: v })} placeholder="Category" options={categories.map((c) => ({ value: c, label: c }))} />
        <PillSelect value={filters.minScore} onValueChange={(v) => set({ minScore: v })} placeholder="Match" options={MIN_SCORE_OPTIONS} />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <button
          onClick={() => setSheetOpen(true)}
          className={cn('pressable inline-flex flex-shrink-0 items-center gap-2', pill, more > 0 && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filters</span>
          {more > 0 && <span className="text-[12px] font-semibold tabular-nums">{more}</span>}
        </button>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
            <div className="contents md:hidden">
              <PillSelect value={filters.category} onValueChange={(v) => set({ category: v })} placeholder="Category" options={categories.map((c) => ({ value: c, label: c }))} className="w-full justify-between" />
              <PillSelect value={filters.minScore} onValueChange={(v) => set({ minScore: v })} placeholder="Match" options={MIN_SCORE_OPTIONS} className="w-full justify-between" />
            </div>
            <PillSelect value={filters.company} onValueChange={(v) => set({ company: v })} placeholder="Company" options={companies.map((c) => ({ value: c, label: c }))} className="w-full justify-between" />
            <PillSelect value={filters.source} onValueChange={(v) => set({ source: v })} placeholder="Source" options={sources.map((c) => ({ value: c, label: c }))} className="w-full justify-between" />
            <PillSelect value={filters.datePosted} onValueChange={(v) => set({ datePosted: v })} placeholder="Date posted" options={DATE_OPTIONS} className="w-full justify-between" />
          </div>
          {anyActive && (
            <div className="px-6 pb-6">
              <button onClick={() => onChange(DEFAULT_FILTERS)} className="pressable inline-flex items-center gap-1.5 text-[14px] font-medium text-hint hover:underline">
                <X className="h-4 w-4" /> Clear all filters
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {anyActive && (
        <button
          onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
          className="pressable hidden h-10 items-center gap-1 rounded-full px-3 text-[13.5px] font-medium text-hint hover:bg-hint/10 lg:inline-flex"
        >
          Clear
        </button>
      )}

      <div className="ml-auto">
        <Segmented label="Sort" value={filters.sort} onChange={(v) => set({ sort: v })} options={SORT_OPTIONS} />
      </div>
    </div>
  );
}
