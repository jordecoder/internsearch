import { cn } from '@/lib/utils';

// Quiet tones drawn from the palette — a monogram should identify, not decorate.
const TONES = [
  'bg-secondary text-secondary-foreground',
  'bg-hint-soft text-hint-soft-foreground',
  'bg-primary text-primary-foreground',
  'bg-warning-soft text-warning',
  'bg-success-soft text-success',
  'bg-accent text-foreground',
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string) {
  const words = name
    .replace(/\b(pte|ltd|inc|llc|limited|company|the|group|holdings|technologies|technology)\b\.?/gi, '')
    .split(/[\s&/-]+/)
    .filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, words[0].length <= 3 ? 3 : 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function CompanyMonogram({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  const tone = TONES[hash(name) % TONES.length];
  const text = initials(name || '?');
  return (
    <span
      aria-hidden
      className={cn('inline-flex flex-shrink-0 select-none items-center justify-center font-semibold tracking-[-0.02em]', tone, className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        fontSize: text.length > 2 ? size * 0.27 : size * 0.34,
        boxShadow: 'inset 0 0 0 1px hsl(var(--foreground) / 0.06)',
      }}
    >
      {text}
    </span>
  );
}
