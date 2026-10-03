import type { PatientRecord, RiskSeverity } from "@/lib/types";

export type CaseSourceId = "passport" | "hospital" | "urgent" | "specialist" | "photon";
export type AgentStage = "gather" | "validate" | "normalize" | "reconcile" | "check" | "clarify" | "explain" | "route" | "complete";
export type TraceStatus = "ok" | "retry" | "failed" | "waiting" | "blocked" | "info";

export interface CaseSource {
  id: CaseSourceId;
  label: string;
  format: "fhir" | "photon-adapter" | "passport-share";
  available: boolean;
  lastUpdated: string;
  simulated: boolean;
}

export type MedicationRecordType = "prescribed" | "patient-reported" | "fulfillment";
export interface SourceMedication {
  id: string;
  ingredient: string;
  display: string;
  rxcui?: string;
  dose?: string;
  status: "active" | "stopped" | "unconfirmed" | "fulfilled";
  recordType: MedicationRecordType;
  sourceId: CaseSourceId;
  sourceLabel: string;
  recordedOn: string;
  author?: string;
}

export interface ReconciledMedication {
  ingredient: string;
  rxcui?: string;
  current: boolean;
  state: "confirmed" | "conflicting" | "awaiting-confirmation" | "review" | "fulfillment-only";
  records: SourceMedication[];
}

export interface Citation {
  sourceName: string;
  url: string;
  passage: string;
  retrievedOn: string;
}

export type FindingKind =
  | "interaction"
  | "status-conflict"
  | "strength-mismatch"
  | "stale-source"
  | "unavailable-source"
  | "needs-confirmation"
  | "drug-allergy"
  | "drug-nutrient"
  | "drug-mood"
  | "drug-vitals"
  | "drug-kidney"
  | "anticholinergic-burden"
  | "unmapped-medication";

/**
 * A Parthia safety-engine rule that contributed to a finding. Carried so the
 * review queue can show which rule decided, at what severity, on what data.
 */
export interface SupportingRule {
  ruleId: string;
  ruleName: string;
  severity: RiskSeverity;
  evidence: string[];
}

export interface ClinicianFinding {
  id: string;
  kind: FindingKind;
  priority: "high" | "moderate" | "data-quality";
  route: "pharmacist" | "clinician" | "patient";
  title: string;
  detail: string;
  question: string;
  ingredients: string[];
  recordIds: string[];
  citation?: Citation;
  supportingRules?: SupportingRule[];
  /**
   * Routed to a human and gating completion. Every finding sets this, at any
   * severity: a finding is a question, so a case cannot be complete until a
   * reviewer has answered it.
   */
  blocking: boolean;
}

export interface TraceEntry {
  seq: number;
  stage: AgentStage;
  tool: string;
  status: TraceStatus;
  summary: string;
  at: string;
}

export interface ClinicianDecision {
  findingId: string;
  action: "acknowledged" | "marked-for-review" | "deferred" | "declined-handoff" | "approved-photon-handoff";
  note: string;
  reviewer: string;
  at: string;
}

export interface ClinicianCase {
  patientId: string;
  patientName: string;
  age: number;
  conditions: string[];
  allergies: string[];
  sharedAt: string;
  sources: CaseSource[];
  records: SourceMedication[];
  /**
   * The patient's Passport record, when one exists. The Parthia safety engine
   * needs it for allergies, symptoms, nutrition, labs, vitals and screenings.
   * Passed in on the case so the agent stays a pure function of its input.
   */
  passport?: PatientRecord;
}

export interface AgentRun {
  stage: AgentStage;
  status: "needs-confirmation" | "review-required" | "incomplete" | "complete";
  sources: CaseSource[];
  records: SourceMedication[];
  medications: ReconciledMedication[];
  findings: ClinicianFinding[];
  trace: TraceEntry[];
  pendingQuestion?: { recordId: string; question: string };
  autonomousCount: number;
  humanCount: number;
}
