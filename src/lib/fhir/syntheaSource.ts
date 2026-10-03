import type { PatientId } from "../types";
import type { FhirSource } from "./source";
import type { FhirBundle } from "./types";

export const SYNTHEA_PATIENT_ID: PatientId = "p-synthea-shaun";

/**
 * A curated subset of one unmodified Synthea-generated patient Bundle.
 * It deliberately travels through the production-shaped FHIR mapper and
 * patient review queue; it is not converted into Parthia seed objects.
 */
export const syntheaDemoSource: FhirSource = {
  id: "synthea-fhir-demo",
  name: "Synthea FHIR R4 sample",
  simulated: true,
  scopes: [],
  organization: () => "Synthea synthetic population",
  async authorize() {
    return {
      accessToken: "local-synthea-fixture",
      patient: "f6745f8a-8107-443e-8946-3e6329d20408",
      scope: "local read-only fixture",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      simulated: true,
    };
  },
  async fetchEverything(_session, patientId) {
    if (patientId !== SYNTHEA_PATIENT_ID) {
      throw new Error("Switch to the Synthea sample patient before importing this record.");
    }
    return import("./bundles/synthea-shaun.json").then((module) => module.default as unknown as FhirBundle);
  },
};
