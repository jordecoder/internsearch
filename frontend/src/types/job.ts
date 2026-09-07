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

export interface ApplicationMaterials {
  cover_letter: string;
  essay_answer: string;
  key_points_used: string[];
}

export type InterviewMode = 'behavioral' | 'technical' | 'group_discussion';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  /** For group_discussion mode: which simulated participant said this (undefined = moderator/interviewer). */
  speaker?: string;
}

export interface InterviewFeedback {
  overall_impression: string;
  strengths: string[];
  improvements: string[];
  sample_better_answer: string;
}

/* Pipeline board */
export type BoardStatus = 'found' | 'tailoring' | 'applied' | 'interviewing' | 'offer' | 'rejected';
/** 'skipped' is a legacy status from before the board existed — read-only, no longer a column. */
export type BoardEntryStatus = BoardStatus | 'skipped';

export interface BoardEntry {
  status: BoardEntryStatus;
  notes: string;
  title?: string;
  company?: string;
  url?: string;
  updated_at: string;
}
