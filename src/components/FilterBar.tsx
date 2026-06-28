import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  search: string;
  source: string;
  actionable: string;
  sort: string;
  sources: string[];
  resultCount: number;
  onSearch: (v: string) => void;
  onSource: (v: string) => void;
  onActionable: (v: string) => void;
  onSort: (v: string) => void;
}

export function FilterBar({
  search, source, actionable, sort,
  sources, resultCount,
  onSearch, onSource, onActionable, onSort,
}: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  /* '/' shortcut to focus search */
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

  const sel = (label: string, value: string, onChange: (v: string) => void, opts: { value: string; label: string }[]) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(
        'h-9 w-auto min-w-[130px] text-sm',
        value !== '__all__' && 'border-primary/60 bg-primary/5 text-primary dark:text-primary',
      )}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{label}</SelectItem>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search title or company  /"
          className="pl-9 h-9 text-sm"
        />
      </div>

      {sel('All sources', source, onSource,
        sources.map((s) => ({ value: s, label: s })))}

      {sel('All listings', actionable, onActionable, [
        { value: 'actionable', label: 'Actionable only' },
        { value: 'notified',   label: 'Notified only' },
      ])}

      {sel('Newest first', sort, onSort, [
        { value: 'score',   label: 'Top score' },
        { value: 'company', label: 'Company A–Z' },
      ])}

      {resultCount > 0 && (
        <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          {resultCount} listing{resultCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
