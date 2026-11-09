import { WordReveal, type WordSegment } from '@/components/motion';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  /** Plain title, or segments for a two-tone headline. */
  title: string | (WordSegment | string)[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** 'hero' for the home page statement, 'title' for every other page. */
  size?: 'hero' | 'title';
  className?: string;
}

/** Large title block (iOS large-title scale). Collapses into the toolbar on scroll via AppShell. */
export function PageHeader({ eyebrow, title, description, actions, size = 'title', className }: PageHeaderProps) {
  const segments = typeof title === 'string' ? [title] : title;
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-8 gap-y-5', size === 'hero' ? 'pt-10 sm:pt-16 pb-10' : 'pt-8 sm:pt-12 pb-8', className)}>
      <div className="min-w-0 max-w-4xl">
        {eyebrow && (
          <div className="type-eyebrow mb-3 flex items-center gap-2 text-muted-foreground animate-fade-in">{eyebrow}</div>
        )}
        <WordReveal
          segments={segments}
          className={cn('text-foreground', size === 'hero' ? 'type-hero max-w-[30ch]' : 'type-title')}
        />
        {description && (
          <div
            className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-[17px] [animation:word-in_900ms_var(--ease-expo)_both]"
            style={{ animationDelay: '220ms' }}
          >
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 items-center gap-2 [animation:word-in_900ms_var(--ease-expo)_both]" style={{ animationDelay: '300ms' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
