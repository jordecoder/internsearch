import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, sub, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card px-3.5 py-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />}
      </div>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums text-foreground leading-none"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[0.7rem] text-muted-foreground/80">{sub}</p>}
    </div>
  );
}
