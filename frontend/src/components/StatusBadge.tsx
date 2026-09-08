import { cn } from '@/lib/utils';
import type { BoardEntryStatus } from '@/types/job';

const STATUS_STYLE: Record<string, string> = {
  found: 'bg-muted text-muted-foreground border-border',
  tailoring: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900',
  applied: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-900',
  interviewing: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900',
  offer: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900',
  skipped: 'bg-muted text-muted-foreground/70 border-border',
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
