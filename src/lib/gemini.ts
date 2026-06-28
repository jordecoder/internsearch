import type { TailorResult } from '@/types/job';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const KEY_STORE = 'intern_scout_gemini_key';

export function getKey(): string | null {
  return localStorage.getItem(KEY_STORE);
}

export function saveKey(key: string): void {
  localStorage.setItem(KEY_STORE, key);
}

export function clearKey(): void {
  localStorage.removeItem(KEY_STORE);
}

export async function validateKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
    });
    if (r.ok || r.status === 400) return { ok: true };
    const d = await r.json().catch(() => ({}));
    return { ok: false, error: (d as { error?: { message?: string } }).error?.message ?? 'Invalid API key.' };
  } catch {
    return { ok: false, error: 'Could not reach Gemini. Check your connection.' };
  }
}

export async function tailorResume(
  resumeText: string,
  jobDescription: string,
  key: string,
): Promise<TailorResult> {
  const prompt = `You are an expert resume tailoring assistant.

RESUME:
${resumeText.slice(0, 6000)}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

Rules:
- Only use experience and skills actually present in the resume. Never fabricate.
- Reword bullets to lead with the most relevant skill for this specific role.
- Be specific and quantified where the resume has numbers.

Respond with ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{
  "role_title": "string — detected role from JD",
  "required_skills": ["string"],
  "matched_skills": ["string — skills from resume that match JD"],
  "missing_skills": ["string — important JD skills not in resume"],
  "coverage_percent": 0,
  "tailored_summary": "string — 2-3 sentence professional summary tailored to this role",
  "prioritised_bullets": ["string — reordered/reworded resume bullets, most relevant first"],
  "suggested_additions": ["string — honest suggestions based on gaps"],
  "keyword_tips": "string — ATS keyword advice for this specific role"
}`;

  const r = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  });

  if (r.status === 401 || r.status === 403) {
    throw new Error('API_KEY_INVALID');
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as { error?: { message?: string } }).error?.message ?? 'Gemini API error.');
  }

  const data = await r.json();
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(raw) as TailorResult;
}
