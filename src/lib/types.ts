/**
 * Parthia Health — core domain types.
 *
 * These types are designed to survive the move from synthetic data to real
 * integrations (FHIR R4 resources, EHR feeds, wearables). Where a FHIR
 * analogue exists it is noted in a comment so the mapping layer is obvious.
 */

/** ISO-8601 date-time string, e.g. "2026-10-03T08:30:00.000Z". */
export type ISODateTime = string;
/** ISO-8601 calendar date, e.g. "2026-10-03". */
export type ISODate = string;

export type PatientId = string;

/* ---- Provenance --------------------------------------------------------- */

/**
 * Where a piece of Passport data came from. Every item in the Passport
 * carries one so the patient (and their clinicians) can always see its origin.
 *
 * FHIR analogue: Provenance (+ meta.source / meta.tag on each resource)
 */
export type SourceKind = "seed" | "patient-entered" | "document-scan" | "ehr" | "wearable" | "device";

export interface DataSource {
  kind: SourceKind;
  /** Human-readable origin, e.g. "Sample data", "Epic MyChart (simulated)", "Scanned prescription". */
  label: string;
  importedAt: ISODateTime;
  /**
   * True once the patient has reviewed and confirmed the item. Unverified
   * items are shown for review but never used in analysis.
   */
  verified: boolean;
  /** 0–1 extraction confidence for OCR / parsed items. */
  confidence?: number;
  /** The raw text the item was extracted from (OCR line, note excerpt). */
  originalText?: string;
  /** Id of the document or connection this item came from, if any. */
  refId?: string;
}

/** Anything that lives in the Passport. */
export interface Sourced {
  source: DataSource;
}

export type ConditionCategory =
  | "diabetes"
  | "hypertension"
  | "cardiovascular"
  | "mental-health"
  | "other";

