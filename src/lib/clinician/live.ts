import {
  LIVE_SOURCE_LABEL,
  enrichLiveMedications,
  fetchSandboxBundle,
  type LiveMappingCounts,
  type SandboxPatient,
} from "@/lib/fhir/live";
import { mapBundle } from "@/lib/fhir/mapper";
import type { ClinicianCase, SourceMedication } from "./types";

export interface LiveClinicianCaseResult {
  caseData: ClinicianCase;
  counts: LiveMappingCounts;
  warnings: string[];
  fetchedAt: string;
}

function ageOn(birthDate: string | undefined, now = new Date()): number {
  if (!birthDate) return 0;
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return 0;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < born.getUTCMonth()
    || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age--;
  return Math.max(0, age);
}

/**
 * Turns a response fetched from the live SMART Health IT public FHIR R4 server
 * into the same evidence-preserving case shape used by the clinician agent.
 * The transport is live; the sandbox people are synthetic Synthea records.
 */
export async function buildLiveClinicianCase(patient: SandboxPatient): Promise<LiveClinicianCaseResult> {
  const fetchedAt = new Date().toISOString();
  const patientId = `smart-${patient.id}`;
  const bundle = await fetchSandboxBundle(patient.id);
  const mapped = mapBundle(bundle, { patientId, sourceLabel: LIVE_SOURCE_LABEL, importedAt: fetchedAt });
  const enriched = await enrichLiveMedications(mapped.medications);
  const records: SourceMedication[] = enriched.medications.map((medication) => ({
    id: `hospital:${medication.id}`,
    ingredient: medication.genericName.toLowerCase(),
    display: [medication.name, medication.dose].filter(Boolean).join(" "),
    rxcui: medication.rxNormCode,
    dose: medication.dose || undefined,
    status: medication.status === "active" ? "active" : "stopped",
    recordType: "prescribed",
    sourceId: "hospital",
    sourceLabel: "SMART Health IT R4 · live public sandbox",
    recordedOn: medication.startDate || fetchedAt.slice(0, 10),
    author: medication.prescriber,
  }));

  return {
    fetchedAt,
    counts: enriched.counts,
    warnings: mapped.warnings,
    caseData: {
      patientId,
      patientName: mapped.patient?.name || patient.name,
      age: ageOn(mapped.patient?.birthDate ?? patient.birthDate),
      conditions: mapped.conditions.filter((condition) => condition.clinicalStatus !== "resolved").map((condition) => condition.name),
      allergies: mapped.allergies.map((allergy) => allergy.substance),
      sharedAt: fetchedAt,
      sources: [{
        id: "hospital",
        label: "SMART Health IT R4 · live public sandbox",
        format: "fhir",
        available: true,
        lastUpdated: fetchedAt.slice(0, 10),
        simulated: false,
      }],
      records,
    },
  };
}
