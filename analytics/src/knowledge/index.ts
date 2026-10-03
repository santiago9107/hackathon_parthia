/**
 * Runtime access to the clinical knowledge base.
 *
 * Reads ONLY the exported JSON (analytics/knowledge/json) plus the clinical
 * lead's structured overrides (analytics/knowledge/overrides.json). Static
 * imports keep this usable in the browser bundle and in Node.
 */
import dictionaryJson from "../../knowledge/json/data_dictionary.json";
import thresholdsJson from "../../knowledge/json/thresholds.json";
import rulesJson from "../../knowledge/json/rules.json";
import cardsJson from "../../knowledge/json/recommendation_cards.json";
import sourcesJson from "../../knowledge/json/source_register.json";
import testCasesJson from "../../knowledge/json/test_cases.json";
import manifestJson from "../../knowledge/json/manifest.json";
import overridesJson from "../../knowledge/overrides.json";

export type ReviewStatus = "draft_verify" | "in_review" | "approved" | "retired";
export type Severity = "urgent" | "high" | "moderate" | "low";
export type KnowledgeMode = "development" | "clinical";

export interface DictionaryRow {
  element_id: string;
  name: string;
  category: string | null;
  unit: string | null;
  priority: string | null;
  mvp: boolean;
  valid_for_analysis: string | null;
  validity: { amount: number; unit: "days" | "months" } | null;
  validity_has_context: boolean;
  source_ids: string[];
  review_status: ReviewStatus;
}
export interface ThresholdRow {
  threshold_id: string;
  element_id: string;
  measure: string;
  unit: string | null;
  reference_range: string | null;
  patient_override: string | null;
  source_ids: string[];
  review_status: ReviewStatus;
}
export interface RuleRow {
  rule_id: string;
  name: string;
  category: string;
  severity: Severity;
  patient_question: string;
  clinician_note: string | null;
  source_ids: string[];
  phenotype: string | null;
  kb_domain: string;
  review_status: ReviewStatus;
  threshold_ids: string[];
}
export interface CardRow {
  card_id: string;
  topic: string;
  class_of_recommendation: string | null;
  level_of_evidence: string | null;
  related_rule_ids: string[];
  source_ids: string[];
  review_status: ReviewStatus;
}
export interface SourceRow {
  source_id: string;
  title: string;
  version: string | null;
  link: string | null;
}
export interface TestCaseRow {
  test_id: string;
  scenario: string;
  expected_rule_ids: string[];
  expected_severity: Severity | null;
  expected_rules_text: string | null;
  must_not_say: string | null;
}

type Overrides = typeof overridesJson;
export type RuleParams = Overrides["rules"];

export interface Knowledge {
  version: string;
  overridesVersion: string;
  dictionary: Map<string, DictionaryRow>;
  thresholds: Map<string, ThresholdRow>;
  rules: Map<string, RuleRow>;
  cards: CardRow[];
  sources: Map<string, SourceRow>;
  testCases: TestCaseRow[];
  overrides: Overrides;
  /** Composite and simple drug groups resolved to ingredient lists. */
  drugGroups: Map<string, string[][]>;
}

function byId<T>(rows: T[], key: keyof T): Map<string, T> {
  return new Map(rows.map((r) => [String(r[key]), r]));
}

function resolveDrugGroups(o: Overrides): Map<string, string[][]> {
  const simple = o.drug_groups.groups as Record<string, { kb_listed: string[]; draft_added: string[] }>;
  const out = new Map<string, string[][]>();
  for (const [name, g] of Object.entries(simple)) {
    out.set(name, [...g.kb_listed, ...g.draft_added].map((m) => m.split("/").map((s) => s.trim().toLowerCase())));
  }
  const composites = o.drug_groups.composites as Record<string, { of: string[] }>;
  for (const [name, c] of Object.entries(composites)) {
    out.set(name, c.of.flatMap((g) => out.get(g) ?? []));
  }
  return out;
}

let cached: Knowledge | null = null;

