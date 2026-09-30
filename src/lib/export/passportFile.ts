import type { PatientId, PatientRecord } from "../types";
import type { LocalPassport } from "../passport/collections";
import { importForReview } from "../passport/actions";
import { appendActivity } from "../passport/ops";
import { passportStore, type PassportStore } from "../passport/store";
import type { ImportPlan } from "../passport/importPlan";
import { prepareFhirImport } from "../fhir/importer";
import type { FhirBundle } from "../fhir/types";
import { toFhirBundle } from "./fhirExport";

/**
 * PASSPORT FILE — a portable copy of everything stored on this device.
 *
 * One JSON file with two views of the same Passport:
 *  - `passport`: the exact local data (entries with review status,
 *    provenance, activity log, connections, reconciliation choices), so
 *    importing it restores the Passport exactly;
 *  - `fhir`: a FHIR R4 Bundle of the confirmed record, readable by other
 *    health software.
 *
 * Plain FHIR Bundles (from another app or a patient portal) can be imported
 * too; their items arrive as "pending" and wait for the patient's review.
 */

export const PASSPORT_FILE_FORMAT = "parthia-patient-passport";
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export interface PassportFile {
  format: typeof PASSPORT_FILE_FORMAT;
  version: 1;
  exportedAt: string;
  app: string;
  /** Always true in this prototype. */
  synthetic: true;
  patient: { id: PatientId; name: string };
  passport: LocalPassport;
  fhir: FhirBundle;
}

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export function buildPassportFile(record: PatientRecord, local: LocalPassport | undefined, now: Date): PassportFile {
  const passport: LocalPassport = local ?? { schema: 1, patientId: record.patient.id, entries: [], activity: [], connections: [] };
  return {
    format: PASSPORT_FILE_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    app: "Parthia Health (prototype)",
    synthetic: true,
    patient: { id: record.patient.id, name: record.patient.name },
    passport,
    fhir: toFhirBundle(record, { now }),
  };
}

export function passportFileName(record: PatientRecord, now: Date, kind: "passport" | "fhir"): string {
  const who = record.patient.name.toLowerCase().replace(/[^a-z]+/g, "-");
  return `${who}-${kind === "passport" ? "passport" : "fhir-r4"}-${now.toISOString().slice(0, 10)}.json`;
}

function isLocalPassport(x: unknown): x is LocalPassport {
  const p = x as LocalPassport;
  return (
    !!p && p.schema === 1 && typeof p.patientId === "string" && Array.isArray(p.entries) && Array.isArray(p.activity) && Array.isArray(p.connections) &&
    p.entries.every((e) => e && typeof e.collection === "string" && e.item && typeof e.item.id === "string" && ["pending", "confirmed", "discarded"].includes(e.status))
  );
}

export type ParsedImport = { kind: "passport"; file: PassportFile } | { kind: "fhir"; bundle: FhirBundle };

/** Recognise a Passport file or a FHIR Bundle. Throws ImportFileError with a patient-friendly message. */
export function parseImportFile(text: string): ParsedImport {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportFileError("This file is too large to import (limit 50 MB).");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportFileError("This file isn't valid JSON. Choose a Passport file (.json) exported from Parthia, or a FHIR R4 Bundle.");
  }
  const d = data as Record<string, unknown>;
  if (d?.format === PASSPORT_FILE_FORMAT) {
    if (d.version !== 1) throw new ImportFileError("This Passport file was made by a newer version of Parthia.");
    if (!isLocalPassport(d.passport)) throw new ImportFileError("This Passport file is damaged or incomplete.");
    const file = d as unknown as PassportFile;
    if (file.passport.patientId !== file.patient?.id) throw new ImportFileError("This Passport file is damaged: the patient doesn't match its data.");
    return { kind: "passport", file };
  }
  if (d?.resourceType === "Bundle" && Array.isArray(d.entry)) return { kind: "fhir", bundle: d as unknown as FhirBundle };
  throw new ImportFileError("This doesn't look like a Passport file or a FHIR R4 Bundle.");
}

/** What a Passport file holds, for the confirmation screen. */
export function describePassportFile(file: PassportFile) {
  const live = file.passport.entries.filter((e) => !e.removed);
  return {
    confirmed: live.filter((e) => e.status === "confirmed").length,
    pending: live.filter((e) => e.status === "pending").length,
    activity: file.passport.activity.length,
    connections: file.passport.connections.length,
  };
}

/**
 * Replace this device's Passport for the file's patient with the file's
 * contents (the UI asks first). Only the sample patients exist in this demo.
 */
export async function restorePassportFile(file: PassportFile, knownPatients: PatientId[], store: PassportStore = passportStore): Promise<void> {
  if (!knownPatients.includes(file.patient.id)) throw new ImportFileError(`This Passport is for ${file.patient.name}, who isn't one of the sample patients in this demo.`);
  await store.update(file.patient.id, (_, at) =>
    appendActivity(structuredClone(file.passport), "restore", `Restored from a Passport file exported ${file.exportedAt.slice(0, 10)}`, at),
  );
}

/** A plain FHIR Bundle: map, de-duplicate and save for review — nothing is used until confirmed. */
export async function importFhirFile(bundle: FhirBundle, record: PatientRecord, fileName: string, store: PassportStore = passportStore): Promise<ImportPlan> {
  const { plan, identityMismatch } = prepareFhirImport(bundle, record, `FHIR file (${fileName})`, new Date().toISOString());
  if (identityMismatch) throw new ImportFileError(identityMismatch);
  if (Object.values(plan.batch).every((items) => !items?.length)) throw new ImportFileError("Everything in this file is already in your Passport.");
  await importForReview(record.patient.id, plan.batch, "ehr", `FHIR file ${fileName}`, store);
  return plan;
}
