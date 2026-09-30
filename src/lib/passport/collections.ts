import type {
  ActivityEntry,
  Allergy,
  Appointment,
  CarePlan,
  CareTeamMember,
  Condition,
  EmergencyInfo,
  Encounter,
  HealthDocument,
  Immunization,
  ISODateTime,
  LabPanel,
  LabResult,
  Medication,
  MedicationEvent,
  MentalHealthAssessment,
  MoodCheckIn,
  NutritionEntry,
  NutritionProfile,
  PatientId,
  Procedure,
  SocialHistoryItem,
  SourceKind,
  SymptomEntry,
  VitalSign,
} from "../types";

/** Every kind of item the Passport stores, by collection name. */
export interface CollectionTypes {
  conditions: Condition;
  medications: Medication;
  medicationHistory: MedicationEvent;
  labs: LabResult;
  labPanels: LabPanel;
  vitals: VitalSign;
  symptoms: SymptomEntry;
  moods: MoodCheckIn;
  nutrition: NutritionEntry;
  allergies: Allergy;
  appointments: Appointment;
  encounters: Encounter;
  immunizations: Immunization;
  procedures: Procedure;
  careTeam: CareTeamMember;
  carePlans: CarePlan;
  documents: HealthDocument;
  assessments: MentalHealthAssessment;
  socialHistory: SocialHistoryItem;
  /** Singleton: one per patient (id = `np-<patientId>`). */
  nutritionProfile: NutritionProfile;
  /** Singleton: one per patient (id = `em-<patientId>`). */
  emergency: EmergencyInfo;
}

export type CollectionName = keyof CollectionTypes;
export type PassportItem = CollectionTypes[CollectionName];

export const SINGLETON_COLLECTIONS: ReadonlySet<CollectionName> = new Set<CollectionName>(["nutritionProfile", "emergency"]);

/** Human labels, used in review screens, the activity log and exports. */
export const COLLECTION_LABELS: Record<CollectionName, { one: string; many: string }> = {
  conditions: { one: "condition", many: "conditions" },
  medications: { one: "medication", many: "medications" },
  medicationHistory: { one: "medication change", many: "medication changes" },
  labs: { one: "lab result", many: "lab results" },
  labPanels: { one: "lab panel", many: "lab panels" },
  vitals: { one: "reading", many: "readings" },
  symptoms: { one: "symptom", many: "symptoms" },
  moods: { one: "mood check-in", many: "mood check-ins" },
  nutrition: { one: "meal", many: "meals" },
  allergies: { one: "allergy", many: "allergies" },
  appointments: { one: "appointment", many: "appointments" },
  encounters: { one: "visit summary", many: "visit summaries" },
  immunizations: { one: "immunization", many: "immunizations" },
  procedures: { one: "procedure", many: "procedures" },
  careTeam: { one: "care team member", many: "care team members" },
  carePlans: { one: "care plan", many: "care plans" },
  documents: { one: "document", many: "documents" },
  assessments: { one: "screening", many: "screenings" },
  socialHistory: { one: "social history item", many: "social history items" },
  nutritionProfile: { one: "nutrition profile", many: "nutrition profiles" },
  emergency: { one: "emergency info", many: "emergency info" },
};

/* ---- The locally stored part of a Passport ----------------------------- */

/**
 * pending   = imported or scanned, waiting for the patient to review
 * confirmed = the patient accepted it (or entered it themselves)
 * discarded = the patient rejected it (kept so re-imports don't resurrect it)
 */
export type ReviewStatus = "pending" | "confirmed" | "discarded";

export interface LocalEntry<C extends CollectionName = CollectionName> {
  collection: C;
  item: CollectionTypes[C];
  status: ReviewStatus;
  updatedAt: ISODateTime;
  /** The patient removed this item (seed or local). Merge drops it. */
  removed?: boolean;
}

/** A connected (or simulated) data source, shown on the Sources screen. */
export interface SourceConnection {
  id: string;
  kind: SourceKind;
  name: string;
  status: "connected" | "disconnected";
  simulated: boolean;
  connectedAt: ISODateTime;
  lastImportAt?: ISODateTime;
}

/**
 * Everything the device stores for one patient. Seed data is not stored —
 * it ships with the app — only what the patient added, imported or changed.
 */
export interface LocalPassport {
  schema: 1;
  patientId: PatientId;
  entries: LocalEntry[];
  activity: ActivityEntry[];
  connections: SourceConnection[];
}

export function emptyPassport(patientId: PatientId): LocalPassport {
  return { schema: 1, patientId, entries: [], activity: [], connections: [] };
}
