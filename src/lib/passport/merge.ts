import type { Medication, PatientRecord } from "../types";
import type { CollectionName, CollectionTypes, LocalPassport } from "./collections";

/**
 * Merge the bundled seed record with what the patient has stored locally.
 *
 * Only CONFIRMED entries are applied — pending imports never reach the
 * safety engine, the indicators or the clinician summary. A confirmed entry
 * with the same id as a seed item replaces it (an edit); `removed` entries
 * drop the item. Medications are split into the current list (active) and
 * `pastMedications` (stopped / on hold).
 */
export function mergeRecord(seed: PatientRecord, local: LocalPassport | undefined): PatientRecord {
  if (!local || local.entries.length === 0) return seed;
  const confirmed = local.entries.filter((e) => e.status === "confirmed");
  if (confirmed.length === 0) return seed;

  function apply<C extends CollectionName>(collection: C, base: CollectionTypes[C][]): CollectionTypes[C][] {
    const mine = confirmed.filter((e) => e.collection === collection);
    if (mine.length === 0) return base;
    const out = new Map<string, CollectionTypes[C]>(base.map((i) => [i.id, i]));
    for (const e of mine) {
      if (e.removed) out.delete(e.item.id);
      else out.set(e.item.id, e.item as CollectionTypes[C]);
    }
    return [...out.values()];
  }

  function applySingleton<C extends "nutritionProfile" | "emergency">(collection: C, base: CollectionTypes[C] | undefined): CollectionTypes[C] | undefined {
    const mine = confirmed.filter((e) => e.collection === collection);
    if (mine.length === 0) return base;
    const last = mine[mine.length - 1];
    return last.removed ? undefined : (last.item as CollectionTypes[C]);
  }

  const allMeds = apply("medications", [...seed.patient.medications, ...seed.pastMedications]);
  const isCurrent = (m: Medication) => (m.status ?? "active") === "active";

  return {
    patient: {
      ...seed.patient,
      conditions: apply("conditions", seed.patient.conditions),
      medications: allMeds.filter(isCurrent),
      medicationHistory: apply("medicationHistory", seed.patient.medicationHistory),
      labs: apply("labs", seed.patient.labs),
      vitals: apply("vitals", seed.patient.vitals),
    },
    pastMedications: allMeds.filter((m) => !isCurrent(m)),
    symptoms: apply("symptoms", seed.symptoms),
    moods: apply("moods", seed.moods),
    nutrition: apply("nutrition", seed.nutrition),
    allergies: apply("allergies", seed.allergies),
    appointments: apply("appointments", seed.appointments),
    encounters: apply("encounters", seed.encounters),
    labPanels: apply("labPanels", seed.labPanels),
    immunizations: apply("immunizations", seed.immunizations),
    procedures: apply("procedures", seed.procedures),
    careTeam: apply("careTeam", seed.careTeam),
    carePlans: apply("carePlans", seed.carePlans),
    documents: apply("documents", seed.documents),
    assessments: apply("assessments", seed.assessments),
    nutritionProfile: applySingleton("nutritionProfile", seed.nutritionProfile),
    emergency: applySingleton("emergency", seed.emergency),
  };
}
