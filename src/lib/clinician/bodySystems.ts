import type { ClinicianFinding } from "./types";

/**
 * Which body systems a medication finding acts on, for the reference anatomy.
 *
 * This is an association table, not a diagnosis: it says where the risk
 * a finding describes would be felt, never that the patient has a problem
 * there. A finding with no honest mapping maps to nothing; a system is never
 * forced just to light something up.
 */
export type BodySystem = "circulatory" | "gastrointestinal" | "neurological" | "renal";

export const BODY_SYSTEM_ORDER: BodySystem[] = ["circulatory", "gastrointestinal", "neurological", "renal"];

/** Rules whose whole purpose points at one set of systems. */
const BY_RULE: Record<string, BodySystem[]> = {
  "burden/anticholinergic-score": ["neurological", "gastrointestinal"],
  "burden/multiple-psychotropics": ["neurological"],
  "drug-mood/decline-after-change": ["neurological"],
  "drug-mood/phq9-rise-after-change": ["neurological"],
  "drug-kidney/declining-egfr": ["renal"],
  "heart-failure/rapid-weight-gain": ["circulatory"],
  "vitals/low-bp-multiple-bp-meds": ["circulatory"],
  "vitals/low-resting-hr-beta-blocker": ["circulatory"],
  "drug-nutrient/ace-potassium": ["circulatory", "renal"],
  "drug-nutrient/warfarin-vitamin-k": ["circulatory"],
  // Known drug pairs carry their pair name in the rule id. A pair with no entry
  // here (for example sulfonylurea + beta-blocker, which is about blood sugar)
  // maps to nothing, because no atlas system is honest for it.
  "drug-drug/known-pairs/warfarin+antiplatelet": ["circulatory"],
  "drug-drug/known-pairs/ssri+zdrug-sedation": ["neurological"],
};

/** Rule ids can end in a record id ("drug-mood/phq9-rise-after-change/e-m1"), so try the id and its parent. */
function systemsForRuleId(ruleId: string): BodySystem[] {
  if (BY_RULE[ruleId]) return BY_RULE[ruleId];
  const parent = ruleId.slice(0, ruleId.lastIndexOf("/"));
  return parent.includes("/") ? BY_RULE[parent] ?? [] : [];
}

/**
 * Pair-style findings (known drug pairs, label-backed rules) share one rule
 * id, so their systems come from the finding's title, which names what it is
 * about. The detail text is deliberately not searched: it explains side
 * effects and would light up systems the finding is not about.
 */
const BY_WORDS: { pattern: RegExp; systems: BodySystem[] }[] = [
  { pattern: /stomach|gastro|ulcer/i, systems: ["gastrointestinal", "circulatory"] },
  { pattern: /clot|bleed|inr|prothrombin|anticoag|antiplatelet|warfarin/i, systems: ["circulatory"] },
  { pattern: /drows|sedat|act on the brain|confus|serotonin|seizure/i, systems: ["neurological"] },
  { pattern: /kidney|renal|egfr/i, systems: ["renal"] },
  { pattern: /heart rhythm|blood pressure|qt\b/i, systems: ["circulatory"] },
];

export function systemsFor(finding: Pick<ClinicianFinding, "title" | "detail" | "supportingRules" | "kind">): BodySystem[] {
  const found = new Set<BodySystem>();
  for (const rule of finding.supportingRules ?? []) for (const system of systemsForRuleId(rule.ruleId)) found.add(system);
  if (!found.size && finding.kind === "interaction") {
    for (const entry of BY_WORDS) if (entry.pattern.test(finding.title)) for (const system of entry.systems) found.add(system);
  }
  return BODY_SYSTEM_ORDER.filter((system) => found.has(system));
}

export function countsBySystem(findings: Pick<ClinicianFinding, "title" | "detail" | "supportingRules" | "kind">[]): Record<BodySystem, number> {
  const counts: Record<BodySystem, number> = { circulatory: 0, gastrointestinal: 0, neurological: 0, renal: 0 };
  for (const finding of findings) for (const system of systemsFor(finding)) counts[system] += 1;
  return counts;
}
