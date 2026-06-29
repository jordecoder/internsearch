export interface Score {
  overall: number;
  role: number;
  skill: number;
  location: number;
  timeline: number;
  timeline_match: string;
  location_relevance: number;
}

export interface Job {
  title: string;
  company: string;
  url: string;
  location: string | null;
  source: string;
  posted_time: string | null;
  first_seen_time: string;
  score: Score;
  actionable: boolean;
  notified: boolean;
  stable_id: string;
}

export interface JobsData {
  jobs: Job[];
  exported_at: string | null;
}

export interface TailorResult {
  role_title: string;
  required_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  coverage_percent: number;
  tailored_summary: string;
  prioritised_bullets: string[];
  suggested_additions: string[];
  keyword_tips: string;
}
