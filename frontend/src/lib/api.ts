import type {
  ApplicationMaterials, BoardEntry, BoardStatus, ChatTurn, InterviewFeedback, InterviewMode, TailorResult,
} from '@/types/job';

const API_URL_STORE = 'intern_scout_api_url';
const TOKEN_STORE = 'intern_scout_token';
// No default — the backend isn't deployed yet. Set the real URL on the Login page once it is.
const DEFAULT_API_URL = '';

export function getApiUrl(): string {
  return localStorage.getItem(API_URL_STORE) || DEFAULT_API_URL;
}

export function saveApiUrl(url: string): void {
  localStorage.setItem(API_URL_STORE, url.trim().replace(/\/+$/, ''));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORE);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_STORE, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORE);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function doFetch(path: string, opts: RequestInit, headers: Record<string, string>): Promise<Response> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new ApiError('No API URL configured yet — set it on the Login page once the backend is deployed.', 0);
  }
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let r: Response;
  try {
    r = await fetch(`${apiUrl}${path}`, { ...opts, headers });
  } catch {
    throw new ApiError('Could not reach the API. Check the API URL in Settings and that the backend is awake (Render free tier can take ~50s to wake up).', 0);
  }

  if (r.status === 401) {
    clearToken();
    throw new ApiError('Session expired — please log in again.', 401);
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new ApiError((e as { detail?: string }).detail ?? `Request failed (${r.status})`, r.status);
  }
  return r;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await doFetch(path, opts, { 'Content-Type': 'application/json' });
  return r.json() as Promise<T>;
}

/** For multipart/form-data uploads — never set Content-Type manually, the browser adds the boundary. */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const r = await doFetch(path, { method: 'POST', body: form }, {});
  return r.json() as Promise<T>;
}

/* ── auth ─────────────────────────────────────────────────────────────────── */

export interface TokenResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function register(username: string, password: string, invite_code: string): Promise<{ message: string }> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, invite_code }) });
}

export function me(): Promise<{ username: string }> {
  return request('/auth/me');
}

/* ── pipeline board ───────────────────────────────────────────────────────── */

export interface BoardResponse {
  jobs: Record<string, BoardEntry>;
  updated_at: string;
}

export function getBoard(): Promise<BoardResponse> {
  return request('/api/board');
}

export function upsertBoardEntry(entry: {
  url: string;
  status: BoardStatus;
  notes?: string;
  title?: string;
  company?: string;
}): Promise<BoardResponse> {
  return request('/api/board', { method: 'POST', body: JSON.stringify(entry) });
}

export function deleteBoardEntry(url: string): Promise<BoardResponse> {
  return request('/api/board/delete', { method: 'POST', body: JSON.stringify({ url }) });
}

/* ── resume tailor ────────────────────────────────────────────────────────── */

export function tailorResume(resumeFile: File, jobDescription: string): Promise<TailorResult> {
  const form = new FormData();
  form.append('resume', resumeFile);
  form.append('job_description', jobDescription);
  return requestForm('/api/tailor', form);
}

/* ── cover letter + essay ─────────────────────────────────────────────────── */

export function generateMaterials(
  resumeText: string,
  jobDescription: string,
  companyName: string,
  essayQuestion: string,
): Promise<ApplicationMaterials> {
  return request('/api/generate/materials', {
    method: 'POST',
    body: JSON.stringify({
      resume_text: resumeText,
      job_description: jobDescription,
      company_name: companyName,
      essay_question: essayQuestion,
    }),
  });
}

/* ── mock interview ───────────────────────────────────────────────────────── */

export async function startInterview(mode: InterviewMode, resumeText: string, jobDescription: string): Promise<ChatTurn[]> {
  const res = await request<{ turns: ChatTurn[] }>('/api/interview/turn', {
    method: 'POST',
    body: JSON.stringify({ mode, resume_text: resumeText, job_description: jobDescription, history: [] }),
  });
  return res.turns;
}

export async function continueInterview(
  mode: InterviewMode,
  resumeText: string,
  jobDescription: string,
  history: ChatTurn[],
  userMessage: string,
): Promise<ChatTurn[]> {
  const res = await request<{ turns: ChatTurn[] }>('/api/interview/turn', {
    method: 'POST',
    body: JSON.stringify({ mode, resume_text: resumeText, job_description: jobDescription, history, user_message: userMessage }),
  });
  return [{ role: 'user', text: userMessage }, ...res.turns];
}

export function getInterviewFeedback(
  mode: InterviewMode,
  jobDescription: string,
  history: ChatTurn[],
): Promise<InterviewFeedback> {
  return request('/api/interview/feedback', {
    method: 'POST',
    body: JSON.stringify({ mode, job_description: jobDescription, history }),
  });
}

export { ApiError, DEFAULT_API_URL };
