/**
 * Mock data access layer.
 *
 * This is the seam that gets replaced by real integrations:
 *   - `listPatients()`  → FHIR Patient search (scoped to the signed-in user)
 *   - `getRecord(id)`   → FHIR MedicationStatement / Observation bundles
 *                          plus patient-reported entries from our own store
 *
 * Keep UI code importing from here (or from the PatientContext) only, never
 * from the individual mock modules, so the swap is a one-file change.
 */
import type { Patient, PatientId, PatientRecord } from "../types";
import { patients } from "./patients";
import { entriesFor, REFERENCE_DATE } from "./entries";

export { REFERENCE_DATE };

export function listPatients(): Patient[] {
  return patients;
}

export function getPatient(id: PatientId): Patient | undefined {
  return patients.find((p) => p.id === id);
}

export function getRecord(id: PatientId): PatientRecord | undefined {
  const patient = getPatient(id);
  if (!patient) return undefined;
  const { symptoms, moods, nutrition } = entriesFor(id);
  return { patient, symptoms, moods, nutrition };
}

/** The "now" the demo runs against (fixed so the seeded data stays coherent). */
export function referenceNow(): Date {
  return new Date(`${REFERENCE_DATE}T12:00:00`);
}
