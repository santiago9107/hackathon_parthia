/**
 * Parthia Health — core domain types.
 *
 * These types are designed to survive the move from synthetic data to real
 * integrations (FHIR R4 resources, EHR feeds, wearables). Where a FHIR
 * analogue exists it is noted in a comment so the mapping layer is obvious.
 */

/** ISO-8601 date-time string, e.g. "2026-09-11T08:30:00.000Z". */
export type ISODateTime = string;
/** ISO-8601 calendar date, e.g. "2026-09-11". */
export type ISODate = string;

export type PatientId = string;

export type ConditionCategory =
  | "diabetes"
  | "hypertension"
  | "cardiovascular"
  | "mental-health"
  | "other";

/** FHIR analogue: Condition */
export interface Condition {
  name: string;
  category: ConditionCategory;
  /** e.g. ICD-10 code; mocked for now. */
  code?: string;
  diagnosedOn?: ISODate;
}

/**
 * Coarse pharmacological class. Used by the safety engine to reason about
 * medications without needing a full drug ontology (RxNorm / ATC later).
 */
export type MedicationClass =
  | "anticoagulant"
  | "antiplatelet"
  | "statin"
  | "ace-inhibitor"
  | "arb"
  | "beta-blocker"
  | "calcium-channel-blocker"
  | "diuretic"
  | "potassium-sparing-diuretic"
  | "biguanide"
  | "sulfonylurea"
  | "sglt2-inhibitor"
  | "dpp4-inhibitor"
  | "insulin"
  | "ssri"
  | "snri"
  | "tricyclic-antidepressant"
  | "benzodiazepine"
  | "z-drug"
  | "antipsychotic"
  | "antihistamine"
  | "bladder-antimuscarinic"
  | "proton-pump-inhibitor"
  | "nsaid"
  | "opioid"
  | "thyroid"
  | "antiarrhythmic"
  | "nitrate"
  | "supplement"
  | "other";

/** FHIR analogue: MedicationStatement / MedicationRequest */
export interface Medication {
  id: string;
  name: string;
  /** Generic name used for rule matching (lower-case). */
  genericName: string;
  class: MedicationClass;
  dose: string;
  frequency: string;
  startDate: ISODate;
  indication?: string;
  /** Placeholder for an RxNorm concept id once real data flows in. */
  rxNormCode?: string;
}

export type MedicationEventType = "started" | "dose-changed" | "stopped";

/**
 * A change to the medication list. The mood-adherence rule looks at these
 * to see whether a patient's mood declined after a change.
 */
export interface MedicationEvent {
  id: string;
  patientId: PatientId;
  date: ISODate;
  medicationName: string;
  type: MedicationEventType;
  detail: string;
}

/** FHIR analogue: Observation (laboratory) */
export interface LabResult {
  id: string;
  patientId: PatientId;
  name: string;
  value: number;
  unit: string;
  date: ISODate;
  referenceRange: { low?: number; high?: number };
  status: "normal" | "borderline" | "abnormal";
}

/** FHIR analogue: Observation (vital-signs) */
export interface VitalSign {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  weightKg?: number;
}

/** FHIR analogue: Patient (+ linked resources) */
export interface Patient {
  id: PatientId;
  name: string;
  age: number;
  sex: "female" | "male" | "other";
  conditions: Condition[];
  medications: Medication[];
  /** Short blurb used by the patient switcher. */
  summary: string;
  primaryClinician: string;
  medicationHistory: MedicationEvent[];
  labs: LabResult[];
  vitals: VitalSign[];
}

/** 1 = severe / very low, 5 = mild / very good. Kept deliberately simple. */
export type Scale1to5 = 1 | 2 | 3 | 4 | 5;

export interface SymptomEntry {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  symptom: string;
  /** 1 = barely noticeable, 5 = severe. */
  severity: Scale1to5;
  note?: string;
}

export interface MoodCheckIn {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  /** 1 = very low, 5 = very good. */
  score: Scale1to5;
  note?: string;
}

/**
 * Tags that the safety engine understands. Keeping these as a closed set
 * keeps the rules inspectable; a real food database would map onto them.
 */
export type NutritionTag =
  | "high-vitamin-k"
  | "grapefruit"
  | "high-sodium"
  | "high-sugar"
  | "high-potassium"
  | "alcohol"
  | "caffeine"
  | "balanced";

export interface NutritionEntry {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  tags: NutritionTag[];
}

export type RiskCategory =
  | "drug-drug"
  | "drug-nutrient"
  | "drug-mood"
  | "anticholinergic-burden";

export type RiskSeverity = "low" | "moderate" | "high";

/**
 * A single, explainable finding from the safety engine. Every flag carries
 * the rule that produced it and the evidence it used so nothing is a black box.
 */
export interface RiskFlag {
  id: string;
  patientId: PatientId;
  /** Which rule fired (see lib/safetyEngine/rules). */
  ruleId: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  medications: string[];
  explanation: string;
  /**
   * Always phrased as a question to raise with a clinician, never as an
   * instruction to change treatment.
   */
  suggestedNextStep: string;
  /** Concrete data points the rule relied on. */
  evidence: string[];
  detectedAt: ISODateTime;
}

/** Everything the safety engine needs for one patient. */
export interface PatientRecord {
  patient: Patient;
  symptoms: SymptomEntry[];
  moods: MoodCheckIn[];
  nutrition: NutritionEntry[];
}

export type StatusLevel = "good" | "watch" | "attention";

export interface DomainIndicator {
  domain: "medication-safety" | "physical" | "mental-health" | "nutrition";
  label: string;
  level: StatusLevel;
  headline: string;
  detail: string;
  /** Optional small metric shown on the card, e.g. "3.2 / 5". */
  metric?: string;
}
