import type {
  ApplicationMaterials, BoardEntry, BoardStatus, ChatTurn, InterviewFeedback, InterviewMode, TailorResult,
} from '@/types/job';

const API_URL_STORE = 'intern_scout_api_url';
const TOKEN_STORE = 'intern_scout_token';
const DEFAULT_API_URL = 'https://internsearch-api.onrender.com';

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry delays (ms) for a cold Render free-tier instance waking up. A sleeping
 * instance's very first request can fail outright — not just be slow — if
 * Render's edge times out before the app finishes booting (this shows up in
 * the browser as a CORS error even though it's really a connection failure;
 * Chrome can't tell the difference once the connection itself dies). Render's
 * docs put worst-case wake time around 50s, so this budget covers that.
 */
const WAKE_RETRY_DELAYS_MS = [3000, 6000, 10000, 15000];

let onRetryListener: ((attempt: number, max: number) => void) | null = null;
/** UI can subscribe to show "waking up the server…" during retries. */
export function setRetryListener(fn: typeof onRetryListener): void {
  onRetryListener = fn;
}

async function doFetch(path: string, opts: RequestInit, headers: Record<string, string>): Promise<Response> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new ApiError('No API URL configured yet — set it on the Login page once the backend is deployed.', 0);
  }
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let r: Response | undefined;
  const maxAttempts = WAKE_RETRY_DELAYS_MS.length + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      r = await fetch(`${apiUrl}${path}`, { ...opts, headers });
      break;
    } catch {
      if (attempt === maxAttempts) {
        throw new ApiError(
          'Could not reach the API after several tries. Check the API URL in Settings — if it looks right, the backend may be down rather than just asleep.',
          0,
        );
      }
      onRetryListener?.(attempt, maxAttempts);
      await sleep(WAKE_RETRY_DELAYS_MS[attempt - 1]);
    }
  }
  // r is always assigned by the time the loop exits normally (break) — the
  // final-attempt failure path above always throws instead of falling through.
  const response = r as Response;

  if (response.status === 401) {
    clearToken();
    throw new ApiError('Session expired — please log in again.', 401);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(extractErrorMessage(body) ?? `Request failed (${response.status})`, response.status);
  }
  return response;
}

/**
 * FastAPI error bodies come in two shapes: our own `HTTPException(detail="...")`
 * gives a plain string, but Pydantic validation failures (422s) give
 * `detail: [{type, loc, msg, ...}, ...]`. Passing that array straight into
 * `new Error(...)` stringifies to "[object Object]" — this normalizes both.
 */
function extractErrorMessage(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' && 'msg' in item ? String((item as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m);
    if (messages.length) return messages.join('; ');
  }
  return undefined;
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

/**
 * For requests that must avoid a CORS preflight entirely — login/register,
 * before any token exists to add an Authorization header. `Content-Type:
 * application/json` is what forces the preflight (it isn't a CORS-safelisted
 * value); omitting the header lets the browser default a string body to
 * `text/plain`, which is safelisted — no preflight OPTIONS round-trip at all.
 * Some networks mishandle preflight even when plain POST works fine, which is
 * what broke login/register for at least one user despite CORS being
 * configured correctly. The backend parses the body via Request.json()
 * regardless of the declared Content-Type, so this is transparent server-side.
 */
async function requestNoPreflight<T>(path: string, body: unknown): Promise<T> {
  const r = await doFetch(path, { method: 'POST', body: JSON.stringify(body) }, {});
  return r.json() as Promise<T>;
}

/* ── auth ─────────────────────────────────────────────────────────────────── */

export interface TokenResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return requestNoPreflight('/auth/login', { username, password });
}

export function register(username: string, password: string, invite_code: string): Promise<{ message: string }> {
  return requestNoPreflight('/auth/register', { username, password, invite_code });
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
