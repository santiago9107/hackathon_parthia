/**
 * Data access layer — the Patient Passport seam.
 *
 * `getRecord(id)` returns the patient's Passport: the bundled synthetic seed
 * data merged with everything the patient has CONFIRMED on this device
 * (entries, edits, imports from documents, EHR, wearables and devices).
 * Pending imports are never included.
 *
 * Later this is where real integrations plug in:
 *   - `listPatients()`  → the signed-in patient only (no persona switcher)
 *   - seed data         → FHIR reads via `lib/fhir` (SMART on FHIR)
 *   - local store       → stays on the device; optional encrypted sync
 *
 * Keep UI code importing from here (or from the PatientContext) only, never
 * from the individual mock modules or the store directly for reads.
 */
import type { Patient, PatientId, PatientRecord } from "../types";
import { mergeRecord } from "../passport/merge";
import { passportStore } from "../passport/store";
import { patients } from "./patients";
import { entriesFor } from "./entries";
import { passportSeedFor } from "./passportSeed";
import { REFERENCE_DATE } from "./reference";

export { REFERENCE_DATE };

export function listPatients(): Patient[] {
  return patients;
}

export function getPatient(id: PatientId): Patient | undefined {
  return patients.find((p) => p.id === id);
}

/** The bundled sample Passport for a persona, before any local changes. */
export function getSeedRecord(id: PatientId): PatientRecord | undefined {
  const patient = getPatient(id);
  if (!patient) return undefined;
  // Import-only demo patients intentionally begin with an empty Passport.
  const passport = passportSeedFor(id) ?? {
    allergies: [], appointments: [], encounters: [], labPanels: [], immunizations: [], procedures: [],
    careTeam: [], carePlans: [], documents: [], assessments: [], socialHistory: [],
  };
  const { symptoms, moods, nutrition } = entriesFor(id);
  return { patient, pastMedications: [], symptoms, moods, nutrition, ...passport };
}

/** The patient's Passport: seed data + confirmed local data from this device. */
export function getRecord(id: PatientId): PatientRecord | undefined {
  const seed = getSeedRecord(id);
  if (!seed) return undefined;
  return mergeRecord(seed, passportStore.get(id));
}

/** The "now" the demo runs against (fixed so the seeded data stays coherent). */
export function referenceNow(): Date {
  return new Date(`${REFERENCE_DATE}T12:00:00`);
}

/**
 * Timestamp for something the patient logs now: the demo's date with the
 * current time of day, so new entries land inside the demo's analysis windows.
 */
export function demoTimestamp(real: Date = new Date()): string {
  const hh = String(real.getHours()).padStart(2, "0");
  const mm = String(real.getMinutes()).padStart(2, "0");
  return `${REFERENCE_DATE}T${hh}:${mm}:00`;
}
