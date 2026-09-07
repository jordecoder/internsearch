import type { BoardEntry, BoardStatus } from '@/types/job';

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

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let r: Response;
  try {
    r = await fetch(`${getApiUrl()}${path}`, { ...opts, headers });
  } catch {
    throw new ApiError('Could not reach the API. Check the API URL in Settings and that the backend is awake.', 0);
  }

  if (r.status === 401) {
    clearToken();
    throw new ApiError('Session expired — please log in again.', 401);
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new ApiError((e as { detail?: string }).detail ?? `Request failed (${r.status})`, r.status);
  }
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

export { ApiError, DEFAULT_API_URL };
