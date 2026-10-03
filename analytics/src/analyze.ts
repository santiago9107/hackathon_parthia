/**
 * analyze_patient(snapshot, as_of, config) -> HolisticAnalysisBundle
 *
 * Deterministic and pure: no clock, no randomness, no network, no LLM.
 * The same snapshot, as_of and config always produce an identical bundle.
 */
import { loadKnowledge } from "./knowledge/index";
import type { KnowledgeMode } from "./knowledge/index";
import { PatientSnapshot } from "./model/snapshot";
import type { PatientSnapshotInput } from "./model/snapshot";
import { BundleZ, CONTRACT_VERSION } from "./model/bundle";
import type { DomainProfile, Finding, HolisticAnalysisBundle, RuleEvaluation } from "./model/bundle";
import { prepare } from "./data/prepare";
import { createCtx } from "./engine/context";
import { evaluateUrgent } from "./engine/urgent";
import { calculatePhenotype } from "./engine/phenotype";
import { evaluateRules } from "./engine/rules";
import { buildTimeline } from "./engine/timeline";
import { buildDomainProfile } from "./engine/domains";
import { forbiddenPhrases } from "./engine/text";
import analysisConfig from "../config/analysis.json";

export const MODULE_VERSION = "0.3.0";

export interface AnalysisConfig {
  /** "development" uses every non-retired KB row; "clinical" uses Approved rows only. */
  knowledge_mode?: KnowledgeMode;
}

const SEV_RANK = { urgent: 4, high: 3, moderate: 2, low: 1 } as const;

const NOT_IMPLEMENTED = [
  "precursors (phase 5)",
  "contributing_factors (phase 6)",
  "risk_scores (phase 7; tables to be supplied by the clinical lead, DEC-10)",
  "ranked_findings[].priority (phase 4; findings are ordered by severity, then recency)",
];

export function analyzePatient(snapshot: PatientSnapshotInput | PatientSnapshot, asOf: string, config: AnalysisConfig = {}): HolisticAnalysisBundle {
  const snap = PatientSnapshot.parse(snapshot);
  const k = loadKnowledge();
  const mode = config.knowledge_mode ?? (analysisConfig.knowledge_mode as KnowledgeMode);
  const p = prepare(k, snap);
  const ctx = createCtx(k, mode, asOf, p);

  // RED FLAGS FIRST: computed before, and independently of, everything else.
  const { urgent, evaluations: urgentEvaluations } = evaluateUrgent(ctx);

  let phenotype: HolisticAnalysisBundle["phenotype"] = { element_id: "D003", value: null, lvef: null, detail: "Not calculated.", decision_ids: [] };
  let findings: Finding[] = [];
  let ruleEvaluations: RuleEvaluation[] = [];
  let domainProfile: DomainProfile[] = [];
  let timeline: HolisticAnalysisBundle["timeline"] = { events: [], daily_series: { weight_kg: [], systolic_mmhg: [], diastolic_mmhg: [], heart_rate_bpm: [], phq9_score: [], diet_risk_tags: [], missed_doses: [] } };
  try {
    phenotype = calculatePhenotype(ctx);
    const results = evaluateRules(ctx, phenotype.value);
    ruleEvaluations = results.map((r) => r.evaluation);
    findings = results.flatMap((r) => r.findings);
    findings.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.triggered_at.localeCompare(a.triggered_at) || a.finding_id.localeCompare(b.finding_id));
    timeline = buildTimeline(ctx, findings, urgent);
    domainProfile = buildDomainProfile(ctx, findings, urgent, timeline);
  } catch (err) {
    // Urgent results are still returned when the rest of the analysis fails.
    ctx.warnings.push(`ANALYSIS INCOMPLETE: ${(err as Error).message}`);
  }

  for (const text of [
    ...urgent.flatMap((u) => [u.title, u.clinician_note]),
    ...findings.flatMap((f) => [f.summary, f.patient_question, f.clinician_note]),
    ...domainProfile.map((d) => d.reason),
    ...[...ctx.missing.values()].map((m) => m.suggested_patient_question ?? ""),
  ]) {
    const hits = forbiddenPhrases(text);
    if (hits.length) ctx.warnings.push(`Forbidden wording (${hits.join(", ")}) in generated text: "${text}"`);
  }

  const bundle: HolisticAnalysisBundle = {
    contract_version: CONTRACT_VERSION,
    patient_id: snap.patient_id,
    as_of: asOf,
    module_version: MODULE_VERSION,
    knowledge_version: k.version,
    overrides_version: k.overridesVersion,
    knowledge_mode: mode,
    phenotype,
    urgent,
    domain_profile: domainProfile,
    ranked_findings: findings,
    precursors: [],
    contributing_factors: [],
    risk_scores: [],
    missing_data: [...ctx.missing.values()].sort((a, b) => a.element_id.localeCompare(b.element_id)),
    needs_review: [...p.needsReview].sort((a, b) => Number(b.possible_red_flag) - Number(a.possible_red_flag) || a.item_id.localeCompare(b.item_id)),
    timeline,
    audit: {
      rules_evaluated: [...urgentEvaluations, ...ruleEvaluations].sort((a, b) => a.rule_id.localeCompare(b.rule_id)),
      thresholds_used: [...ctx.thresholdsUsed].sort((a, b) => `${a.threshold_id}|${a.parameter}|${a.source}`.localeCompare(`${b.threshold_id}|${b.parameter}|${b.source}`)),
      knowledge_rows_used: [...ctx.knowledgeUsed.values()].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)),
      warnings: [...new Set(ctx.warnings)],
      not_implemented: NOT_IMPLEMENTED,
    },
  };
  // The contract is enforced on every call, not only in tests.
  return BundleZ.parse(bundle);
}

export { analyzePatient as analyze_patient };
