/**
 * HolisticAnalysisBundle: the output contract for agents and screens.
 *
 * This zod schema is the single source of truth. The published JSON Schema
 * (analytics/contract/holistic_bundle.schema.json) is generated from it by
 * `npm run schema`, and a test fails if the two drift apart.
 *
 * Contract version policy: additive changes bump the minor version; renames or
 * removals bump the major version.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "1.0.0";

export const SeverityZ = z.enum(["urgent", "high", "moderate", "low"]);
export const ReviewStatusZ = z.enum(["draft_verify", "in_review", "approved", "retired", "clinical_lead_decision"]);

export const DOMAIN_IDS = [
  "medication_safety",
  "fluid_congestion",
  "heart_kidney_labs",
  "bp_heart_rate",
  "mental_health",
  "adherence",
  "nutrition",
  "function_qol",
] as const;
export const DomainIdZ = z.enum(DOMAIN_IDS);
export type DomainId = z.infer<typeof DomainIdZ>;

/** A knowledge row (rule, threshold, card, element, decision, override) used to produce an item, with its review status. */
export const KnowledgeRefZ = z.strictObject({
  kind: z.enum(["rule", "threshold", "card", "element", "decision", "override"]),
  id: z.string(),
  review_status: ReviewStatusZ,
});
export type KnowledgeRef = z.infer<typeof KnowledgeRefZ>;

/** Which threshold was applied, and where it came from (Dictionary guide rule 12). */
export const ThresholdUseZ = z.strictObject({
  threshold_id: z.string().nullable(),
  element_id: z.string(),
  parameter: z.string(),
  op: z.enum(["<", "<=", ">", ">=", "range"]),
  value: z.number().nullable(),
  low: z.number().nullable(),
  high: z.number().nullable(),
  unit: z.string(),
  source: z.enum(["care_plan", "lab_reference_range", "default"]),
  reference: z.string(),
});
export type ThresholdUse = z.infer<typeof ThresholdUseZ>;

export const EvidenceZ = z.strictObject({
  element_id: z.string(),
  item_id: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  date: z.string(),
  source: z.string(),
  /** Unit conversion applied to this value, if any. */
  conversion: z.string().nullable(),
});
export type Evidence = z.infer<typeof EvidenceZ>;

const citations = {
  element_ids: z.array(z.string()),
  rule_ids: z.array(z.string()),
  source_ids: z.array(z.string()),
  threshold_ids: z.array(z.string()),
  card_ids: z.array(z.string()),
  decision_ids: z.array(z.string()),
};

export const UrgentItemZ = z.strictObject({
  urgent_id: z.string(),
  pathway: z.enum(["red_flag_symptom", "urgent_vital", "self_harm", "urgent_lab"]),
  rule_id: z.string().nullable(),
  title: z.string(),
  /** Immediate message for the patient. */
  patient_message: z.string(),
  clinician_note: z.string(),
  evidence: z.array(EvidenceZ),
  ...citations,
  thresholds_used: z.array(ThresholdUseZ),
  knowledge: z.array(KnowledgeRefZ),
  triggered_at: z.string(),
  domain: DomainIdZ,
});
export type UrgentItem = z.infer<typeof UrgentItemZ>;

export const PriorityZ = z.strictObject({
  score: z.number(),
  components: z.record(z.string(), z.strictObject({ weight: z.number(), value: z.number(), contribution: z.number() })),
});

export const FindingZ = z.strictObject({
  finding_id: z.string(),
  rule_id: z.string(),
  title: z.string(),
  category: z.string(),
  severity: SeverityZ,
  /** KB severity before any decision-based escalation (e.g. R07 under DEC-05). */
  base_severity: SeverityZ,
  domain: DomainIdZ,
  kb_domain: z.string(),
  /** Plain-language description of what was found. Never a diagnosis or instruction. */
  summary: z.string(),
  patient_question: z.string(),
  clinician_note: z.string(),
  evidence: z.array(EvidenceZ),
  ...citations,
  thresholds_used: z.array(ThresholdUseZ),
  knowledge: z.array(KnowledgeRefZ),
  triggered_at: z.string(),
  /** Filled by prioritization (phase 4). Null until then. */
  priority: PriorityZ.nullable(),
});
export type Finding = z.infer<typeof FindingZ>;

export const DomainStatusZ = z.enum(["good", "watch", "attention", "insufficient_data"]);
export const TrendZ = z.enum(["improving", "stable", "worsening", "unknown"]);

export const DomainProfileZ = z.strictObject({
  domain: DomainIdZ,
  label: z.string(),
  status: DomainStatusZ,
  trend: TrendZ,
  reason: z.string(),
  trend_detail: z.string(),
  finding_ids: z.array(z.string()),
  urgent_ids: z.array(z.string()),
  missing_element_ids: z.array(z.string()),
  element_ids: z.array(z.string()),
  rule_ids: z.array(z.string()),
});
export type DomainProfile = z.infer<typeof DomainProfileZ>;

