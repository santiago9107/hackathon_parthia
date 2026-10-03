import { buildClinicianCase } from "./cases";
import { runClinicianAgent } from "./agent";
import type { CaseSourceId } from "./types";

export interface EvaluationCase { id: string; name: string; patientId: string; confirmations?: Record<string, boolean>; unavailable?: CaseSourceId; expected: string[]; prohibited: string[]; }
export const EVALUATION_CASES: EvaluationCase[] = [
  { id: "h-unconfirmed", name: "OTC waits for patient", patientId: "p-harold", expected: ["confirm:passport:otc-ibuprofen"], prohibited: ["interaction:ibuprofen+warfarin"] },
  { id: "h-confirmed", name: "Confirmed OTC interaction", patientId: "p-harold", confirmations: { "passport:otc-ibuprofen": true }, expected: ["interaction:ibuprofen+warfarin", "interaction:ciprofloxacin+warfarin"], prohibited: [] },
  { id: "h-denied", name: "Patient denies OTC", patientId: "p-harold", confirmations: { "passport:otc-ibuprofen": false }, expected: ["interaction:ciprofloxacin+warfarin"], prohibited: ["interaction:ibuprofen+warfarin"] },
  { id: "h-source-down", name: "Unavailable source stays incomplete", patientId: "p-harold", unavailable: "urgent", confirmations: { "passport:otc-ibuprofen": false }, expected: ["unavailable:urgent"], prohibited: ["interaction:ciprofloxacin+warfarin"] },
  { id: "h-status", name: "Cross-source stopped conflict", patientId: "p-harold", confirmations: { "passport:otc-ibuprofen": false }, expected: ["status:metoprolol"], prohibited: [] },
  { id: "h-stale", name: "Stale specialist is data quality", patientId: "p-harold", confirmations: { "passport:otc-ibuprofen": false }, expected: ["stale:specialist"], prohibited: [] },
  { id: "m-unconfirmed", name: "Second patient's OTC waits", patientId: "p-margaret", expected: ["confirm:passport:otc-diphenhydramine"], prohibited: ["interaction:ibuprofen+warfarin"] },
  { id: "m-confirmed", name: "Confirmed OTC burden and drowsiness", patientId: "p-margaret", confirmations: { "passport:otc-diphenhydramine": true }, expected: ["rule:burden/anticholinergic-score:carvedilol+diphenhydramine+furosemide+oxybutynin", "interaction:diphenhydramine+sertraline", "interaction:sertraline+zolpidem"], prohibited: [] },
  { id: "m-denied", name: "Denied report does not become current", patientId: "p-margaret", confirmations: { "passport:otc-diphenhydramine": false }, expected: [], prohibited: ["interaction:ibuprofen+warfarin"] },
  { id: "r-safe", name: "Consistent record does not cry wolf", patientId: "p-rosa", expected: [], prohibited: ["interaction:ibuprofen+warfarin", "interaction:ciprofloxacin+warfarin"] },
  { id: "r-outage", name: "Safe patient still reports outage", patientId: "p-rosa", unavailable: "photon", expected: ["unavailable:photon"], prohibited: ["interaction:ibuprofen+warfarin"] },
  { id: "h-photon-down", name: "Fulfillment outage preserves clinical findings", patientId: "p-harold", unavailable: "photon", confirmations: { "passport:otc-ibuprofen": true }, expected: ["interaction:ibuprofen+warfarin"], prohibited: ["unavailable:urgent"] },
  { id: "h-hospital-down", name: "Hospital outage prevents completeness", patientId: "p-harold", unavailable: "hospital", confirmations: { "passport:otc-ibuprofen": true }, expected: ["unavailable:hospital"], prohibited: [] },
];

export function runEvaluation() {
  return EVALUATION_CASES.map((test) => {
    const available = test.unavailable ? { [test.unavailable]: false } : undefined;
    const run = runClinicianAgent(buildClinicianCase(test.patientId), { available, confirmations: test.confirmations });
    const found = run.findings.map((f) => f.id);
    const missed = test.expected.filter((id) => !found.includes(id));
    const prohibited = test.prohibited.filter((id) => found.includes(id));
    return { ...test, found, missed, prohibitedFound: prohibited, passed: !missed.length && !prohibited.length };
  });
}
