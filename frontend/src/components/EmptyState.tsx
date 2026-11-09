import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('tile flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-secondary shadow-control">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
