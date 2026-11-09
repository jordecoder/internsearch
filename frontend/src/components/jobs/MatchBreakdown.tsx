import { matchRecommendation } from '@/lib/match';
import { Reveal } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Score } from '@/types/job';

const DIMENSIONS: { key: keyof Omit<Score, 'overall' | 'timeline_match'>; label: string }[] = [
  { key: 'role', label: 'Role' },
  { key: 'skill', label: 'Skills' },
  { key: 'location', label: 'Location' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'degree', label: 'Degree' },
];

/** Five dimension bars that grow in one after another, plus a one-line read. */
export function MatchBreakdown({ score, showRecommendation = true }: { score: Score; showRecommendation?: boolean }) {
  return (
    <Reveal className="space-y-5">
      <dl className="space-y-3">
        {DIMENSIONS.map((d, i) => {
          const v = score[d.key];
          return (
            <div key={d.key} className="grid grid-cols-[84px_1fr_40px] items-center gap-3 text-[13.5px]">
              <dt className="text-muted-foreground">{d.label}</dt>
              <dd className="h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
                <span
                  className={cn('grow-x block h-full rounded-full', v >= 70 ? 'bg-foreground/85' : v >= 50 ? 'bg-foreground/45' : 'bg-warning')}
                  style={{ width: `${v}%`, ['--seg' as string]: i }}
                />
              </dd>
              <dd className="text-right font-medium tabular-nums text-foreground">{v}%</dd>
            </div>
          );
        })}
      </dl>
      {showRecommendation && (
        <p className="text-[14px] leading-relaxed text-muted-foreground">{matchRecommendation(score)}</p>
      )}
    </Reveal>
  );
}
