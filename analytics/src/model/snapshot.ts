/**
 * PatientSnapshot: the analytics module's own input model.
 *
 * Every item carries its data-dictionary Element ID and provenance
 * (source + confirmed flag + reconciliation state). Only confirmed,
 * reconciled items are analysed; everything else is reported as
 * "needs review" (Dictionary guide rule 2).
 *
 * Dates are ISO-8601. Calendar dates ("2026-10-03") are read as UTC midnight.
 */
import { z } from "zod";

export const SOURCES = ["ehr", "scan", "patient", "device", "pharmacy", "care_plan", "calculated"] as const;

export const Provenance = z.strictObject({
  source: z.enum(SOURCES),
  /** Human-readable origin, e.g. "Urgent care prescription (scanned)". */
  source_label: z.string().optional(),
  /** Patient has reviewed and confirmed the item. */
  confirmed: z.boolean(),
  /** Cross-source reconciliation state. Only "reconciled" items are analysed. */
  reconciliation: z.enum(["reconciled", "pending", "conflict"]).default("reconciled"),
  /** Free-text note, e.g. what the conflict is. */
  note: z.string().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/, "ISO-8601 date or date-time");
const elementId = z.string().regex(/^D\d{3}$/);

const base = {
  id: z.string().min(1),
  element_id: elementId,
  provenance: Provenance,
};

export const Condition = z.strictObject({
  ...base,
  /** Stable key used by the module, e.g. "heart_failure", "atrial_fibrillation". */
  key: z.string(),
  name: z.string(),
  code_system: z.string().optional(),
  code: z.string().optional(),
  onset_date: isoDate.optional(),
  active: z.boolean(),
});

export const MedicationEvent = z.strictObject({
  type: z.enum(["start", "change", "stop"]),
  date: isoDate,
  detail: z.string().optional(),
});

export const Medication = z.strictObject({
  ...base,
  name: z.string(),
  /** Generic ingredient names, lower case. Combination products list all ingredients. */
  ingredients: z.array(z.string()).min(1),
  rxnorm: z.string().optional(),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  otc: z.boolean().default(false),
  prescriber: z.string().optional(),
  /** Start / change / stop history. A medicine is active when its last start-or-change precedes as_of and no stop follows. */
  events: z.array(MedicationEvent).min(1),
});

export const ANALYTES = ["potassium", "sodium", "creatinine", "egfr", "bnp", "ntprobnp", "magnesium", "inr", "hba1c", "lvef"] as const;
export type Analyte = (typeof ANALYTES)[number];

export const Lab = z.strictObject({
  ...base,
  analyte: z.enum(ANALYTES),
  value: z.number(),
  unit: z.string(),
  date: isoDate,
  /** Reference range reported by the lab with this result (threshold priority 2). */
  reference_range: z.strictObject({ low: z.number().optional(), high: z.number().optional() }).optional(),
});

export const Vital = z.strictObject({
  ...base,
  kind: z.enum(["weight", "blood_pressure", "heart_rate"]),
  datetime: isoDate,
  value: z.number().optional(),
  systolic: z.number().optional(),
  diastolic: z.number().optional(),
  unit: z.string(),
  /** Device reports an irregular rhythm (R18). */
  irregular: z.boolean().optional(),
});

/**
 * Daily symptom check-in (D014 checklist). An empty `reported` list means the
 * patient completed the check-in and reported none of the symptoms.
 */
export const SymptomCheckin = z.strictObject({
  ...base,
  datetime: isoDate,
  /** Codes from overrides.vocabularies.symptoms (D014 / T09). */
  reported: z.array(z.string()),
  note: z.string().optional(),
});

/** One diet log (a meal or a day). An empty tag list is a log with no risk tags. */
export const DietLog = z.strictObject({
  ...base,
  date: isoDate,
  /** Codes from overrides.vocabularies.diet_tags (D015). */
  tags: z.array(z.string()),
  note: z.string().optional(),
});

export const MoodScreening = z.strictObject({
  ...base,
  date: isoDate,
  instrument: z.enum(["PHQ-2", "PHQ-9"]),
  score: z.number().int().min(0),
  /** PHQ-9 item 9 (0-3). Required for PHQ-9 so the urgent pathway can be checked. */
  item9: z.number().int().min(0).max(3).optional(),
});

/** Weekly adherence check-in (D006). An empty `missed` list is a reported zero. */
export const AdherenceReport = z.strictObject({
  ...base,
  period_end: isoDate,
  period_days: z.number().int().positive(),
  missed: z.array(
    z.strictObject({
      medication_id: z.string(),
      date: isoDate,
      /** Code from overrides.vocabularies.missed_dose_reasons. */
      reason: z.string(),
      note: z.string().optional(),
    }),
  ),
});

export const ClinicalEvent = z.strictObject({
  ...base,
  type: z.enum(["er_visit", "hospitalization", "fall"]),
  start: isoDate,
  /** Discharge date for hospitalizations. */
  end: isoDate.optional(),
  reason: z.string().optional(),
});

export const CARE_PLAN_TARGETS = [
  "dry_weight",
  "weight_gain_1d_limit",
  "weight_gain_7d_limit",
  "bp_goal",
  "egfr_baseline",
  "bnp_baseline",
  "inr_range",
  "resting_hr_range",
  "fluid_limit",
] as const;

/** Clinician-set, patient-specific target (threshold priority 1). Tagged with the element it overrides. */
export const CarePlanTarget = z.strictObject({
  ...base,
  target: z.enum(CARE_PLAN_TARGETS),
  value: z.number().optional(),
  low: z.number().optional(),
  high: z.number().optional(),
  systolic: z.number().optional(),
  diastolic: z.number().optional(),
  unit: z.string(),
  set_on: isoDate,
  set_by: z.string().optional(),
  /** Patient-priority weight for prioritization (0-1), if the care plan states one. */
  patient_priority: z.number().min(0).max(1).optional(),
});

export const PatientSnapshot = z.strictObject({
  schema_version: z.literal("1"),
  patient_id: z.string().min(1),
  /** Synthetic data marker. Fixtures must set this to true. */
  synthetic: z.boolean(),
  profile: z.strictObject({
    display_name: z.string().optional(),
    age: z.number().int().nonnegative(),
    sex: z.enum(["female", "male", "other", "unknown"]),
  }),
  conditions: z.array(Condition).default([]),
  medications: z.array(Medication).default([]),
  labs: z.array(Lab).default([]),
  vitals: z.array(Vital).default([]),
  symptoms: z.array(SymptomCheckin).default([]),
  diet_logs: z.array(DietLog).default([]),
  mood: z.array(MoodScreening).default([]),
  adherence: z.array(AdherenceReport).default([]),
  events: z.array(ClinicalEvent).default([]),
  care_plan: z.array(CarePlanTarget).default([]),
});

export type PatientSnapshot = z.infer<typeof PatientSnapshot>;
export type PatientSnapshotInput = z.input<typeof PatientSnapshot>;
export type Condition = z.infer<typeof Condition>;
export type Medication = z.infer<typeof Medication>;
export type Lab = z.infer<typeof Lab>;
export type Vital = z.infer<typeof Vital>;
export type SymptomCheckin = z.infer<typeof SymptomCheckin>;
export type DietLog = z.infer<typeof DietLog>;
export type MoodScreening = z.infer<typeof MoodScreening>;
export type AdherenceReport = z.infer<typeof AdherenceReport>;
export type ClinicalEvent = z.infer<typeof ClinicalEvent>;
export type CarePlanTarget = z.infer<typeof CarePlanTarget>;
