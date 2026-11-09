import { cn } from '@/lib/utils';
import type { BoardEntryStatus } from '@/types/job';

// Soft pill + matching dot. Text label always present, so status never relies on colour.
const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  found:        { pill: 'bg-secondary text-secondary-foreground', dot: 'bg-muted-foreground' },
  tailoring:    { pill: 'bg-hint-soft text-hint-soft-foreground', dot: 'bg-hint' },
  applied:      { pill: 'bg-secondary text-secondary-foreground', dot: 'bg-foreground' },
  interviewing: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  offer:        { pill: 'bg-success-soft text-success', dot: 'bg-success' },
  rejected:     { pill: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  skipped:      { pill: 'bg-transparent text-muted-foreground ring-1 ring-inset ring-border', dot: 'bg-muted-foreground/60' },
};

export const STATUS_LABEL: Record<string, string> = {
  found: 'Saved',
  tailoring: 'Tailoring',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  skipped: 'Skipped',
};

export function StatusBadge({ status, className }: { status: BoardEntryStatus; className?: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.found;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-medium', s.pill, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
