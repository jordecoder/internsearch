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
  { value: 'score', label: 'Match score' },
  { value: 'company', label: 'Company A–Z' },
];

function activeCount(filters: JobFilters): number {
  let n = 0;
  if (filters.category !== '__all__') n++;
  if (filters.company !== '__all__') n++;
  if (filters.source !== '__all__') n++;
  if (filters.minScore !== '__all__') n++;
  if (filters.datePosted !== '__all__') n++;
  return n;
}

/** A compact select — fixed width, short placeholder, no "always styled active" issue for sort. */
function CompactSelect({
  value, onValueChange, placeholder, options, width = 'w-[108px]', showAll = true,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  width?: string;
  showAll?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('h-9 text-sm', width, value !== '__all__' && showAll && 'border-primary/60 bg-primary/5 text-primary')}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showAll && <SelectItem value="__all__">{placeholder}</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function MoreFilters({ filters, onChange, companies, sources }: Pick<FilterBarProps, 'filters' | 'onChange' | 'companies' | 'sources'>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <CompactSelect
        value={filters.company}
        onValueChange={(v) => onChange({ ...filters, company: v })}
        placeholder="Company"
        options={companies.map((c) => ({ value: c, label: c }))}
        width="w-full"
      />
      <CompactSelect
        value={filters.source}
        onValueChange={(v) => onChange({ ...filters, source: v })}
        placeholder="Source"
        options={sources.map((c) => ({ value: c, label: c }))}
        width="w-full"
      />
      <CompactSelect
        value={filters.datePosted}
        onValueChange={(v) => onChange({ ...filters, datePosted: v })}
        placeholder="Date posted"
        options={DATE_OPTIONS}
        width="w-full"
      />
    </div>
  );
}

export function FilterBar(props: FilterBarProps) {
  const { filters, onChange, categories, companies, sources, resultCount } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const more = activeCount(filters) - (filters.category !== '__all__' ? 1 : 0) - (filters.minScore !== '__all__' ? 1 : 0);

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

  const anyActive = activeCount(filters) > 0;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[160px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search  /"
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <CompactSelect
          value={filters.category}
          onValueChange={(v) => onChange({ ...filters, category: v })}
          placeholder="Category"
          options={categories.map((c) => ({ value: c, label: c }))}
          width="w-[130px]"
        />
        <CompactSelect
          value={filters.minScore}
          onValueChange={(v) => onChange({ ...filters, minScore: v })}
          placeholder="Match score"
          options={MIN_SCORE_OPTIONS}
          width="w-[122px]"
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-shrink-0" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">More</span>
          {more > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
              {more}
            </span>
          )}
        </Button>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filter jobs</SheetTitle>
          </SheetHeader>
          <div className="p-5 space-y-3">
            {/* On small screens where Category/Score are hidden inline, show them here too */}
            <div className="sm:hidden grid grid-cols-2 gap-2">
              <CompactSelect
                value={filters.category}
                onValueChange={(v) => onChange({ ...filters, category: v })}
                placeholder="Category"
                options={categories.map((c) => ({ value: c, label: c }))}
                width="w-full"
              />
              <CompactSelect
                value={filters.minScore}
                onValueChange={(v) => onChange({ ...filters, minScore: v })}
                placeholder="Match score"
                options={MIN_SCORE_OPTIONS}
                width="w-full"
              />
            </div>
            <MoreFilters filters={filters} onChange={onChange} companies={companies} sources={sources} />
            {anyActive && (
              <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} className="h-8 text-xs text-muted-foreground gap-1 px-2">
                <X className="h-3 w-3" /> Reset filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CompactSelect
        value={filters.sort}
        onValueChange={(v) => onChange({ ...filters, sort: v })}
        placeholder="Sort"
        options={SORT_OPTIONS}
        width="w-[108px]"
        showAll={false}
      />

      {anyActive && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="hidden lg:inline-flex items-center gap-1 h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Reset
        </button>
      )}

      <span className="hidden md:inline text-xs text-muted-foreground whitespace-nowrap tabular-nums ml-auto flex-shrink-0">
        {resultCount} listing{resultCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
