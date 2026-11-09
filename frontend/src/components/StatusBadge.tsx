import { cn } from '@/lib/utils';
import type { BoardEntryStatus } from '@/types/job';

const STATUS_STYLE: Record<string, string> = {
  found: 'bg-muted text-muted-foreground border-border',
  tailoring: 'bg-hint-soft text-hint-soft-foreground border-hint/25',
  applied: 'bg-secondary text-secondary-foreground border-border',
  interviewing: 'bg-warning-soft text-warning border-warning/25',
  offer: 'bg-success-soft text-success border-success/25',
  rejected: 'bg-danger-soft text-danger border-danger/25',
  skipped: 'bg-transparent text-muted-foreground border-border border-dashed',
};

const STATUS_LABEL: Record<string, string> = {
  found: 'Saved',
  tailoring: 'Tailoring',
  applied: 'Applied',
  interviewing: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  skipped: 'Skipped',
};

export function StatusBadge({ status, className }: { status: BoardEntryStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.68rem] font-semibold',
        STATUS_STYLE[status] ?? STATUS_STYLE.found,
        className,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
