import { RULES, evaluatePatient, knowledge } from "@/lib/safetyEngine";
import { lookupDrug } from "@/lib/terminology/medications";
import type { Medication, RiskFlag } from "@/lib/types";
import type { ClinicianCase, ClinicianFinding, FindingKind, ReconciledMedication, SourceMedication } from "./types";

/**
 * PARTHIA ENGINE BRIDGE
 *
 * Runs the whole Parthia safety engine (drug-drug, drug-allergy,
 * drug-nutrient, burden, mood and Passport rules) over the clinician agent's
 * reconciled current list, and maps every RiskFlag it returns to a clinician
 * finding.
 *
 * The rules decide. This file only translates: severity, priority, routing
 * and wording all come from `RULES` and the knowledge tables, never from a
 * model. Every finding keeps the rule's own `suggestedNextStep` as the
 * reviewer question, so nothing here starts, stops, doses or substitutes a
 * medicine.
 */

/** Clinician copy carries no em dashes, so scrub them where rule text crosses in. */
export function plain(text: string): string {
  return text.replace(/\s*[\u2014\u2013]\s*/g, ", ");
}

const PRIORITY: Record<RiskFlag["severity"], ClinicianFinding["priority"]> = {
  high: "high",
  moderate: "moderate",
  low: "moderate",
};

const ROUTE_TO_PHARMACIST: ReadonlySet<RiskFlag["category"]> = new Set<RiskFlag["category"]>(["drug-drug", "drug-allergy"]);

function findingKind(category: RiskFlag["category"]): FindingKind {
  return category === "drug-drug" ? "interaction" : category;
}

/** The rule that produced a flag, matched by the longest id prefix. */
function ruleName(ruleId: string, fallback: string): string {
  const rule = RULES.filter((r) => ruleId === r.id || ruleId.startsWith(`${r.id}/`)).sort((a, b) => b.id.length - a.id.length)[0];
  return rule?.name ?? fallback;
}

/**
 * The reconciled CURRENT list, mapped back onto `Medication` so the engine can
 * read it. Passport entries are already part of that list. Ingredients the
 * drug dictionary does not know are skipped rather than given a guessed class.
 */
export function engineMedications(medications: ReconciledMedication[], asOf: string): Medication[] {
  return medications.filter((m) => m.current).flatMap((medication) => {
    const concept = lookupDrug(medication.ingredient);
    if (!concept) return [];
    const live = medication.records.filter((r) => r.status !== "stopped");
    const startDate = [...live].map((r) => r.recordedOn).sort()[0] ?? asOf.slice(0, 10);
    return [{
      id: `engine:${medication.ingredient}`,
      name: concept.display,
      genericName: concept.generic,
      class: concept.class,
      dose: live.find((r) => r.dose)?.dose ?? "strength not recorded",
      frequency: "as reconciled",
      startDate,
      rxNormCode: concept.rxcui,
      source: { kind: "ehr", label: "Reconciled (Simulated)", importedAt: asOf, verified: true },
    } satisfies Medication];
  });
}

function ingredientsOf(displayNames: string[]): string[] {
  return [...new Set(displayNames.map((name) => lookupDrug(name)?.generic ?? name.toLowerCase()))];
}

function toFinding(flag: RiskFlag, ingredients: string[], records: SourceMedication[], id: string, title: string): ClinicianFinding {
  return {
    id,
    kind: findingKind(flag.category),
    priority: PRIORITY[flag.severity],
    route: ROUTE_TO_PHARMACIST.has(flag.category) ? "pharmacist" : "clinician",
    title: plain(title),
    detail: `${plain(flag.explanation)} Parthia rule ${flag.ruleId} rated this ${flag.severity}.`,
    question: plain(flag.suggestedNextStep),
    ingredients,
    recordIds: records.filter((r) => ingredients.includes(r.ingredient)).map((r) => r.id),
    supportingRules: [{
      ruleId: flag.ruleId,
      ruleName: plain(ruleName(flag.ruleId, flag.title)),
      severity: flag.severity,
      evidence: flag.evidence.map(plain),
    }],
    // Every finding is a question for a human, so every finding is routed.
    // Severity sets priority and route, never whether a reviewer sees it.
    blocking: true,
  };
}

/**
 * One drug-drug flag can name more than two medicines, because a pair's
 * b-side matcher may cover several classes (warfarin plus antiplatelet also
 * matches NSAIDs). A reviewer needs one item per pair, so split the flag back
 * out using the same pair data and matcher the rule itself used.
 */
function splitPairs(flag: RiskFlag, meds: Medication[]): { ingredients: string[]; title: string }[] {
  const pair = knowledge.DRUG_DRUG_PAIRS.find((p) => flag.ruleId === `drug-drug/known-pairs/${p.id}`);
  const involved = meds.filter((m) => flag.medications.includes(m.name));
  if (!pair) return [{ ingredients: ingredientsOf(flag.medications), title: flag.title }];
  const aSide = involved.filter((m) => knowledge.matches(m, pair.a));
  const bSide = involved.filter((m) => knowledge.matches(m, pair.b) && !aSide.includes(m));
  if (!aSide.length || !bSide.length) return [{ ingredients: ingredientsOf(flag.medications), title: flag.title }];
  return aSide.flatMap((a) => bSide.map((b) => ({ ingredients: ingredientsOf([a.name, b.name]), title: flag.title })));
}

export interface EngineResult {
  findings: ClinicianFinding[];
  flagCount: number;
  ran: boolean;
}

/**
 * Runs every Parthia rule over the reconciled current list plus the Passport
 * record. Returns `ran: false` when the case carries no Passport record, in
 * which case the agent trace says so rather than inventing a shell record.
 */
export function engineFindings(caseData: ClinicianCase, medications: ReconciledMedication[], records: SourceMedication[], asOf: string): EngineResult {
  const passport = caseData.passport;
  if (!passport) return { findings: [], flagCount: 0, ran: false };

  const meds = engineMedications(medications, asOf);
  const flags = evaluatePatient(
    { ...passport, patient: { ...passport.patient, medications: meds }, pastMedications: [] },
    { now: new Date(asOf) },
  );

  const findings: ClinicianFinding[] = [];
  for (const flag of flags) {
    if (flag.category === "drug-drug") {
      for (const pair of splitPairs(flag, meds)) {
        findings.push(toFinding(flag, pair.ingredients, records, `interaction:${[...pair.ingredients].sort().join("+")}`, pair.title));
      }
      continue;
    }
    const ingredients = ingredientsOf(flag.medications);
    findings.push(toFinding(flag, ingredients, records, `rule:${flag.ruleId}:${[...ingredients].sort().join("+")}`, flag.title));
  }
  return { findings, flagCount: flags.length, ran: true };
}
