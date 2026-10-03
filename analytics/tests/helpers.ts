import { readFileSync, readdirSync } from "node:fs";
import { analyzePatient } from "../src/analyze";
import type { AnalysisConfig } from "../src/analyze";
import { PatientSnapshot } from "../src/model/snapshot";
import type { PatientSnapshotInput } from "../src/model/snapshot";

export const AS_OF = "2026-10-03T12:00:00Z";
const FIXTURES = new URL("../fixtures/", import.meta.url);

/** A parsed deep copy of a fixture, safe to mutate in a test. */
export function fixture(name: string): PatientSnapshot {
  return PatientSnapshot.parse(JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), "utf-8")));
}

/** Provenance for items added inside tests. */
export const confirmed = { source: "ehr", confirmed: true, reconciliation: "reconciled" } as const;

export const fixtureNames = () => readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();

export function run(snapshot: PatientSnapshotInput, asOf = AS_OF, config: AnalysisConfig = {}) {
  return analyzePatient(snapshot, asOf, config);
}

export const ruleOutcome = (b: ReturnType<typeof run>, ruleId: string) => b.audit.rules_evaluated.find((r) => r.rule_id === ruleId)!.outcome;
export const findingsFor = (b: ReturnType<typeof run>, ruleId: string) => b.ranked_findings.filter((f) => f.rule_id === ruleId);
