/**
 * PATIENT AGENT: the reply assembler.
 *
 * Rules decide, templates explain. There is no model path, no network call and
 * no API key, so there is nothing to degrade gracefully from.
 *
 * The order below is fixed and is the safety contract of this surface:
 *   1. urgent symptoms, answered and returned immediately
 *   2. requests to change a medicine or to contact someone, refused by policy
 *   3. page-aware intents answered from the SafetyUpdate and the Passport
 *   4. the existing scripted, data-grounded responder as the fallback
 *
 * The agent never tells the patient to start, stop, skip or change a medicine
 * or a dose, and never contacts anyone. Every finding is a question for a
 * clinician. Anything the agent writes itself goes through validateNeutral.
 *
 * `answerPatient` is async only because `scriptedProvider.respond` is; the
 * answer itself is computed synchronously from the record.
 */
import { scriptedProvider } from "../assistant";
import { checkTool, toolForRequest, type ClinicianTool } from "../clinician/policy";
import { questionsForClinician, type ReconIssue } from "../reconcile";
import { formatDate } from "../safetyEngine/rules/types";
import type { Medication, PatientRecord, RiskFlag } from "../types";
import { neutralOrTemplate } from "./neutral";
import type { SafetyUpdate } from "./safetyWatch";
import type { AgentCitation, PageContext, PatientReply, ReplySegment } from "./types";
import { detectUrgent, urgentMessage } from "./urgent";

export interface PatientAgentContext {
  record: PatientRecord;
  update: SafetyUpdate;
  page: PageContext;
  now: Date;
  issues?: ReconIssue[];
}

/* ---- Policy layer -------------------------------------------------------- */

/**
 * Only a request for an ACTION goes through the policy engine. A question that
 * merely mentions a dose ("what is my warfarin dose?") is a question about the
 * record, not a request to change one.
 */
const ACTION_SHAPE =
  /^(stop|start|switch|change|increase|decrease|reduce|hold|skip|double|halve|remove|delete|update|prescribe|refill|write|call|text|email|book|cancel|schedule)\b|\b(can|could|will|would) you\b|\bshould i\b|\bfor me\b|\bplease\b|\binstead\b/i;

/** How a patient phrases the requests `toolForRequest` matches as a clinician would. */
const PATIENT_DIRECTIVES: { pattern: RegExp; tool: ClinicianTool }[] = [
  { pattern: /\binstead\b/i, tool: "substitute_medication" },
  { pattern: /\bskip\b/i, tool: "stop_medication" },
  { pattern: /\b(half|double|halve) (a |my |the )?(dose|tablet|pill)\b/i, tool: "change_dose" },
  { pattern: /\bshould i (take|keep taking|carry on|still take|still be taking)\b/i, tool: "update_medication" },
];

const CONTACT_ACTION = /\b(call|text|email|message|contact|phone|book|schedule|cancel|fax|send)\b/i;
const CONTACT_TARGET = /\b(doctor|clinician|nurse|pharmacy|pharmacist|care team|office|surgery|appointment|gp|pcp)\b/i;

/**
 * The agent never contacts anyone on the patient's behalf. policy.ts has no
 * tool for this because the clinician agent cannot message people either, so
 * the reason is fixed here next to the policy refusals it sits with.
 */
export const CONTACT_REFUSAL =
  "I cannot contact anyone for you or change an appointment. I can put the question in the summary you share, so you can raise it yourself.";

/** The policy tool a patient's wording maps to, or null when it asks for nothing. */
export function directiveTool(text: string): ClinicianTool | null {
  if (!ACTION_SHAPE.test(text)) return null;
  return toolForRequest(text) ?? PATIENT_DIRECTIVES.find((d) => d.pattern.test(text))?.tool ?? null;
}

/* ---- Intents ------------------------------------------------------------- */

