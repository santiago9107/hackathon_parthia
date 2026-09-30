import type { PatientId } from "../types";
import type { FhirBundle } from "./types";

/**
 * A place FHIR data comes from. Shaped around the SMART App Launch flow
 * (authorize → token → read), so a real implementation can replace the
 * simulated one without touching the mapper or the UI.
 *
 * FUTURE — real Epic sandbox (not implemented in this prototype):
 *   const epicSandbox = createSmartOnFhirSource({
 *     fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
 *     clientId: "<registered at fhir.epic.com>",   // public client, PKCE
 *     redirectUri: "https://app.parthiahealth.com/passport/add/epic/callback/",
 *     scopes: EPIC_SCOPES,
 *   });
 *   authorize(): read /.well-known/smart-configuration, redirect to the
 *   authorization endpoint with PKCE, exchange the code for a token.
 *   fetchEverything(): Epic doesn't expose Patient/$everything to patient
 *   apps, so query each resource type with `?patient={id}` and assemble a
 *   Bundle. A static site can't keep a confidential secret; a public client
 *   with PKCE works in the browser, but refresh tokens and background sync
 *   need a small backend.
 */
export interface FhirSession {
  accessToken: string;
  /** FHIR id of the patient the token is scoped to. */
  patient: string;
  scope: string;
  expiresAt: string;
  simulated: boolean;
}

export interface FhirSource {
  id: string;
  /** Shown to the patient, e.g. "Epic MyChart (simulated)". */
  name: string;
  simulated: boolean;
  scopes: readonly string[];
  /** Health system this patient's record lives in. */
  organization(patientId: PatientId): string;
  authorize(patientId: PatientId): Promise<FhirSession>;
  fetchEverything(session: FhirSession, patientId: PatientId): Promise<FhirBundle>;
}

/** Read-only patient scopes requested (SMART v1 style, as Epic uses). */
export const EPIC_SCOPES = [
  "openid",
  "fhirUser",
  "patient/Patient.read",
  "patient/Condition.read",
  "patient/MedicationRequest.read",
  "patient/AllergyIntolerance.read",
  "patient/Observation.read",
  "patient/DiagnosticReport.read",
  "patient/Encounter.read",
  "patient/Appointment.read",
  "patient/Immunization.read",
  "patient/Procedure.read",
  "patient/CareTeam.read",
  "patient/Practitioner.read",
  "patient/CarePlan.read",
  "patient/DocumentReference.read",
] as const;

/** Exactly what an import brings in — listed on the consent screen. */
export const IMPORT_CONTENTS: readonly { label: string; detail: string; resource: string }[] = [
  { label: "Conditions", detail: "Your problem list (diagnoses)", resource: "Condition" },
  { label: "Medications", detail: "Prescriptions and doses on file", resource: "MedicationRequest" },
  { label: "Allergies", detail: "Allergies and intolerances", resource: "AllergyIntolerance" },
  { label: "Lab results", detail: "Results and lab panels", resource: "Observation, DiagnosticReport" },
  { label: "Vital signs", detail: "Blood pressure, heart rate and weight from visits", resource: "Observation" },
  { label: "Screenings and social history", detail: "PHQ-9 / GAD-7 scores, smoking and alcohol", resource: "Observation" },
  { label: "Visits and notes", detail: "Visit summaries and clinical notes, including dietitian and behavioral health notes", resource: "Encounter, DocumentReference" },
  { label: "Appointments", detail: "Upcoming and past appointments", resource: "Appointment" },
  { label: "Immunizations and procedures", detail: "Vaccines and procedures", resource: "Immunization, Procedure" },
  { label: "Care team and care plans", detail: "Your clinicians and their instructions", resource: "CareTeam, Practitioner, CarePlan" },
];

/** Not imported: billing, insurance, and anything outside the patient's own record. */
export const NOT_IMPORTED = ["Billing and insurance", "Other people's records", "Anything you haven't approved"];

const ORGS: Record<PatientId, string> = { "p-harold": "Riverside Health", "p-margaret": "Lakeside Medical", "p-rosa": "Mesa Valley Health" };

/** Loads the synthetic bundles lazily so they're not in the main app bundle. */
const BUNDLES: Record<PatientId, () => Promise<FhirBundle>> = {
  "p-harold": () => import("./bundles/p-harold.json").then((m) => m.default as unknown as FhirBundle),
  "p-margaret": () => import("./bundles/p-margaret.json").then((m) => m.default as unknown as FhirBundle),
  "p-rosa": () => import("./bundles/p-rosa.json").then((m) => m.default as unknown as FhirBundle),
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * SIMULATED Epic MyChart source — no network calls, no real Epic connection.
 * Returns a synthetic FHIR R4 Bundle for the demo persona.
 */
export const simulatedEpicSource: FhirSource = {
  id: "epic-simulated",
  name: "Epic MyChart (simulated)",
  simulated: true,
  scopes: EPIC_SCOPES,
  organization: (patientId) => ORGS[patientId] ?? "Demo Health System",
  async authorize(patientId) {
    await wait(400);
    return {
      accessToken: `simulated-${patientId}-${Date.now().toString(36)}`,
      patient: `epic-${patientId.replace(/^p-/, "")}`,
      scope: EPIC_SCOPES.join(" "),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      simulated: true,
    };
  },
  async fetchEverything(_session, patientId) {
    const load = BUNDLES[patientId];
    if (!load) throw new Error("No simulated record for this patient.");
    await wait(600);
    return load();
  },
};