export function loadKnowledge(): Knowledge {
  if (cached) return cached;
  const k: Knowledge = {
    version: manifestJson.knowledge_version,
    overridesVersion: overridesJson.overrides_version,
    dictionary: byId(dictionaryJson.rows as DictionaryRow[], "element_id"),
    thresholds: byId(thresholdsJson.rows as ThresholdRow[], "threshold_id"),
    rules: byId(rulesJson.rows as RuleRow[], "rule_id"),
    cards: cardsJson.rows as CardRow[],
    sources: byId(sourcesJson.rows as SourceRow[], "source_id"),
    testCases: testCasesJson.rows as TestCaseRow[],
    overrides: overridesJson,
    drugGroups: resolveDrugGroups(overridesJson),
  };
  const problems = checkKnowledge(k);
  if (problems.length) throw new Error(`Knowledge base inconsistent:\n  ${problems.join("\n  ")}`);
  cached = k;
  return k;
}

/** Cross-checks overrides against the exported KB. Returns a list of problems (empty = consistent). */
export function checkKnowledge(k: Knowledge): string[] {
  const p: string[] = [];
  const decisions = new Set(k.overrides.decisions.map((d) => d.id));
  for (const [ruleId, params] of Object.entries(k.overrides.rules)) {
    if (!k.rules.has(ruleId)) p.push(`overrides.rules.${ruleId}: rule not in KB`);
    const prm = params as Record<string, unknown>;
    for (const key of ["groups", "groups_a", "groups_b", "escalate_if_groups"]) {
      for (const g of (prm[key] as string[] | undefined) ?? []) {
        if (!k.drugGroups.has(g)) p.push(`overrides.rules.${ruleId}.${key}: unknown drug group ${g}`);
      }
    }
    for (const key of ["threshold_id"]) {
      const t = prm[key] as string | undefined;
      if (t && !k.thresholds.has(t)) p.push(`overrides.rules.${ruleId}: unknown threshold ${t}`);
    }
    const el = prm.element as string | undefined;
    if (el && !k.dictionary.has(el)) p.push(`overrides.rules.${ruleId}: unknown element ${el}`);
    const dec = prm.decision as string | undefined;
    if (dec && !decisions.has(dec)) p.push(`overrides.rules.${ruleId}: unknown decision ${dec}`);
  }
  for (const [ruleId, els] of Object.entries(k.overrides.rule_elements.map)) {
    if (!k.rules.has(ruleId)) p.push(`rule_elements: ${ruleId} not in KB`);
    for (const e of els) if (!k.dictionary.has(e)) p.push(`rule_elements.${ruleId}: unknown element ${e}`);
  }
  for (const r of k.rules.keys()) {
    if (!(r in k.overrides.rules)) p.push(`Rule ${r} has no structured parameters in overrides.json`);
  }
  for (const c of k.overrides.urgent_labs.checks) {
    if (!k.dictionary.has(c.element)) p.push(`urgent_labs.${c.id}: unknown element`);
    if (!k.thresholds.has(c.threshold_id)) p.push(`urgent_labs.${c.id}: unknown threshold`);
  }
  return p;
}

/** Elements needed by a rule (KB columns plus the overrides mapping for R01-R10). */
export function ruleElements(k: Knowledge, ruleId: string): string[] {
  return (k.overrides.rule_elements.map as Record<string, string[]>)[ruleId] ?? [];
}

export function ruleParams<T = Record<string, unknown>>(k: Knowledge, ruleId: string): T {
  return (k.overrides.rules as Record<string, unknown>)[ruleId] as T;
}

export function decisionIds(k: Knowledge, params: { decision?: string }): string[] {
  return params.decision ? [params.decision] : [];
}

/** Cards linked to a rule (Recommendation cards "Related rule IDs"). */
export function cardsForRule(k: Knowledge, ruleId: string): CardRow[] {
  return k.cards.filter((c) => c.related_rule_ids.includes(ruleId));
}

/**
 * Whether a knowledge row may be used in the given mode.
 * development: every row except Retired. clinical: Approved only.
 */
export function usable(status: ReviewStatus | string, mode: KnowledgeMode): boolean {
  if (status === "retired") return false;
  return mode === "development" || status === "approved";
}
