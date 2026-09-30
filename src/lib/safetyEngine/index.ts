/**
 * PARTHIA SAFETY ENGINE
 *
 * A transparent, rule-based scanner. Given a patient's record (medications,
 * history, and their own symptom / mood / nutrition entries) it runs every
 * rule in `RULES` and returns the flags they raise, highest severity first.
 *
 * Design rules:
 *  - No hidden scoring. Every flag names the rule that produced it and the
 *    evidence it used.
 *  - Every suggested next step is a question for a clinician, never an
 *    instruction to start, stop or change a medicine.
 *  - Rules are pure functions of (record, now) so they can be unit-tested
 *    and replayed against historical data.
 *
 * Later phases can add a learned model *alongside* these rules (e.g. to rank
 * or personalise them) without replacing the explainable core.
 */
import type { PatientRecord, RiskFlag, RiskSeverity } from "../types";
import { burdenRules } from "./rules/burden";
import { drugDrugRules } from "./rules/drugDrug";
import { drugNutrientRules } from "./rules/drugNutrient";
import { moodRules } from "./rules/moodAdherence";
import { passportRules } from "./rules/passport";
import type { RuleDefinition } from "./rules/types";

export type { RuleDefinition } from "./rules/types";
export * as knowledge from "./knowledge";

export const RULES: readonly RuleDefinition[] = [
  ...drugNutrientRules,
  ...burdenRules,
  ...moodRules,
  ...drugDrugRules,
  ...passportRules,
];

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, moderate: 1, low: 2 };

export interface EvaluateOptions {
  /** Evaluate "as of" this moment. Defaults to the real clock. */
  now?: Date;
  /** Restrict to a subset of rule ids (useful for testing / explain UI). */
  ruleIds?: string[];
}

export function evaluatePatient(record: PatientRecord, options: EvaluateOptions = {}): RiskFlag[] {
  const ctx = { now: options.now ?? new Date() };
  const rules = options.ruleIds ? RULES.filter((r) => options.ruleIds!.includes(r.id)) : RULES;
  const flags = rules.flatMap((rule) => rule.evaluate(record, ctx));
  return flags.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.title.localeCompare(b.title));
}

export function highestSeverity(flags: RiskFlag[]): RiskSeverity | null {
  if (flags.length === 0) return null;
  return flags.reduce<RiskSeverity>((acc, f) => (SEVERITY_RANK[f.severity] < SEVERITY_RANK[acc] ? f.severity : acc), "low");
}

export function flagsByCategory(flags: RiskFlag[]): Record<RiskFlag["category"], RiskFlag[]> {
  const out: Record<RiskFlag["category"], RiskFlag[]> = {
    "drug-drug": [],
    "drug-nutrient": [],
    "drug-mood": [],
    "anticholinergic-burden": [],
    "drug-vitals": [],
    "drug-allergy": [],
    "drug-kidney": [],
  };
  for (const f of flags) out[f.category].push(f);
  return out;
}
