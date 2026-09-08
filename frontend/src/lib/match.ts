import type { MatchTier, Score } from '@/types/job';

/** Semantic match-fit tiers — restrained, four-way, meaningful at a glance. */
export function matchTier(overall: number): MatchTier {
  if (overall >= 85) return 'strong';
  if (overall >= 70) return 'good';
  if (overall >= 55) return 'moderate';
  return 'weak';
}

export const TIER_LABEL: Record<MatchTier, string> = {
  strong: 'Strong match',
  good: 'Good match',
  moderate: 'Moderate match',
  weak: 'Weak match',
};

/** Text + background classes per tier — used for badges and the score ring. */
export const TIER_CLASSES: Record<MatchTier, { text: string; bg: string; ring: string; bar: string }> = {
  strong: {
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900',
    ring: 'stroke-emerald-500',
    bar: 'bg-emerald-500',
  },
  good: {
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900',
    ring: 'stroke-blue-500',
    bar: 'bg-blue-500',
  },
  moderate: {
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900',
    ring: 'stroke-amber-500',
    bar: 'bg-amber-500',
  },
  weak: {
    text: 'text-muted-foreground',
    bg: 'bg-muted border-border',
    ring: 'stroke-muted-foreground/40',
    bar: 'bg-muted-foreground/40',
  },
};

/**
 * A short, honest, rule-based read on the score breakdown — not AI-generated,
 * just deterministic logic over real numbers already computed by the backend.
 */
export function matchRecommendation(score: Score): string {
  const tier = matchTier(score.overall);
  const weakest = (['role', 'skill', 'location', 'timeline', 'degree'] as const).reduce((min, k) =>
    score[k] < score[min] ? k : min,
  );
  const weakLabel: Record<typeof weakest, string> = {
    role: 'role alignment',
    skill: 'skill overlap',
    location: 'location fit',
    timeline: 'timeline fit',
    degree: 'degree/eligibility fit',
  };

  if (tier === 'strong') return 'Strong match — worth applying soon.';
  if (tier === 'good') {
    return score[weakest] < 70
      ? `Good match — ${weakLabel[weakest]} is the main thing pulling the score down.`
      : 'Good match — solid all-round fit, worth applying.';
  }
  if (tier === 'moderate') return `Moderate match — check ${weakLabel[weakest]} before applying.`;
  return `Weak match — ${weakLabel[weakest]} is a significant gap here.`;
}

/**
 * Lightweight, honest tag extraction: scans the job title (the only text the
 * static dashboard feed carries — no job description is exported) against a
 * curated technology term list. These are "mentioned in the title," not a
 * resume comparison — there's no stored resume to compare against here.
 */
const TAG_TERMS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Golang', 'C++', 'SQL', 'R',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform',
  'React', 'Node', 'FastAPI', 'Django', 'Spring',
  'Spark', 'Airflow', 'Kafka', 'dbt', 'Snowflake', 'Databricks',
  'PyTorch', 'TensorFlow', 'LLM', 'RAG', 'GenAI', 'Generative AI', 'Machine Learning', 'AI',
  'Data Engineering', 'Data Science', 'DevOps', 'Cybersecurity',
];

export function extractTags(title: string): string[] {
  const found: string[] = [];
  const lower = title.toLowerCase();
  for (const term of TAG_TERMS) {
    const pattern = new RegExp(`\\b${term.toLowerCase().replace(/[+.]/g, '\\$&')}\\b`);
    if (pattern.test(lower) && !found.includes(term)) found.push(term);
  }
  return found.slice(0, 5);
}