/** FHIR analogue: Condition */
export interface Condition extends Sourced {
  id: string;
  name: string;
  category: ConditionCategory;
  /** e.g. ICD-10 code; mocked for now. */
  code?: string;
  /** SNOMED CT concept id, when the source provides one. */
  snomedCode?: string;
  diagnosedOn?: ISODate;
  clinicalStatus?: "active" | "resolved";
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
export interface Medication extends Sourced {
  id: string;
  name: string;
  /** Generic name used for rule matching (lower-case). */
  genericName: string;
  class: MedicationClass;
  dose: string;
  frequency: string;
  startDate: ISODate;
  indication?: string;
  /** RxNorm concept id (ingredient level) when known. */
  rxNormCode?: string;
  /** Who prescribed it (or "Self / over the counter"). */
  prescriber?: string;
  /** Only "active" medications are part of the current list. Defaults to active. */
  status?: "active" | "stopped" | "on-hold";
  stoppedOn?: ISODate;
}

export type MedicationEventType = "started" | "dose-changed" | "stopped";

/**
 * A change to the medication list. The mood-adherence rule looks at these
 * to see whether a patient's mood declined after a change.
 */
export interface MedicationEvent extends Sourced {
  id: string;
  patientId: PatientId;
  date: ISODate;
  medicationName: string;
  type: MedicationEventType;
  detail: string;
}

/** FHIR analogue: Observation (laboratory) */
export interface LabResult extends Sourced {
  id: string;
  patientId: PatientId;
  name: string;
  /** LOINC code, used to match the same test across sources. */
  loincCode?: string;
  /** The panel (DiagnosticReport) this result belongs to. */
  panelId?: string;
  value: number;
  unit: string;
  date: ISODate;
  referenceRange: { low?: number; high?: number };
  status: "normal" | "borderline" | "abnormal";
}

/** Where a blood-pressure reading was taken. */
export type MeasurementSetting = "clinic" | "home-cuff" | "wearable" | "manual";

/** FHIR analogue: Observation (vital-signs, activity, sleep) */
export interface VitalSign extends Sourced {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  /** Resting heart rate (beats/min), typically from a wearable. */
  restingHeartRate?: number;
  weightKg?: number;
  /** Steps for the day ending at `timestamp`. */
  steps?: number;
  /** Hours asleep for the night ending at `timestamp`. */
  sleepHours?: number;
  /** Where the blood pressure was measured. */
  bpSetting?: MeasurementSetting;
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

export interface SymptomEntry extends Sourced {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  symptom: string;
  /** 1 = barely noticeable, 5 = severe. */
  severity: Scale1to5;
  note?: string;
}

export interface MoodCheckIn extends Sourced {
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

/** Patient-confirmed approximations, optionally prefilled by meal-photo AI. */
export interface NutrientEstimate {
  caloriesKcal?: number;
  proteinG?: number;
  carbohydratesG?: number;
  sodiumMg?: number;
  sugarG?: number;
  potassiumMg?: number;
  vitaminKMcg?: number;
}

export interface NutritionEntry extends Sourced {
  id: string;
  patientId: PatientId;
  timestamp: ISODateTime;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  tags: NutritionTag[];
  /** A compact on-device preview; the original photo is never retained. */
  photoDataUrl?: string;
  /** Free-text serving approximation, e.g. "1 bowl" or "about 2 cups". */
  portion?: string;
  /** Ingredients the patient knows are present; a photo cannot establish these. */
  ingredients?: string[];
  /** Optional estimates from a label, the patient, or AI and then confirmed by the patient. */
  estimatedNutrients?: NutrientEstimate;
}

/* ---- Patient Passport ----------------------------------------------------- */

/** FHIR analogue: AllergyIntolerance */
export interface Allergy extends Sourced {
  id: string;
  patientId: PatientId;
  /** What the patient reacts to, as written (e.g. "Ibuprofen", "Penicillin", "Shellfish"). */
  substance: string;
  category: "medication" | "food" | "environment" | "other";
  /**
   * For medication allergies: generic names and/or medication classes that
   * this allergy covers, so the safety engine can match it against the list.
   */
  matches?: { genericNames?: string[]; classes?: MedicationClass[] };
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
  /** "intolerance" = side effect, not immune-mediated. FHIR AllergyIntolerance.type */
  type?: "allergy" | "intolerance";
  recordedOn?: ISODate;
  /** RxNorm or SNOMED CT code, when the source provides one. */
  code?: string;
}

/** FHIR analogue: Appointment */
export interface Appointment extends Sourced {
  id: string;
  patientId: PatientId;
  start: ISODateTime;
  status: "booked" | "fulfilled" | "cancelled" | "noshow";
  clinician: string;
  specialty: string;
  location?: string;
  reason: string;
  /** Visit summary for this appointment, once it has happened. */
  encounterId?: string;
  /** Things the patient wants to bring up. */
  patientNotes?: string;
}

export type EncounterType = "office" | "telehealth" | "urgent-care" | "emergency" | "hospital" | "lab" | "therapy";

/** A visit and its summary. FHIR analogue: Encounter (+ DocumentReference for the note) */
export interface Encounter extends Sourced {
  id: string;
  patientId: PatientId;
  date: ISODate;
  type: EncounterType;
  clinician: string;
  specialty: string;
  organization?: string;
  reason: string;
  /** Plain-language visit summary / clinician note. */
  summary: string;
  /** Diagnoses discussed, as text. */
  diagnoses?: string[];
  /** The full note, if it was imported as a document. */
  documentId?: string;
}

/** A group of lab results ordered together. FHIR analogue: DiagnosticReport */
export interface LabPanel extends Sourced {
  id: string;
  patientId: PatientId;
  name: string;
  /** LOINC panel code, when available. */
  code?: string;
  date: ISODate;
  orderedBy?: string;
  performer?: string;
}

/** FHIR analogue: Immunization */
export interface Immunization extends Sourced {
  id: string;
  patientId: PatientId;
  vaccine: string;
  date: ISODate;
  /** CVX code, when available. */
  cvxCode?: string;
  doseNote?: string;
  performer?: string;
}

/** FHIR analogue: Procedure */
export interface Procedure extends Sourced {
  id: string;
  patientId: PatientId;
  name: string;
  date: ISODate;
  /** SNOMED CT / CPT code, when available. */
  code?: string;
  performer?: string;
  outcome?: string;
}

export type CareTeamRole =
  | "primary-care"
  | "specialist"
  | "pharmacist"
  | "dietitian"
  | "psychologist"
  | "psychiatrist"
  | "nurse"
  | "caregiver"
  | "other";

/** FHIR analogue: CareTeam.participant → Practitioner / RelatedPerson */
export interface CareTeamMember extends Sourced {
  id: string;
  patientId: PatientId;
  name: string;
  role: CareTeamRole;
  specialty?: string;
  organization?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

/** Clinician instructions. FHIR analogue: CarePlan (activity + description) */
export interface CarePlan extends Sourced {
  id: string;
  patientId: PatientId;
  title: string;
  category: "medication" | "monitoring" | "lifestyle" | "nutrition" | "mental-health" | "follow-up";
  author: string;
  date: ISODate;
  instructions: string[];
  status: "active" | "completed";
}

export type DocumentType =
  | "prescription"
  | "lab-report"
  | "visit-summary"
  | "dietitian-note"
  | "behavioral-health-note"
  | "discharge-summary"
  | "other";

/** An imported or scanned document. FHIR analogue: DocumentReference */
export interface HealthDocument extends Sourced {
  id: string;
  patientId: PatientId;
  title: string;
  type: DocumentType;
  date: ISODate;
  author?: string;
  organization?: string;
  /** Recognized or imported text. */
  text?: string;
  /** Image of the original (scans only), as a data URL. Stored only on the device. */
  imageDataUrl?: string;
}

/** FHIR analogue: NutritionOrder / Observation (dietary pattern) + dietitian notes */
export interface NutritionProfile extends Sourced {
  id: string;
  patientId: PatientId;
  dietaryPattern: string;
  /** Things to limit or avoid, as advised or chosen (e.g. "Sodium under 2 g/day"). */
  restrictions: string[];
  /** Food allergies and intolerances (medication allergies live in Allergy). */
  intolerances: string[];
  goals: string[];
  dietitianNotes: { date: ISODate; author: string; note: string }[];
  updatedAt: ISODateTime;
}

export type ScreeningInstrument = "PHQ-9" | "GAD-7";

/**
 * A screening questionnaire result. Screenings are not diagnoses.
 * FHIR analogue: QuestionnaireResponse + Observation (total score)
 */
export interface MentalHealthAssessment extends Sourced {
  id: string;
  patientId: PatientId;
  instrument: ScreeningInstrument;
  date: ISODate;
  score: number;
  /** Standard severity band, e.g. "Mild", "Moderately severe". */
  severity: string;
  /** Item answers 0–3, in questionnaire order, when available. */
  answers?: number[];
  administeredBy: "self" | "clinician";
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/** The critical information for the emergency card. FHIR analogue: Patient + curated summary */
export interface EmergencyInfo extends Sourced {
  id: string;
  patientId: PatientId;
  bloodType?: string;
  contacts: EmergencyContact[];
  /** Allergies to show prominently (free text, curated by the patient). */
  criticalAllergies: string[];
  /** Conditions first responders should know about. */
  criticalConditions: string[];
  /** Anything else, e.g. "Takes a blood thinner", "Advance directive on file with Dr. Nwosu". */
  notes?: string;
  updatedAt: ISODateTime;
}

/** Smoking, alcohol, activity and similar. FHIR analogue: Observation (category social-history) */
export interface SocialHistoryItem extends Sourced {
  id: string;
  patientId: PatientId;
  category: "tobacco" | "alcohol" | "physical-activity" | "other";
  /** Plain-language value, e.g. "Former smoker (quit 2009)", "1–2 drinks a week". */
  value: string;
  date: ISODate;
  /** LOINC code of the observation, when available. */
  code?: string;
}

/** A record of something that happened to the Passport. */
export interface ActivityEntry {
  id: string;
  patientId: PatientId;
  at: ISODateTime;
  action: "import" | "add" | "edit" | "confirm" | "discard" | "export" | "share" | "restore" | "lock" | "unlock" | "reset";
  summary: string;
  sourceKind?: SourceKind;
}

export type RiskCategory =
  | "drug-drug"
  | "drug-nutrient"
  | "drug-mood"
  | "anticholinergic-burden"
  | "drug-vitals"
  | "drug-allergy"
  | "drug-kidney";

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

/**
 * The Patient Passport: everything known about one patient, from every
 * source, as the patient has confirmed it. This is the unit the safety
 * engine evaluates. It only ever contains confirmed (verified) items.
 *
 * FHIR analogue: Bundle (type "collection") of the patient's resources
 */
export interface PatientRecord {
  /** `patient.medications` is the CURRENT list (active only); see `pastMedications`. */
  patient: Patient;
  /** Stopped or on-hold medications, kept for history. */
  pastMedications: Medication[];
  symptoms: SymptomEntry[];
  moods: MoodCheckIn[];
  nutrition: NutritionEntry[];
  allergies: Allergy[];
  appointments: Appointment[];
  encounters: Encounter[];
  labPanels: LabPanel[];
  immunizations: Immunization[];
  procedures: Procedure[];
  careTeam: CareTeamMember[];
  carePlans: CarePlan[];
  documents: HealthDocument[];
  assessments: MentalHealthAssessment[];
  socialHistory: SocialHistoryItem[];
  nutritionProfile?: NutritionProfile;
  emergency?: EmergencyInfo;
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
