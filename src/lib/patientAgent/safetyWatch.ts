/**
 * SAFETY WATCH: the single event-trigger seam of the patient agent.
 *
 * `evaluatePassportChange` is the ONLY place in the patient agent that re-runs
 * the safety engine. Every trigger site calls this one function: the dashboard
 * agent card, the log confirmation screens, the visit questions and the Ask
 * Parthia panel.
 *
 * M3 BUS SEAM: when the task bus lands, its handler for a passport-changed task
 * calls this same function with the same input and publishes the SafetyUpdate it
 * returns. Nothing else has to move, so there is no rework either way.
 *
 * "Since your last visit" means "not in the records your care team already has":
 * the baseline is the seed Passport (getSeedRecord) and the current state is the
 * seed plus whatever the patient has confirmed on this device (getRecord).
 *
 * Findings are diffed by `ruleId`, never by `RiskFlag.id`. `makeFlag` builds ids
 * as `ruleId:patientId:medications.join("+")`, so adding one medicine to an
 * existing interaction would otherwise look like a brand new finding.
 */
import type { LocalPassport } from "../passport/collections";
import type { ReconIssue } from "../reconcile";
import { evaluatePatient } from "../safetyEngine";
import type { PatientRecord, RiskFlag } from "../types";

export interface UpdatedFinding {
  flag: RiskFlag;
  /** Medicines involved now that were not involved at the baseline. */
  addedMedications: string[];
}

export interface SafetyUpdate {
  /** Every finding for the current Passport, highest severity first. */
  findings: RiskFlag[];
  /** Rules that did not fire at the baseline at all. */
  newFindings: RiskFlag[];
  /** Rules that fired before and now involve at least one more medicine. */
  updatedFindings: UpdatedFinding[];
  /** Findings whose medicines exist only in the patient's own entries. */
  patientReportedOnly: RiskFlag[];
  newCount: number;
}

export interface PassportChangeInput {
  record: PatientRecord;
  baselineRecord: PatientRecord;
  now: Date;
  issues?: ReconIssue[];
  local?: LocalPassport;
}

/**
 * Medicines the patient entered themselves that no connected health record
 * lists. A connected EHR only carries a `snapshot` once an import has run, so
 * with no connection every patient-entered medicine counts as patient-reported,
 * which is the honest reading.
 */
export function patientOnlyMedications(record: PatientRecord, local?: LocalPassport): string[] {
  const listed = new Set<string>();
  for (const c of local?.connections ?? []) {
    if (c.status !== "connected" || !c.snapshot) continue;
    for (const m of c.snapshot.medications) listed.add(m.genericName.toLowerCase());
  }
  return record.patient.medications
    .filter((m) => m.source.kind === "patient-entered" && !listed.has(m.genericName.toLowerCase()))
    .map((m) => m.name);
}

export function evaluatePassportChange(input: PassportChangeInput): SafetyUpdate {
  const { record, baselineRecord, now, local } = input;
  const findings = evaluatePatient(record, { now });
  const baseline = evaluatePatient(baselineRecord, { now });

  const before = new Map(baseline.map((f) => [f.ruleId, f]));
  const newFindings: RiskFlag[] = [];
  const updatedFindings: UpdatedFinding[] = [];

  for (const flag of findings) {
    const prior = before.get(flag.ruleId);
    if (!prior) {
      newFindings.push(flag);
      continue;
    }
    const known = new Set(prior.medications);
    const addedMedications = flag.medications.filter((m) => !known.has(m));
    if (addedMedications.length > 0) updatedFindings.push({ flag, addedMedications });
  }

  const patientOnly = new Set(patientOnlyMedications(record, local).map((n) => n.toLowerCase()));
  const patientReportedOnly = findings.filter(
    (f) => f.medications.length > 0 && f.medications.every((m) => patientOnly.has(m.toLowerCase())),
  );

  return { findings, newFindings, updatedFindings, patientReportedOnly, newCount: newFindings.length };
}
