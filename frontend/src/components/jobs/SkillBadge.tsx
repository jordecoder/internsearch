import { cn } from '@/lib/utils';

export function SkillBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[12.5px] font-medium text-foreground/85',
        className,
      )}
    >
      {children}
    </span>
  );
}
