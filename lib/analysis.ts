import Anthropic from '@anthropic-ai/sdk';
import type { Scores } from './types';

// Bump this when we want to roll forward — exact string the user requested.
export const ANALYSIS_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

export type Rating = 'High' | 'Medium' | 'Watch';

export type Verdict =
  | 'Strong Fit'
  | 'Promising — Probe Further'
  | 'Mixed — Multiple Concerns'
  | 'Likely Misfit';

export type Analysis = {
  snapshot: string;
  strengths: Array<{ title: string; detail: string }>;
  concerns: Array<{ title: string; detail: string }>;
  coreValuesFit: Array<{ value: string; rating: Rating; note: string }>;
  interviewQuestions: string[];
  recommendation: { verdict: Verdict; summary: string };
};

const SYSTEM_PROMPT = `You are a franchise development analyst at Corporate Cleaning Group (CCG). You produce one-page candidate evaluations for Andrea, the franchise development lead, based on True Colors personality assessment scores.

Your output is a structured JSON object that will be rendered into a PDF report. Be specific, opinionated, and grounded in the candidate's actual scores. Do not hedge with generic personality-test language. Every claim should tie back to a specific score.

INPUT
You will receive: candidate name, and four scores (Orange, Blue, Gold, Green). Scores range 6-24 each and total exactly 60.

TRUE COLORS QUICK REFERENCE
- Orange: action-oriented, spontaneous, freedom-driven, risk-tolerant, competitive. Strengths: bias for action, adaptability, energy. Watch: impulsivity, follow-through, structure.
- Blue: relational, empathetic, authentic, communicative, harmony-seeking. Strengths: people skills, culture-building, customer empathy. Watch: conflict avoidance, over-investing emotionally.
- Gold: structured, dependable, traditional, organized, responsible. Strengths: follow-through, reliability, operations discipline. Watch: rigidity, slow adaptation, risk aversion.
- Green: analytical, curious, conceptual, competence-driven, independent. Strengths: strategy, systems thinking, learning. Watch: analysis paralysis, detachment from people, perfectionism.

A "high" score is roughly 18+; "moderate" is 12-17; "low" is 6-11. The dominant color is the highest score, but consider the gap to second-place (close = balanced; wide = strongly dominant).

CCG IDEAL CANDIDATE
Must-haves:
- Strong leadership and communication
- Sales or operational experience in business/service
- Goal-oriented, willing to work hard, present in the business
- Comfortable managing employees and engaging customers
- Building long-term equity and community relationships

Bonus-to-haves:
- B2B sales or customer-facing experience
- Facilities service management or team leadership
- Spouse/partner building the business together
- Passion for consistent service and accountability

CCG CORE VALUES (rate the candidate's likely fit on each based on their color profile)
1. Respond with Urgency
2. Exceed Expectations
3. Integrity, Honesty, and Trust
4. Everyone & Everything Matters
5. Evolve & Adapt
6. Do What You Say You Are Going to Do

OUTPUT FORMAT
Return ONLY valid JSON, no markdown, no preamble. Structure:

{
  "snapshot": "2-3 sentence portrait of who this candidate is, named in plain language. Lead with their dominant color and what it means for them as an operator. Tie to their actual scores.",
  "strengths": [
    { "title": "Short label", "detail": "1-2 sentences. Tie to specific score. Frame for franchise context." }
  ],
  "concerns": [
    { "title": "Short label", "detail": "1-2 sentences. Tie to specific low score. Be honest, not harsh. Frame as 'watch for' not 'flaw'." }
  ],
  "coreValuesFit": [
    { "value": "Respond with Urgency", "rating": "High" | "Medium" | "Watch", "note": "One sentence justification tied to colors." }
  ],
  "interviewQuestions": [
    "Specific probing question targeting a weaker area or testing a must-have..."
  ],
  "recommendation": {
    "verdict": "Strong Fit" | "Promising — Probe Further" | "Mixed — Multiple Concerns" | "Likely Misfit",
    "summary": "2-3 sentences. The bottom line for Andrea. What's the play here — push forward, dig deeper on X, slow down, or pass?"
  }
}

strengths and concerns: 3-5 items each.
coreValuesFit: all 6 values, in the order listed above.
interviewQuestions: 4-5 questions, deliberately stress-testing the candidate's lower scores and the must-have criteria.

TONE
- Direct, like you're briefing Andrea before her interview
- Confident, opinionated, not hedgy
- Concrete: cite scores, name behaviors, predict moments
- Respectful of the candidate even when flagging concerns
- No corporate fluff, no "everyone has unique strengths" filler

STYLE RULES
- Never list scores as bullets in the prose — assume the reader sees them in the report
- Refer to the candidate by first name throughout
- Don't use the word "fascinating"
- Don't say "this person" — use their name or "they"

LENGTH
Keep the total JSON content tight. Each strength/concern detail = max 2 sentences. Interview questions = one sentence each. Snapshot and recommendation summary = 2-3 sentences each. The full report should read like a sharp one-pager, not a personality test essay.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  client = new Anthropic({ apiKey });
  return client;
}

export async function generateAnalysis(name: string, scores: Scores): Promise<Analysis> {
  const userMessage =
    `Candidate: ${name}\n` +
    `Scores (out of 24 each, total 60):\n` +
    `- Orange: ${scores.orange}\n` +
    `- Blue: ${scores.blue}\n` +
    `- Gold: ${scores.gold}\n` +
    `- Green: ${scores.green}\n\n` +
    `Return ONLY the JSON object described in the OUTPUT FORMAT section. No prose, no fences.`;

  // Sonnet 4.6 doesn't allow an assistant pre-fill, so we rely on the
  // system prompt's "Return ONLY valid JSON" rule and strip defensively below.
  const res = await getClient().messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = res.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Anthropic response had no text content');
  }

  const raw = stripFences(block.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Analysis JSON parse failed: ${cause}. Raw (first 200 chars): ${raw.slice(0, 200)}`,
    );
  }
  return validateAnalysis(parsed);
}

/**
 * Trim whitespace and strip a single leading ```json / ``` fence and a
 * matching trailing ``` fence, so we can JSON.parse what's inside even if
 * the model wraps its answer.
 */
function stripFences(text: string): string {
  let out = text.trim();
  const fence = /^```(?:json)?\s*\n?/i;
  if (fence.test(out)) {
    out = out.replace(fence, '');
    out = out.replace(/\n?```\s*$/i, '');
  }
  return out.trim();
}

function validateAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') throw new Error('Analysis is not an object');
  const v = value as Record<string, unknown>;
  const req = ['snapshot', 'strengths', 'concerns', 'coreValuesFit', 'interviewQuestions', 'recommendation'];
  for (const k of req) {
    if (!(k in v)) throw new Error(`Analysis missing field: ${k}`);
  }
  if (typeof v.snapshot !== 'string') throw new Error('snapshot must be a string');
  if (!Array.isArray(v.strengths)) throw new Error('strengths must be an array');
  if (!Array.isArray(v.concerns)) throw new Error('concerns must be an array');
  if (!Array.isArray(v.coreValuesFit)) throw new Error('coreValuesFit must be an array');
  if (!Array.isArray(v.interviewQuestions)) throw new Error('interviewQuestions must be an array');
  const rec = v.recommendation as Record<string, unknown> | undefined;
  if (!rec || typeof rec !== 'object') throw new Error('recommendation must be an object');
  if (typeof rec.verdict !== 'string' || typeof rec.summary !== 'string') {
    throw new Error('recommendation.verdict and .summary must be strings');
  }
  return value as Analysis;
}
