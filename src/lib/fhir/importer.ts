import type { PatientId, PatientRecord } from "../types";
import { importForReview, recordActivity, saveConnection } from "../passport/actions";
import { planImport, type ImportBatch, type ImportPlan } from "../passport/importPlan";
import { passportStore, type PassportStore } from "../passport/store";
import { mapBundle, type MappedPassport } from "./mapper";
import type { FhirBundle } from "./types";
import type { FhirSource } from "./source";

/**
 * Turn a FHIR Bundle into an import plan for this patient: map it, then drop
 * what's already in the Passport. Pure — used by the UI and the tests.
 */
export function prepareFhirImport(bundle: FhirBundle, record: PatientRecord, sourceLabel: string, importedAt: string): { mapped: MappedPassport; plan: ImportPlan; identityMismatch: string | null } {
  const mapped = mapBundle(bundle, { patientId: record.patient.id, sourceLabel, importedAt });
  const plan = planImport(mappedCollections(mapped), record);
  const incomingName = mapped.patient?.name?.toLowerCase().trim();
  const identityMismatch = incomingName && incomingName !== record.patient.name.toLowerCase().trim() ? `This record is for ${mapped.patient!.name}, not ${record.patient.name}.` : null;
  return { mapped, plan, identityMismatch };
}

/** Just the Passport collections from a mapped bundle (drops patient identity and warnings). */
export function mappedCollections(m: MappedPassport): ImportBatch {
  const batch: ImportBatch = {};
  for (const [k, v] of Object.entries(m)) if (k !== "patient" && k !== "warnings") (batch as Record<string, unknown>)[k] = v;
  return batch;
}

export interface FhirImportResult {
  plan: ImportPlan;
  warnings: string[];
}

/** Connect → fetch → map → de-duplicate → save for review → record the connection. */
export async function runFhirImport(source: FhirSource, patientId: PatientId, record: PatientRecord, store: PassportStore = passportStore): Promise<FhirImportResult> {
  const session = await source.authorize(patientId);
  const bundle = await source.fetchEverything(session, patientId);
  const importedAt = new Date().toISOString();
  const label = source.name;
  const { mapped, plan, identityMismatch } = prepareFhirImport(bundle, record, label, importedAt);
  if (identityMismatch) throw new Error(identityMismatch);
  await importForReview(patientId, plan.batch, "ehr", `${label} — ${source.organization(patientId)}`, store);
  await saveConnection(patientId, { id: source.id, kind: "ehr", name: label, status: "connected", simulated: source.simulated, connectedAt: importedAt, lastImportAt: importedAt }, store);
  const skipped = Object.values(plan.duplicates).reduce((s, n) => s + (n ?? 0), 0);
  if (skipped) await recordActivity(patientId, "import", `${skipped} item${skipped === 1 ? " was" : "s were"} already in your Passport and skipped`, "ehr", store);
  return { plan, warnings: mapped.warnings };
}
