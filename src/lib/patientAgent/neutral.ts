/**
 * NEUTRAL-LANGUAGE CHECK.
 *
 * Ported verbatim from the reference implementation named in
 * docs/HACKATHON-KIRO-PLAN.md: `validateSummary` and its `DIRECTIVE` regex in
 * ChartFuse `lib/review.ts`. This file is the single source of truth for both
 * the runtime guard and the tests.
 *
 * Anything the agent writes itself is checked here. Text that fails is replaced
 * by a fixed neutral template, the same philosophy as the reference: a sentence
 * that reads like an instruction never reaches the patient.
 *
 * Verbatim rule text and the fixed policy refusals are NOT checked. Rule copy
 * such as RiskFlag.suggestedNextStep is already phrased as a question for a
 * clinician and legitimately contains words like "should".
 */

export const DIRECTIVE_WORDING =
  /(?:^(?:stop|start|discontinue|resume|increase|decrease|reduce|switch|substitute|replace|hold|avoid|take|double|halve)\b|\b(?:you|patient|clinician|care team)\s+(?:should|must|need to|take|stop|start|change)\b|\b(?:should|must)\s+(?:take|stop|start|change|switch|increase|decrease|reduce)\b)/i;

const MAX_LENGTH = 600;

/** Returns null when the text is a short, neutral sentence, otherwise the reason. */
export function validateNeutral(text: unknown): string | null {
  if (typeof text !== "string" || !text.trim()) return "empty";
  if (text.length > MAX_LENGTH) return "too long";
  if (DIRECTIVE_WORDING.test(text)) return "directive language";
  return null;
}

/** The fallback used whenever an authored sentence fails validation. */
export const NEUTRAL_TEMPLATE =
  "Here is what your own records show. Your doctor or pharmacist can go through it with you, and nothing here is an instruction about any medicine.";

/** Keeps a segment only if it is neutral, otherwise swaps in the template. */
export function neutralOrTemplate(text: string): string {
  return validateNeutral(text) === null ? text : NEUTRAL_TEMPLATE;
}
