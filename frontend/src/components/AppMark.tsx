import { cn } from '@/lib/utils';

/**
 * Intern Scout app icon: charcoal squircle, sand lens, periwinkle handle.
 * Fixed brand colours (same as the favicon) — it does not invert with the theme.
 */
export function AppMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('relative inline-flex flex-shrink-0 items-center justify-center', className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(160deg, #3A3834 0%, #22211F 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.12)',
      }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size * 0.8} height={size * 0.8} fill="none">
        <circle cx="14" cy="14" r="6.2" stroke="#F3EEE5" strokeWidth="2.6" />
        <path d="M18.6 18.6 24 24" stroke="#8FB2F2" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
