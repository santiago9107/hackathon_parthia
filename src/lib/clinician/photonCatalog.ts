import catalog from "./photonTreatments.json";
/**
 * Typed view over the Photon Neutron sandbox ids looked up once (see
 * `photonTreatments.json` for the lookup date and the queries used).
 *
 * Nothing here prescribes. The catalog only names the drafts the demo is
 * allowed to screen, so a draft can never reach the sandbox by accident.
 */
export interface PhotonCatalogEntry {
  id: string;
  name: string;
  label: string;
}
export interface PhotonDemoPatient {
  externalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  /** Synthetic reserved-range number. The sandbox rejects a patient without one. */
  phone: string;
  allergenIds: string[];
  medicationIds: string[];
}
export const PHOTON_CATALOG_LOOKED_UP_ON = catalog.lookedUpOn;
const treatments = catalog.treatments as Record<string, PhotonCatalogEntry>;
const allergens = catalog.allergens as Record<string, PhotonCatalogEntry>;
export type PhotonTreatmentKey = keyof typeof catalog.treatments;
export function photonTreatment(key: string): PhotonCatalogEntry | undefined {
  return treatments[key];
}
export function photonTreatmentId(key: string): string {
  const entry = treatments[key];
  if (!entry) throw new Error(`Unknown Photon treatment key: ${key}`);
  return entry.id;
}
/** Label for a treatment or allergen id, for UI copy that must not echo raw ids. */
export function photonEntityLabel(id: string): string | undefined {
  return Object.values(treatments).find((entry) => entry.id === id)?.label
    ?? Object.values(allergens).find((entry) => entry.id === id)?.label;
}
/** Every id the server is willing to screen. Anything else fails closed. */
export function photonAllowedTreatmentIds(): string[] {
  return Object.values(treatments).map((entry) => entry.id);
}
/** The three drafts the demo screens, in demo order. */
export const PHOTON_DEMO_DRAFTS: { treatmentKey: string; label: string; expects: string }[] = catalog.demoDrafts.map((draft) => ({
  treatmentKey: draft.treatmentKey,
  label: photonTreatment(draft.treatmentKey)?.label ?? draft.treatmentKey,
  expects: draft.expects,
}));
/** Synthetic sandbox patient, resolved from catalog keys to sandbox ids. */
export function photonDemoPatient(): PhotonDemoPatient {
  const demo = catalog.demoPatient;
  return {
    externalId: demo.externalId,
    firstName: demo.firstName,
    lastName: demo.lastName,
    dateOfBirth: demo.dateOfBirth,
    sex: demo.sex as "MALE" | "FEMALE" | "UNKNOWN",
    phone: demo.phone,
    allergenIds: demo.allergenKeys.map((key) => {
      const entry = allergens[key];
      if (!entry) throw new Error(`Unknown Photon allergen key: ${key}`);
      return entry.id;
    }),
    medicationIds: demo.medicationHistoryKeys.map((key) => photonTreatmentId(key)),
  };
}
