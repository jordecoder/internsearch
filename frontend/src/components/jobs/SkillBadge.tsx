import { cn } from '@/lib/utils';

export function SkillBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
