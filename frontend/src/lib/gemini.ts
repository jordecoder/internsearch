import type { ApplicationMaterials, ChatTurn, InterviewFeedback, InterviewMode, TailorResult } from '@/types/job';

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

/** Shared call: sends a single prompt, expects a JSON object back, handles auth/error mapping. */
async function _generateJson<T>(prompt: string, key: string, temperature = 0.3): Promise<T> {
  const r = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: 'application/json' },
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
  return JSON.parse(raw) as T;
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

  return _generateJson<TailorResult>(prompt, key);
}

/* ── Cover letters + essay answers ─────────────────────────────────────────── */

export async function generateApplicationMaterials(
  resumeText: string,
  jobDescription: string,
  companyName: string,
  essayQuestion: string,
  key: string,
): Promise<ApplicationMaterials> {
  const prompt = `You are an expert career-services writer helping a candidate apply for an internship.

RESUME:
${resumeText.slice(0, 6000)}

JOB DESCRIPTION (Company: ${companyName || 'the company'}):
${jobDescription.slice(0, 3000)}

ESSAY QUESTION TO ANSWER:
"${essayQuestion || 'Why do you want to work here?'}"

Rules:
- Only use experience, skills, and facts actually present in the resume. Never fabricate accomplishments, dates, or employers.
- The cover letter should be 3-4 short paragraphs, specific to this role and company, ready to send as-is (no placeholders like "[Company Name]" — use the real name given above).
- The essay answer should directly answer the question in 150-250 words, connecting the candidate's real background to specific, concrete things about this role/company mentioned in the JD (avoid generic flattery).
- Confident, natural, first-person voice. No clichés like "I am writing to express my interest".

Respond with ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{
  "cover_letter": "string — the full cover letter, ready to send",
  "essay_answer": "string — the essay answer to the question above",
  "key_points_used": ["string — resume facts/skills woven into the writing"]
}`;

  return _generateJson<ApplicationMaterials>(prompt, key, 0.5);
}

/* ── Mock interviews (behavioral / technical / group discussion) ────────────── */

function _transcript(history: ChatTurn[]): string {
  if (history.length === 0) return '(nothing yet — this is the start of the session)';
  return history
    .map((t) => `${t.role === 'user' ? 'Candidate' : t.speaker ?? 'Interviewer'}: ${t.text}`)
    .join('\n');
}

function _modeBriefing(mode: InterviewMode): string {
  if (mode === 'group_discussion') {
    return `This is a Group Discussion / Leaderless Group Discussion (GD/LGD) round, a common internship-screening format.
You play EVERY participant except the candidate: 2-3 simulated co-participants with distinct names and personas
(e.g. one assertive/dominant, one analytical/data-driven, one quiet-but-insightful), plus a neutral moderator voice
(speaker "Moderator") used only to open with the topic and to close the round.
After the candidate speaks, have 1-2 of the OTHER participants respond naturally — build on, challenge, or redirect
the point, and occasionally talk over each other's ideas the way a real GD does. Stay strictly on the discussion topic.
Keep the discussion moving at a realistic pace; do not let it stall.`;
  }
  if (mode === 'technical') {
    return `This is a technical interview for an internship role. You play a single interviewer (speaker "Interviewer").
Ask one technical question at a time grounded in the job description and the candidate's resume (concepts, past
projects, problem-solving). Give a brief, natural reaction to each answer (not a lecture) before asking the next
question or a follow-up probing deeper on a weak point.`;
  }
  return `This is a behavioral interview for an internship role. You play a single interviewer (speaker "Interviewer").
Ask one behavioral/motivational question at a time (STAR-style: past experiences, teamwork, challenges, why this
role). React briefly and naturally to each answer before moving to the next question or a relevant follow-up.`;
}

async function _generateInterviewTurns(
  mode: InterviewMode,
  resumeText: string,
  jobDescription: string,
  history: ChatTurn[],
  key: string,
  instruction: string,
): Promise<ChatTurn[]> {
  const prompt = `${_modeBriefing(mode)}

CANDIDATE'S RESUME (for context — only the interviewer/participants can see this, the candidate is answering live):
${resumeText.slice(0, 4000) || '(no resume provided — ask generic questions for this type of role)'}

JOB DESCRIPTION:
${jobDescription.slice(0, 2500) || '(no specific JD provided — treat as a general tech internship)'}

TRANSCRIPT SO FAR:
${_transcript(history)}

${instruction}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "turns": [
    { "speaker": "string — name of whoever is speaking (e.g. Interviewer, Moderator, or a participant's name)", "text": "string — what they say" }
  ]
}
Keep each turn's text realistically short (1-5 sentences), the way people actually talk.`;

  const result = await _generateJson<{ turns: ChatTurn[] }>(prompt, key, 0.7);
  return result.turns.map((t) => ({ role: 'model' as const, text: t.text, speaker: t.speaker }));
}

export async function startInterview(
  mode: InterviewMode,
  resumeText: string,
  jobDescription: string,
  key: string,
): Promise<ChatTurn[]> {
  const instruction =
    mode === 'group_discussion'
      ? 'Open the session now: have the Moderator introduce a single, specific discussion topic relevant to the job description (or a general tech/business topic if no JD was given), then have 2 participants give short opening statements on it.'
      : 'Open the session now: greet the candidate briefly, then ask your first question.';
  return _generateInterviewTurns(mode, resumeText, jobDescription, [], key, instruction);
}

export async function continueInterview(
  mode: InterviewMode,
  resumeText: string,
  jobDescription: string,
  history: ChatTurn[],
  userMessage: string,
  key: string,
): Promise<ChatTurn[]> {
  const historyWithUser: ChatTurn[] = [...history, { role: 'user', text: userMessage }];
  const instruction =
    mode === 'group_discussion'
      ? "The candidate just spoke (see transcript). Have 1-2 OTHER participants react to what the candidate said and keep the discussion going."
      : 'The candidate just answered (see transcript). React briefly, then ask your next question or a natural follow-up.';
  const turns = await _generateInterviewTurns(mode, resumeText, jobDescription, historyWithUser, key, instruction);
  return [{ role: 'user', text: userMessage }, ...turns];
}

export async function getInterviewFeedback(
  mode: InterviewMode,
  resumeText: string,
  jobDescription: string,
  history: ChatTurn[],
  key: string,
): Promise<InterviewFeedback> {
  const roleNote =
    mode === 'group_discussion'
      ? 'Evaluate the CANDIDATE only, on: clarity of points, how well they built on/responded to others, assertiveness without talking over people, and structure.'
      : 'Evaluate the CANDIDATE only, on: clarity, specificity/evidence (STAR-style where relevant), relevance to the role, and confidence.';

  const prompt = `You are an expert interview coach reviewing a completed ${mode.replace('_', ' ')} practice session for an internship candidate.

JOB DESCRIPTION:
${jobDescription.slice(0, 2000) || '(none given)'}

FULL TRANSCRIPT:
${_transcript(history)}

${roleNote}
Be honest and specific — cite something concrete from the transcript in each point, not generic advice.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "overall_impression": "string — 2-3 sentence overall assessment",
  "strengths": ["string — specific things the candidate did well, citing the transcript"],
  "improvements": ["string — specific, actionable things to improve, citing the transcript"],
  "sample_better_answer": "string — a rewritten, stronger version of the candidate's weakest answer from the transcript"
}`;

  return _generateJson<InterviewFeedback>(prompt, key, 0.4);
}