export const MissingDataZ = z.strictObject({
  element_id: z.string(),
  element_name: z.string(),
  reason: z.enum(["no_data", "stale", "post_change_monitoring_due", "post_change_monitoring_overdue", "baseline_not_set"]),
  detail: z.string(),
  needed_by_rule_ids: z.array(z.string()),
  /** Domains whose status is "insufficient data" because of this element (phase 3). */
  needed_by_domains: z.array(DomainIdZ),
  last_value: EvidenceZ.nullable(),
  /** Question the patient can answer or ask. Null for 'Later' elements (never requested; guide rule 7). */
  suggested_patient_question: z.string().nullable(),
  knowledge: z.array(KnowledgeRefZ),
});
export type MissingData = z.infer<typeof MissingDataZ>;

export const NeedsReviewZ = z.strictObject({
  item_id: z.string(),
  kind: z.string(),
  element_id: z.string(),
  label: z.string(),
  reason: z.enum(["unconfirmed", "pending_reconciliation", "conflict", "unknown_element", "element_mismatch", "unit_not_convertible", "invalid_value"]),
  detail: z.string(),
  source: z.string(),
  /** The item, if confirmed, could trigger the urgent pathway. Screens should surface these first. */
  possible_red_flag: z.boolean(),
});
export type NeedsReviewItem = z.infer<typeof NeedsReviewZ>;

export const TimelineEventZ = z.strictObject({
  event_id: z.string(),
  at: z.string(),
  category: z.enum([
    "medication_start", "medication_change", "medication_stop", "lab", "weight", "blood_pressure",
    "heart_rate", "mood", "diet", "symptom", "missed_dose", "er_visit", "hospital_admission",
    "hospital_discharge", "fall", "care_plan",
  ]),
  element_id: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  source: z.string(),
  confirmed: z.boolean(),
  /** False when the item is unconfirmed, pending or conflicting (shown, but not analysed). */
  used_in_analysis: z.boolean(),
  severity: SeverityZ.nullable(),
  rule_ids: z.array(z.string()),
});
export type TimelineEvent = z.infer<typeof TimelineEventZ>;

export const SeriesPointZ = z.strictObject({ date: z.string(), value: z.number(), n: z.number().int() });
export const DAILY_SERIES = ["weight_kg", "systolic_mmhg", "diastolic_mmhg", "heart_rate_bpm", "phq9_score", "diet_risk_tags", "missed_doses"] as const;
export const DailySeriesZ = z.strictObject(
  Object.fromEntries(DAILY_SERIES.map((s) => [s, z.array(SeriesPointZ)])) as Record<(typeof DAILY_SERIES)[number], z.ZodArray<typeof SeriesPointZ>>,
);

export const RuleEvaluationZ = z.strictObject({
  rule_id: z.string(),
  outcome: z.enum(["fired", "not_fired", "not_applicable", "missing_data", "not_evaluable", "excluded_by_mode"]),
  detail: z.string(),
  review_status: ReviewStatusZ,
});
export type RuleEvaluation = z.infer<typeof RuleEvaluationZ>;

export const BundleZ = z.strictObject({
  contract_version: z.literal(CONTRACT_VERSION),
  patient_id: z.string(),
  as_of: z.string(),
  module_version: z.string(),
  knowledge_version: z.string(),
  overrides_version: z.string(),
  knowledge_mode: z.enum(["development", "clinical"]),
  /** Calculated HF phenotype (D003), the single place it is derived. */
  phenotype: z.strictObject({
    element_id: z.literal("D003"),
    value: z.enum(["HFrEF", "HFmrEF", "HFpEF", "HFimpEF"]).nullable(),
    lvef: EvidenceZ.nullable(),
    detail: z.string(),
    decision_ids: z.array(z.string()),
  }),
  urgent: z.array(UrgentItemZ),
  domain_profile: z.array(DomainProfileZ),
  ranked_findings: z.array(FindingZ),
  /** Phase 5. Empty until implemented; see audit.warnings. */
  precursors: z.array(z.unknown()),
  /** Phase 6. Empty until implemented; see audit.warnings. */
  contributing_factors: z.array(z.unknown()),
  /** Phase 7. Empty until implemented; see audit.warnings. */
  risk_scores: z.array(z.unknown()),
  missing_data: z.array(MissingDataZ),
  needs_review: z.array(NeedsReviewZ),
  timeline: z.strictObject({ events: z.array(TimelineEventZ), daily_series: DailySeriesZ }),
  audit: z.strictObject({
    rules_evaluated: z.array(RuleEvaluationZ),
    thresholds_used: z.array(ThresholdUseZ),
    knowledge_rows_used: z.array(KnowledgeRefZ),
    warnings: z.array(z.string()),
    not_implemented: z.array(z.string()),
  }),
});
export type HolisticAnalysisBundle = z.infer<typeof BundleZ>;
