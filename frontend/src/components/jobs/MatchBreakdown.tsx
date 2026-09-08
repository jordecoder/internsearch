import { matchTier, TIER_CLASSES, matchRecommendation } from '@/lib/match';
import { cn } from '@/lib/utils';
import type { Score } from '@/types/job';

const DIMENSIONS: { key: keyof Omit<Score, 'overall' | 'timeline_match'>; label: string }[] = [
  { key: 'role', label: 'Role match' },
  { key: 'skill', label: 'Skills match' },
  { key: 'location', label: 'Location match' },
  { key: 'timeline', label: 'Timeline match' },
  { key: 'degree', label: 'Degree match' },
];

function DimensionBar({ label, value }: { label: string; value: number }) {
  const tier = matchTier(value);
  const classes = TIER_CLASSES[tier];
  return (
    <div className="flex items-center gap-3">
      <p className="w-28 flex-shrink-0 text-xs text-muted-foreground">{label}</p>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-[width] duration-500', classes.bar)} style={{ width: `${value}%` }} />
      </div>
      <p className="w-9 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">{value}%</p>
    </div>
  );
}

export function MatchBreakdown({ score }: { score: Score }) {
  const tier = matchTier(score.overall);
  const classes = TIER_CLASSES[tier];

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {DIMENSIONS.map((d) => (
          <DimensionBar key={d.key} label={d.label} value={score[d.key]} />
        ))}
      </div>
      <div className={cn('rounded-md border px-3 py-2.5 text-xs leading-relaxed', classes.bg, classes.text)}>
        {matchRecommendation(score)}
      </div>
    </div>
  );
}