const WHAT_CHANGED = /\bwhat(?:'s| is| has)? ?(changed|new)\b|\bsince my last visit\b|\banything new\b|\bnew (thing|finding|flag)s?\b/i;
const WHY_FLAGGED = /\b(why|explain|what does (this|that) mean)\b/i;
const WHERE_FROM = /\bwhere (did|does|is)\b|\bwho added\b|\bwhich source\b|\bwhat source\b|\bcome from\b|\bcame from\b/i;
const WHAT_TO_ASK = /\bwhat should i ask\b|\bquestions?\b|\bask (at|during|before) my visit\b|\bask my (doctor|pharmacist|clinician)\b|\bprepare for my visit\b/i;

/* ---- Assembly ------------------------------------------------------------ */

function ruleCitation(flag: RiskFlag): AgentCitation {
  return { label: flag.title, ruleId: flag.ruleId };
}

function medicationCitations(record: PatientRecord, names: string[]): AgentCitation[] {
  return names
    .map((n) => record.patient.medications.find((m) => m.name === n))
    .filter((m): m is Medication => !!m)
    .map((m) => ({ label: `${m.name} ${m.dose}`, source: m.source }));
}

const SAFETY_CHECK_CITATION: AgentCitation = { label: "Safety check across your medicines, allergies and entries" };

function build(
  segments: ReplySegment[],
  citations: AgentCitation[],
  suggestions: string[],
  extra: Partial<PatientReply> = {},
): PatientReply {
  return {
    segments: segments.map((s) => (s.kind === "authored" ? { kind: s.kind, text: neutralOrTemplate(s.text) } : s)),
    citations: dedupe(citations),
    answeredBy: "rules",
    suggestions,
    ...extra,
  };
}

function dedupe(citations: AgentCitation[]): AgentCitation[] {
  return [...new Map(citations.map((c) => [`${c.label}|${c.ruleId ?? ""}|${c.source?.label ?? ""}`, c])).values()];
}

function mentionedMedication(question: string, record: PatientRecord): Medication | undefined {
  const q = question.toLowerCase();
  return record.patient.medications.find((m) => q.includes(m.name.toLowerCase().split(" ")[0]) || q.includes(m.genericName));
}

/* ---- The entry point ----------------------------------------------------- */

export async function answerPatient(question: string, ctx: PatientAgentContext): Promise<PatientReply> {
  const { record, update, page, now, issues = [] } = ctx;
  const q = question.trim();

  // 1. Urgent symptoms, before anything else.
  const urgent = detectUrgent(q);
  if (urgent) {
    const message = urgentMessage(urgent.kind);
    return build(
      [{ kind: "quoted", text: message.title }, ...message.lines.map((text) => ({ kind: "quoted" as const, text }))],
      [{ label: urgent.kind === "self-harm" ? "988 Suicide and Crisis Lifeline" : "Emergency services" }],
      [],
      { urgent: urgent.kind },
    );
  }

  // 2. Requests the agent is not allowed to act on.
  const tool = directiveTool(q);
  if (tool) {
    const decision = checkTool(tool);
    if (!decision.allowed) {
      return build(
        [
          { kind: "refusal", text: decision.reason },
          { kind: "authored", text: "I can show you what your records say and turn it into a question for your next visit." },
        ],
        [SAFETY_CHECK_CITATION],
        page.examples,
        { refused: true },
      );
    }
  }
  if (CONTACT_ACTION.test(q) && CONTACT_TARGET.test(q)) {
    return build(
      [{ kind: "refusal", text: CONTACT_REFUSAL }],
      [SAFETY_CHECK_CITATION],
      page.examples,
      { refused: true },
    );
  }

  // 3. Page-aware intents, answered from the SafetyUpdate and the Passport.
  if (WHAT_CHANGED.test(q)) return whatChanged(ctx);
  if (WHY_FLAGGED.test(q)) return whyFlagged(q, ctx);
  if (WHERE_FROM.test(q)) return whereFrom(q, ctx);
  if (WHAT_TO_ASK.test(q)) return whatToAsk(ctx);

  // 4. The existing scripted, data-grounded responder.
  const scripted = await scriptedProvider.respond(q, { record, flags: update.findings, now, issues });
  return build(
    [{ kind: "quoted", text: scripted.text }],
    scripted.sources.map((label) => ({ label })),
    scripted.suggestions ?? page.examples,
    scripted.urgent ? { urgent: "physical" } : {},
  );
}

function whatChanged({ record, update, page }: PatientAgentContext): PatientReply {
  const { newFindings, updatedFindings, newCount, patientReportedOnly } = update;
  if (newCount === 0 && updatedFindings.length === 0) {
    return build(
      [
        { kind: "authored", text: "Nothing new since your last visit." },
        { kind: "authored", text: "Your safety check found nothing that is not already in the records your care team has." },
      ],
      [SAFETY_CHECK_CITATION],
      page.examples,
    );
  }

  const segments: ReplySegment[] = [];
  const citations: AgentCitation[] = [SAFETY_CHECK_CITATION];

  if (newCount > 0) {
    segments.push({
      kind: "authored",
      text: `Since your last visit: ${newCount} new thing${newCount === 1 ? "" : "s"} to ask your doctor about.`,
    });
    for (const flag of newFindings) {
      segments.push({ kind: "quoted", text: `${flag.title}. ${flag.explanation}` });
      segments.push({ kind: "quoted", text: flag.suggestedNextStep });
      citations.push(ruleCitation(flag), ...medicationCitations(record, flag.medications));
    }
  }

  for (const { flag, addedMedications } of updatedFindings) {
    segments.push({
      kind: "authored",
      text: `A finding you already had now also involves ${addedMedications.join(" and ")}.`,
    });
    segments.push({ kind: "quoted", text: flag.title });
    citations.push(ruleCitation(flag), ...medicationCitations(record, addedMedications));
  }

  const ownEntries = patientReportedOnly.flatMap((f) => f.medications);
  if (ownEntries.length > 0) {
    segments.push({
      kind: "authored",
      text: `${[...new Set(ownEntries)].join(" and ")} came from your own entry and is in no clinical record yet.`,
    });
  }

  return build(segments, citations, page.examples);
}

function whyFlagged(question: string, { record, update, page }: PatientAgentContext): PatientReply {
  const med = mentionedMedication(question, record);
  const pool = med ? update.findings.filter((f) => f.medications.includes(med.name)) : update.findings;
  const flags = pool.slice(0, 3);

  if (flags.length === 0) {
    return build(
      [
        {
          kind: "authored",
          text: med
            ? `Your safety check has nothing flagged for ${med.name} right now.`
            : "Your safety check has nothing flagged right now.",
        },
      ],
      [SAFETY_CHECK_CITATION, ...(med ? medicationCitations(record, [med.name]) : [])],
      page.examples,
    );
  }

  const segments: ReplySegment[] = [
    {
      kind: "authored",
      text: med
        ? `Here is what the safety rules found about ${med.name}, and the evidence behind it.`
        : "Here is what the safety rules found, and the evidence behind each one.",
    },
  ];
  const citations: AgentCitation[] = [];
  for (const flag of flags) {
    segments.push({ kind: "quoted", text: `${flag.title}. ${flag.explanation}` });
    for (const line of flag.evidence) segments.push({ kind: "quoted", text: line });
    segments.push({ kind: "quoted", text: flag.suggestedNextStep });
    citations.push(ruleCitation(flag), ...medicationCitations(record, flag.medications));
  }
  return build(segments, citations.length > 0 ? citations : [SAFETY_CHECK_CITATION], page.examples);
}

function whereFrom(question: string, { record, page }: PatientAgentContext): PatientReply {
  const med = mentionedMedication(question, record);
  if (med) {
    return build(
      [
        {
          kind: "authored",
          text: `${med.name} ${med.dose} is in your Passport from ${med.source.label}, recorded ${formatDate(med.source.importedAt)}.`,
        },
        ...(med.prescriber ? [{ kind: "authored" as const, text: `Your record names ${med.prescriber} for it.` }] : []),
      ],
      medicationCitations(record, [med.name]),
      page.examples,
    );
  }

  const allergy = record.allergies.find((a) => question.toLowerCase().includes(a.substance.toLowerCase()));
  if (allergy) {
    return build(
      [
        {
          kind: "authored",
          text: `Your ${allergy.substance} allergy is in your Passport from ${allergy.source.label}, recorded ${formatDate(allergy.source.importedAt)}.`,
        },
      ],
      [{ label: `Allergy: ${allergy.substance}`, source: allergy.source }],
      page.examples,
    );
  }

  const segments: ReplySegment[] = [{ kind: "authored", text: "Every item in your Passport carries where it came from." }];
  for (const m of record.patient.medications) segments.push({ kind: "quoted", text: `${m.name} ${m.dose}: ${m.source.label}` });
  return build(
    segments,
    medicationCitations(
      record,
      record.patient.medications.map((m) => m.name),
    ),
    page.examples,
  );
}

function whatToAsk({ record, update, page, issues = [] }: PatientAgentContext): PatientReply {
  const ordered = [...update.newFindings, ...update.findings.filter((f) => !update.newFindings.includes(f))];
  const recordQuestions = questionsForClinician(issues);
  if (ordered.length === 0 && recordQuestions.length === 0) {
    return build(
      [
        {
          kind: "authored",
          text: `Nothing is flagged right now. A medication review with ${record.patient.primaryClinician} is still a fair thing to ask for.`,
        },
      ],
      [SAFETY_CHECK_CITATION],
      page.examples,
    );
  }

  const segments: ReplySegment[] = [{ kind: "authored", text: "Here are the questions your own records point to." }];
  const citations: AgentCitation[] = [];
  for (const flag of ordered.slice(0, 5)) {
    segments.push({ kind: "quoted", text: flag.suggestedNextStep });
    citations.push(ruleCitation(flag), ...medicationCitations(record, flag.medications));
  }
  for (const text of recordQuestions.slice(0, 3)) {
    segments.push({ kind: "quoted", text });
    citations.push({ label: "Differences between your records" });
  }
  return build(segments, citations.length > 0 ? citations : [SAFETY_CHECK_CITATION], page.examples);
}
