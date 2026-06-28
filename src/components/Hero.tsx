import { relativeTime } from '@/lib/utils';
import type { Job } from '@/types/job';

interface HeroProps {
  jobs: Job[];
  exportedAt: string | null;
}

function StatBlock({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="flex flex-col animate-fade-up" style={{ animationFillMode: 'both' }}>
      <span
        className="text-[2.2rem] font-light tabular-nums leading-none text-foreground"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[0.67rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 text-[0.63rem] text-muted-foreground/60">{sub}</span>
    </div>
  );
}

export function Hero({ jobs, exportedAt }: HeroProps) {
  const actionable = jobs.filter((j) => j.actionable).length;
  const notified   = jobs.filter((j) => j.notified).length;
  const newToday   = jobs.filter((j) => Date.now() - new Date(j.first_seen_time).getTime() < 86_400_000).length;

  return (
    <div className="relative overflow-hidden" style={{
      background: 'linear-gradient(140deg, hsl(144 30% 94%) 0%, hsl(270 20% 94%) 45%, hsl(35 30% 94%) 100%)',
    }}>
      {/* Dark mode gradient overlay */}
      <div className="absolute inset-0 hidden dark:block" style={{
        background: 'linear-gradient(140deg, hsl(144 20% 8%) 0%, hsl(270 15% 8%) 45%, hsl(35 18% 8%) 100%)',
      }} />

      {/* Orbs */}
      <div className="absolute pointer-events-none" style={{
        width: 480, height: 480, top: -120, left: -80, borderRadius: '50%', filter: 'blur(72px)',
        background: 'radial-gradient(circle, rgba(90,170,110,0.28) 0%, transparent 70%)',
        animation: 'orb-1 26s ease-in-out infinite',
      }} />
      <div className="absolute pointer-events-none dark:opacity-70" style={{
        width: 380, height: 380, top: 0, right: '5%', borderRadius: '50%', filter: 'blur(72px)',
        background: 'radial-gradient(circle, rgba(150,120,210,0.22) 0%, transparent 70%)',
        animation: 'orb-2 32s ease-in-out infinite',
      }} />
      <div className="absolute pointer-events-none" style={{
        width: 300, height: 300, bottom: -60, left: '38%', borderRadius: '50%', filter: 'blur(72px)',
        background: 'radial-gradient(circle, rgba(220,165,80,0.18) 0%, transparent 70%)',
        animation: 'orb-3 22s ease-in-out infinite',
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-5">
        {/* Updated timestamp */}
        {exportedAt && (
          <p className="pt-1 text-[0.7rem] text-right text-muted-foreground/70">
            Updated {relativeTime(exportedAt)}
          </p>
        )}

        {/* Title */}
        <div className="pt-5 pb-4">
          <h1
            className="text-[2.8rem] sm:text-[3.6rem] font-extrabold leading-[1.05] tracking-tight text-foreground"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            Intern Scout
          </h1>
          <p className="mt-2.5 text-[0.92rem] text-muted-foreground leading-relaxed max-w-xs">
            Singapore tech internships,<br />discovered and scored daily.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4 pb-8">
          <StatBlock value={jobs.length} label="Listings"   sub="last 14 days" />
          <div className="self-stretch w-px bg-border opacity-50" />
          <StatBlock value={newToday}    label="New today"  sub="past 24 h" />
          <div className="self-stretch w-px bg-border opacity-50" />
          <StatBlock value={actionable}  label="Actionable" sub="direct postings" />
          <div className="self-stretch w-px bg-border opacity-50" />
          <StatBlock value={notified}    label="Notified"   sub="sent to Telegram" />
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 inset-x-0 h-12 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--background)))' }}
      />
    </div>
  );
}
