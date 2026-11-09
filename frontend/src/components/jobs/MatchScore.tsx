import { matchTier, TIER_CLASSES } from '@/lib/match';
import { cn } from '@/lib/utils';
import { CountUp, useDrawOnView } from '@/components/motion';

interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showRing?: boolean;
  /** Draw the ring in when it first scrolls into view (default true). */
  animate?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: 30, stroke: 3, text: 'text-[10.5px]' },
  md: { box: 40, stroke: 3.5, text: 'text-[12px]' },
  lg: { box: 68, stroke: 5, text: 'text-[19px]' },
  xl: { box: 120, stroke: 8, text: 'text-[36px]' },
};

/** Circular match-score ring with semantic tier colour. The number is always shown, so tier never relies on colour alone. */
export function MatchScore({ score, size = 'md', showRing = true, animate = true, className }: MatchScoreProps) {
  const tier = matchTier(score);
  const classes = TIER_CLASSES[tier];
  const { box, stroke, text } = SIZES[size];
  const clamped = Math.min(100, Math.max(0, score));
  const draw = useDrawOnView(animate ? clamped : clamped, animate ? 140 : 0);
  const shown = animate ? draw.value : clamped;

  if (!showRing) {
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 font-semibold tabular-nums', classes.bg, classes.text, text, className)}>
        {score}%
      </span>
    );
  }

  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (shown / 100) * c;
  const big = size === 'lg' || size === 'xl';

  return (
    <div className={cn('relative flex-shrink-0', className)} style={{ width: box, height: box }} role="img" aria-label={`${score}% match`}>
      <svg ref={draw.ref} width={box} height={box} className="-rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={r} strokeWidth={stroke} className="fill-none stroke-foreground/[0.08]" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('fill-none transition-[stroke-dashoffset] ease-expo motion-reduce:transition-none', big ? 'duration-[1600ms]' : 'duration-[1100ms]', classes.ring)}
        />
      </svg>
      <span className={cn('absolute inset-0 flex flex-col items-center justify-center font-semibold tabular-nums tracking-[-0.03em] text-foreground', text)} aria-hidden>
        {size === 'xl' ? (
          <>
            <span className="leading-none">
              <CountUp value={score} duration={1600} delay={140} />
              <span className="ml-0.5 align-top text-[0.45em] font-medium text-muted-foreground">%</span>
            </span>
            <span className="mt-1.5 text-[11px] font-medium tracking-normal text-muted-foreground">match</span>
          </>
        ) : (
          score
        )}
      </span>
    </div>
  );
}
