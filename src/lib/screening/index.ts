import type { ScreeningInstrument } from "../types";

/**
 * PHQ-9 and GAD-7 screening questionnaires.
 *
 * Both were developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt
 * Kroenke and colleagues, with an educational grant from Pfizer Inc., and are
 * free to use (no permission required to reproduce, translate, display or
 * distribute). Scoring and severity bands follow the published instructions.
 *
 * These are SCREENING tools. A score is not a diagnosis; it is something to
 * talk through with a clinician.
 */

/** Response options for both instruments, "Over the last 2 weeks…". */
export const RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
] as const;

export const PHQ9_ITEMS: readonly string[] = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead or of hurting yourself in some way",
];

export const GAD7_ITEMS: readonly string[] = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

export const ITEMS: Record<ScreeningInstrument, readonly string[]> = {
  "PHQ-9": PHQ9_ITEMS,
  "GAD-7": GAD7_ITEMS,
};

export const STEM = "Over the last 2 weeks, how often have you been bothered by any of the following problems?";

interface Band {
  min: number;
  max: number;
  label: string;
}

const PHQ9_BANDS: Band[] = [
  { min: 0, max: 4, label: "Minimal" },
  { min: 5, max: 9, label: "Mild" },
  { min: 10, max: 14, label: "Moderate" },
  { min: 15, max: 19, label: "Moderately severe" },
  { min: 20, max: 27, label: "Severe" },
];

const GAD7_BANDS: Band[] = [
  { min: 0, max: 4, label: "Minimal" },
  { min: 5, max: 9, label: "Mild" },
  { min: 10, max: 14, label: "Moderate" },
  { min: 15, max: 21, label: "Severe" },
];

const BANDS: Record<ScreeningInstrument, Band[]> = { "PHQ-9": PHQ9_BANDS, "GAD-7": GAD7_BANDS };

export function maxScore(instrument: ScreeningInstrument): number {
  return ITEMS[instrument].length * 3;
}

export function severityBand(instrument: ScreeningInstrument, score: number): string {
  const band = BANDS[instrument].find((b) => score >= b.min && score <= b.max);
  if (!band) throw new RangeError(`${instrument} score ${score} is out of range`);
  return band.label;
}

export interface ScreeningResult {
  instrument: ScreeningInstrument;
  score: number;
  max: number;
  severity: string;
  /** True when PHQ-9 item 9 (thoughts of self-harm) is answered above "Not at all". */
  selfHarmResponse: boolean;
}

export function scoreScreening(instrument: ScreeningInstrument, answers: readonly number[]): ScreeningResult {
  const n = ITEMS[instrument].length;
  if (answers.length !== n) throw new RangeError(`${instrument} needs ${n} answers, got ${answers.length}`);
  for (const a of answers) {
    if (!Number.isInteger(a) || a < 0 || a > 3) throw new RangeError(`Answers must be integers 0–3, got ${a}`);
  }
  const score = answers.reduce((s, a) => s + a, 0);
  return {
    instrument,
    score,
    max: maxScore(instrument),
    severity: severityBand(instrument, score),
    selfHarmResponse: instrument === "PHQ-9" && answers[8] > 0,
  };
}

/**
 * The supportive message shown immediately when PHQ-9 item 9 is answered
 * above "Not at all". It never blocks the questionnaire or judges the answer.
 */
export const SELF_HARM_SUPPORT = {
  title: "You don't have to handle this alone",
  body:
    "Thank you for answering honestly. Thoughts of being better off dead or of hurting yourself are more common than people think, and support is available right now.",
  actions: [
    { label: "Call or text 988", detail: "988 Suicide & Crisis Lifeline — free, confidential, 24/7", href: "tel:988", smsHref: "sms:988" },
    { label: "Call 911", detail: "If you are in immediate danger or have hurt yourself", href: "tel:911" },
  ],
  followUp:
    "Please also let your doctor, psychiatrist or therapist know about this answer — they would want to know and can help. You can keep going with the questionnaire whenever you're ready.",
} as const;

/** Plain-language note shown with every result. */
export const SCREENING_DISCLAIMER =
  "This is a screening questionnaire, not a diagnosis. Your score is a starting point for a conversation with your clinician.";
