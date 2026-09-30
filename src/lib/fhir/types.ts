/**
 * Minimal FHIR R4 types — only the fields Parthia reads. Hand-written so the
 * app stays dependency-free; they follow the R4 spec (hl7.org/fhir/R4).
 */

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Reference {
  reference?: string;
  display?: string;
}

export interface Quantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface HumanName {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface ContactPoint {
  system?: "phone" | "email" | "fax" | "url" | "sms" | "other";
  value?: string;
  use?: string;
}

interface ResourceBase {
  id: string;
  meta?: { lastUpdated?: string; source?: string; tag?: Coding[] };
}

export interface FhirPatient extends ResourceBase {
  resourceType: "Patient";
  name?: HumanName[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  telecom?: ContactPoint[];
}

export interface FhirCondition extends ResourceBase {
  resourceType: "Condition";
  clinicalStatus?: CodeableConcept;
  category?: CodeableConcept[];
  code?: CodeableConcept;
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface Dosage {
  text?: string;
  timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: "h" | "d" | "wk" | "mo"; when?: string[] }; code?: CodeableConcept };
  asNeededBoolean?: boolean;
  doseAndRate?: { doseQuantity?: Quantity }[];
}

export interface FhirMedicationRequest extends ResourceBase {
  resourceType: "MedicationRequest";
  status: "active" | "on-hold" | "cancelled" | "completed" | "entered-in-error" | "stopped" | "draft" | "unknown";
  intent: string;
  medicationCodeableConcept?: CodeableConcept;
  authoredOn?: string;
  requester?: Reference;
  reasonCode?: CodeableConcept[];
  dosageInstruction?: Dosage[];
}

/** What the patient says they take (vs. MedicationRequest: what was prescribed). */
export interface FhirMedicationStatement extends ResourceBase {
  resourceType: "MedicationStatement";
  status: "active" | "completed" | "entered-in-error" | "intended" | "stopped" | "on-hold" | "unknown" | "not-taken";
  medicationCodeableConcept?: CodeableConcept;
  subject?: Reference;
  effectivePeriod?: Period;
  dateAsserted?: string;
  informationSource?: Reference;
  reasonCode?: CodeableConcept[];
  dosage?: Dosage[];
}

export interface FhirAllergyIntolerance extends ResourceBase {
  resourceType: "AllergyIntolerance";
  clinicalStatus?: CodeableConcept;
  type?: "allergy" | "intolerance";
  category?: ("food" | "medication" | "environment" | "biologic")[];
  criticality?: "low" | "high" | "unable-to-assess";
  code?: CodeableConcept;
  recordedDate?: string;
  reaction?: { manifestation?: CodeableConcept[]; severity?: "mild" | "moderate" | "severe"; description?: string }[];
}

export interface FhirObservation extends ResourceBase {
  resourceType: "Observation";
  status: string;
  category?: CodeableConcept[];
  code: CodeableConcept;
  effectiveDateTime?: string;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  interpretation?: CodeableConcept[];
  referenceRange?: { low?: Quantity; high?: Quantity; text?: string }[];
  component?: { code: CodeableConcept; valueQuantity?: Quantity }[];
}

export interface FhirDiagnosticReport extends ResourceBase {
  resourceType: "DiagnosticReport";
  status: string;
  category?: CodeableConcept[];
  code: CodeableConcept;
  effectiveDateTime?: string;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  result?: Reference[];
}

export interface FhirEncounter extends ResourceBase {
  resourceType: "Encounter";
  status: string;
  class?: Coding;
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  participant?: { individual?: Reference }[];
  period?: Period;
  reasonCode?: CodeableConcept[];
  serviceProvider?: Reference;
}

export interface FhirAppointment extends ResourceBase {
  resourceType: "Appointment";
  status: "proposed" | "pending" | "booked" | "arrived" | "fulfilled" | "cancelled" | "noshow" | "entered-in-error" | "checked-in" | "waitlist";
  serviceType?: CodeableConcept[];
  specialty?: CodeableConcept[];
  reasonCode?: CodeableConcept[];
  description?: string;
  start?: string;
  participant?: { actor?: Reference; status?: string }[];
}

export interface FhirImmunization extends ResourceBase {
  resourceType: "Immunization";
  status: string;
  vaccineCode: CodeableConcept;
  occurrenceDateTime?: string;
  performer?: { actor?: Reference }[];
  protocolApplied?: { doseNumberPositiveInt?: number; seriesDosesPositiveInt?: number }[];
}

export interface FhirProcedure extends ResourceBase {
  resourceType: "Procedure";
  status: string;
  code?: CodeableConcept;
  performedDateTime?: string;
  performer?: { actor?: Reference }[];
  outcome?: CodeableConcept;
}

export interface FhirPractitioner extends ResourceBase {
  resourceType: "Practitioner";
  name?: HumanName[];
  telecom?: ContactPoint[];
  qualification?: { code: CodeableConcept }[];
}

export interface FhirCareTeam extends ResourceBase {
  resourceType: "CareTeam";
  status?: string;
  participant?: { role?: CodeableConcept[]; member?: Reference; onBehalfOf?: Reference }[];
  managingOrganization?: Reference[];
}

export interface FhirCarePlan extends ResourceBase {
  resourceType: "CarePlan";
  status: string;
  intent: string;
  title?: string;
  category?: CodeableConcept[];
  author?: Reference;
  created?: string;
  period?: Period;
  activity?: { detail?: { description?: string; status?: string } }[];
}

export interface FhirDocumentReference extends ResourceBase {
  resourceType: "DocumentReference";
  status: string;
  type?: CodeableConcept;
  category?: CodeableConcept[];
  date?: string;
  author?: Reference[];
  custodian?: Reference;
  description?: string;
  content: { attachment: { contentType?: string; data?: string; title?: string } }[];
  context?: { encounter?: Reference[]; period?: Period };
}

export type FhirResource =
  | FhirPatient
  | FhirCondition
  | FhirMedicationRequest
  | FhirMedicationStatement
  | FhirAllergyIntolerance
  | FhirObservation
  | FhirDiagnosticReport
  | FhirEncounter
  | FhirAppointment
  | FhirImmunization
  | FhirProcedure
  | FhirPractitioner
  | FhirCareTeam
  | FhirCarePlan
  | FhirDocumentReference;

export interface FhirBundle {
  resourceType: "Bundle";
  id?: string;
  type: "searchset" | "collection" | "document" | "transaction" | "batch";
  timestamp?: string;
  meta?: { tag?: Coding[] };
  entry?: { fullUrl?: string; resource: FhirResource | { resourceType: string; id?: string } }[];
}

export const SYSTEMS = {
  rxnorm: "http://www.nlm.nih.gov/research/umls/rxnorm",
  loinc: "http://loinc.org",
  snomed: "http://snomed.info/sct",
  icd10: "http://hl7.org/fhir/sid/icd-10-cm",
  cvx: "http://hl7.org/fhir/sid/cvx",
  ucum: "http://unitsofmeasure.org",
  obsCategory: "http://terminology.hl7.org/CodeSystem/observation-category",
} as const;
