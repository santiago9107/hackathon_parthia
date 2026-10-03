/**
 * VISIT QUESTIONS: "Prepare for my visit".
 *
 * One deterministic builder, two surfaces (the dashboard agent card and the
 * share page). Given the SafetyUpdate from the one safety-watch seam, the
 * reconciliation issues and the record, it writes 3 to 5 questions the patient
 * can read out at their appointment.
 *
 * Order is fixed: findings that are new since the last visit first, then the
 * remaining findings by severity, then the cross-source differences from
 * `questionsForClinician`. Deduplicated, clamped to 5.
 *
 * Every question ends with a question mark and is addressed to a clinician.
 * The agent never says to begin, to end, to skip or to alter anything, and it
 * never contacts anyone: these questions are for the patient to ask.
 *
 * The sentence the agent writes itself is one `authored` segment and is run
 * through `validateNeutral`. Verbatim rule text (`RiskFlag.title`,
 * `RiskFlag.suggestedNextStep`) and the verbatim reconciliation question are
 * `quoted` segments and are never rewritten, which is why the question line is
 * authored rather than lifted from `suggestedNextStep` (that text is phrased
 * "Ask your doctor whether ..." and does not end in a question mark).
 */
import { questionsForClinician, type ReconIssue } from "../reconcile";
import type { Medication, PatientRecord, RiskFlag, RiskSeverity } from "../types";
import { validateNeutral } from "./neutral";
import type { SafetyUpdate } from "./safetyWatch";
import type { AgentCitation, ReplySegment } from "./types";

export type VisitQuestionKind = "new-finding" | "open-finding" | "difference" | "general";

export interface VisitQuestion {
  /** Stable key for React lists: the rule id, the difference index or the general slot. */
  id: string;
  kind: VisitQuestionKind;
  /** The question line, always ending in a question mark. */
  text: string;
  /** What the agent wrote, plus any verbatim rule or record text behind it. */
  segments: ReplySegment[];
  citations: AgentCitation[];
}

export const MIN_VISIT_QUESTIONS = 3;
export const MAX_VISIT_QUESTIONS = 5;

/** The neutral ask used when there is nothing open, and as the first padding question. */
export const VISIT_QUESTION_FALLBACK =
  "Could we go through my full medicine and allergy list together at this visit?";

const GENERAL_QUESTIONS = [
  VISIT_QUESTION_FALLBACK,
  "Is there anything on my list that my other clinicians might not know about?",
  "Which of my records do you already have, and which ones are missing on your side?",
];

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, moderate: 1, low: 2 };

export function buildVisitQuestions(
  update: SafetyUpdate,
  issues: ReconIssue[],
  record: PatientRecord,
): VisitQuestion[] {
  const newRules = new Set(update.newFindings.map((f) => f.ruleId));
  const added = new Map(update.updatedFindings.map((u) => [u.flag.ruleId, u.addedMedications]));
  const remaining = update.findings
    .filter((f) => !newRules.has(f.ruleId))
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const questions: VisitQuestion[] = [
    ...update.newFindings.map((flag) => fromFinding(flag, record, "new-finding", added.get(flag.ruleId))),
    ...remaining.map((flag) => fromFinding(flag, record, "open-finding", added.get(flag.ruleId))),
    ...questionsForClinician(issues).map(fromDifference),
  ];

  const unique = dedupe(questions);
  if (unique.length === 0) return [general(0)];

  for (let i = 0; unique.length < MIN_VISIT_QUESTIONS && i < GENERAL_QUESTIONS.length; i += 1) {
    const padding = general(i);
    if (!unique.some((q) => q.text === padding.text)) unique.push(padding);
  }
  return unique.slice(0, MAX_VISIT_QUESTIONS);
}

function fromFinding(
  flag: RiskFlag,
  record: PatientRecord,
  kind: "new-finding" | "open-finding",
  addedMedications?: string[],
): VisitQuestion {
  const names = listNames(flag.medications);
  const text = authored(questionLine(kind, names, addedMedications));
  const segments: ReplySegment[] = [
    { kind: "authored", text },
    { kind: "quoted", text: flag.title },
    { kind: "quoted", text: flag.suggestedNextStep },
  ];
  return { id: flag.ruleId, kind, text, segments, citations: citationsFor(flag, record) };
}

function questionLine(
  kind: "new-finding" | "open-finding",
  names: string | null,
  addedMedications?: string[],
): string {
  const widenedBy = addedMedications?.length ? listNames(addedMedications) : null;
  if (names && widenedBy) return `Can we go over ${names} now that ${widenedBy} is also on my list?`;
  if (names && kind === "new-finding") return `${capitalise(names)} is new since my last visit. Is it safe for me alongside the rest of my list?`;
  if (names) return `Can we go over ${names} at this visit?`;
  if (kind === "new-finding") return "Something new came up in my safety check. Can we go over it at this visit?";
  return "Can we go over one more thing from my safety check at this visit?";
}

/**
 * A difference between the patient's own list and a connected record. The
 * reconciliation question is used verbatim when it is already a question;
 * otherwise the agent adds one neutral sentence so the line is still a
 * question the patient can ask.
 */
function fromDifference(question: string, index: number): VisitQuestion {
  const quoted = question.trim();
  const isQuestion = quoted.endsWith("?");
  const tail = authored("Can we confirm that at this visit?");
  const segments: ReplySegment[] = [{ kind: "quoted", text: quoted }];
  if (!isQuestion) segments.push({ kind: "authored", text: tail });
  return {
    id: `difference:${index}`,
    kind: "difference",
    text: isQuestion ? quoted : `${quoted} ${tail}`,
    segments,
    citations: [{ label: "A difference between your own list and a connected record" }],
  };
}

function general(index: number): VisitQuestion {
  const text = GENERAL_QUESTIONS[index] ?? VISIT_QUESTION_FALLBACK;
  return {
    id: `general:${index}`,
    kind: "general",
    text,
    segments: [{ kind: "authored", text }],
    citations: [{ label: "Safety check across your medicines, allergies and entries" }],
  };
}

/** Anything the agent writes itself falls back to the fixed neutral ask if it reads as an instruction. */
function authored(text: string): string {
  return validateNeutral(text) === null ? text : VISIT_QUESTION_FALLBACK;
}

function dedupe(questions: VisitQuestion[]): VisitQuestion[] {
  const seen = new Set<string>();
  const out: VisitQuestion[] = [];
  for (const q of questions) {
    const key = q.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function listNames(input: string[]): string | null {
  const names = [...new Set(input)];
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The rule that fired, plus the real source of every medicine it involves. */
function citationsFor(flag: RiskFlag, record: PatientRecord): AgentCitation[] {
  const all: Medication[] = [...record.patient.medications, ...record.pastMedications];
  const sources = [...new Set(flag.medications)]
    .map((name) => all.find((m) => m.name.toLowerCase() === name.toLowerCase()))
    .filter((m): m is Medication => !!m)
    .map((m) => ({ label: m.name, source: m.source }));
  return [{ label: flag.title, ruleId: flag.ruleId }, ...sources];
}
