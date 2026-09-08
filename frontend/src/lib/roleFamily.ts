/**
 * Lightweight client-side role categorization for filtering — mirrors the
 * spirit of the backend's role_families config (used for scoring), but
 * re-derived from the title text the static dashboard feed actually carries.
 * Display/filtering convenience only, not a scoring signal.
 */
const FAMILIES: Record<string, string[]> = {
  'AI / ML': ['rag', 'llm', 'generative ai', 'genai', 'machine learning', 'ai engineer', 'ml engineer', 'nlp'],
  'Data Engineering': ['data engineer', 'data engineering', 'data pipeline', 'data platform', 'etl'],
  'Data Science / Analytics': ['data science', 'data scientist', 'data analyst', 'analytics', 'business intelligence'],
  'Software Engineering': ['software engineer', 'software engineering', 'backend', 'frontend', 'full stack', 'application developer'],
  'Cybersecurity': ['cybersecurity', 'cyber security', 'security engineer'],
  'Cloud / DevOps': ['cloud', 'devops', 'site reliability', 'platform engineer'],
};

export function roleFamily(title: string): string {
  const lower = title.toLowerCase();
  for (const [family, terms] of Object.entries(FAMILIES)) {
    if (terms.some((t) => lower.includes(t))) return family;
  }
  return 'Other';
}
