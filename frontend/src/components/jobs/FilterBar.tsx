import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  { value: '85', label: '85%+ (strong)' },
  { value: '70', label: '70%+ (good)' },
  { value: '55', label: '55%+ (moderate)' },
];

const DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'score', label: 'Match score' },
  { value: 'company', label: 'Company A–Z' },
];

function isActive(filters: JobFilters): boolean {
  return (
    !!filters.search ||
    filters.category !== '__all__' ||
    filters.company !== '__all__' ||
    filters.source !== '__all__' ||
    filters.minScore !== '__all__' ||
    filters.datePosted !== '__all__'
  );
}

function FilterControls({ filters, onChange, categories, companies, sources, layout = 'row' }: Omit<FilterBarProps, 'resultCount'> & { layout?: 'row' | 'grid' }) {
  const sel = (label: string, value: string, key: keyof JobFilters, opts: { value: string; label: string }[]) => (
    <Select value={value} onValueChange={(v) => onChange({ ...filters, [key]: v })}>
      <SelectTrigger className={cn('h-9 text-sm', key !== 'sort' && value !== '__all__' && 'border-primary/60 bg-primary/5 text-primary')}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {key !== 'sort' && <SelectItem value="__all__">{label}</SelectItem>}
        {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className={layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
      {sel('All categories', filters.category, 'category', categories.map((c) => ({ value: c, label: c })))}
      {sel('All companies', filters.company, 'company', companies.map((c) => ({ value: c, label: c })))}
      {sel('All sources', filters.source, 'source', sources.map((c) => ({ value: c, label: c })))}
      {sel('Any match score', filters.minScore, 'minScore', MIN_SCORE_OPTIONS)}
      {sel('Any date', filters.datePosted, 'datePosted', DATE_OPTIONS)}
      {sel('Sort', filters.sort, 'sort', SORT_OPTIONS)}
    </div>
  );
}

export function FilterBar(props: FilterBarProps) {
  const { filters, onChange, resultCount } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const active = isActive(filters);

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

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search title or company  /"
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <Button variant="outline" size="sm" className="lg:hidden h-9 gap-1.5 flex-shrink-0" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </Button>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Filter jobs</SheetTitle>
            </SheetHeader>
            <div className="p-5 space-y-3">
              <FilterControls {...props} layout="grid" />
              {active && (
                <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} className="h-8 text-xs text-muted-foreground gap-1 px-2">
                  <X className="h-3 w-3" /> Reset filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap tabular-nums flex-shrink-0">
          {resultCount} listing{resultCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-2">
        <FilterControls {...props} />
        {active && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} className="h-9 text-xs text-muted-foreground gap-1 px-2 flex-shrink-0">
            <X className="h-3 w-3" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
