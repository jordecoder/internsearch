import { matchTier, TIER_CLASSES } from '@/lib/match';
import { cn } from '@/lib/utils';

interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showRing?: boolean;
}

const SIZES = {
  sm: { box: 32, stroke: 3, text: 'text-[0.65rem]' },
  md: { box: 44, stroke: 3.5, text: 'text-xs' },
  lg: { box: 72, stroke: 4.5, text: 'text-lg' },
};

/** Compact circular match-score indicator with semantic tier coloring. */
export function MatchScore({ score, size = 'md', showRing = true }: MatchScoreProps) {
  const tier = matchTier(score);
  const classes = TIER_CLASSES[tier];
  const { box, stroke, text } = SIZES[size];

  if (!showRing) {
    return (
      <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 font-bold tabular-nums', classes.bg, classes.text, text)}>
        {score}%
      </span>
    );
  }

  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;

  return (
    <div className="relative flex-shrink-0" style={{ width: box, height: box }}>
      <svg width={box} height={box} className="-rotate-90">
        <circle cx={box / 2} cy={box / 2} r={r} strokeWidth={stroke} className="stroke-muted fill-none" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('fill-none transition-[stroke-dashoffset] duration-500', classes.ring)}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold tabular-nums text-foreground', text)}>
        {score}
      </span>
    </div>
  );
}
