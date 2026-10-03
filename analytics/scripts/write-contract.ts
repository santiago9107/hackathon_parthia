/**
 * Regenerates the published contract from the zod source of truth:
 *   contract/holistic_bundle.schema.json, contract/patient_snapshot.schema.json,
 *   contract/examples/<persona>.json
 *
 *   npm run schema
 */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { BundleZ } from "../src/model/bundle";
import { PatientSnapshot } from "../src/model/snapshot";
import { analyzePatient } from "../src/analyze";

export const AS_OF = "2026-10-03T12:00:00Z";
export const PERSONAS = ["margaret", "harold", "rosa"] as const;

export function bundleSchema(): string {
  const schema = z.toJSONSchema(BundleZ, { target: "draft-2020-12" });
  return JSON.stringify({ $id: "parthia/analytics/holistic_bundle.schema.json", title: "HolisticAnalysisBundle", ...schema }, null, 2) + "\n";
}

export function snapshotSchema(): string {
  const schema = z.toJSONSchema(PatientSnapshot, { target: "draft-2020-12", io: "input" });
  return JSON.stringify({ $id: "parthia/analytics/patient_snapshot.schema.json", title: "PatientSnapshot", ...schema }, null, 2) + "\n";
}

export function example(persona: string): string {
  const snap = JSON.parse(readFileSync(new URL(`../fixtures/${persona}.json`, import.meta.url), "utf-8"));
  return JSON.stringify(analyzePatient(snap, AS_OF), null, 2) + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL("../contract/holistic_bundle.schema.json", import.meta.url), bundleSchema());
  writeFileSync(new URL("../contract/patient_snapshot.schema.json", import.meta.url), snapshotSchema());
  for (const p of PERSONAS) writeFileSync(new URL(`../contract/examples/${p}.json`, import.meta.url), example(p));
  console.log(`Wrote contract schemas and ${PERSONAS.length} example bundles (as_of ${AS_OF}).`);
}
