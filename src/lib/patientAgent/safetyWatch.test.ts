import { describe, expect, it } from "vitest";
import { buildMedication } from "../log/entries";
import { getSeedRecord, referenceNow } from "../mockData";
import { emptyPassport, type LocalPassport } from "../passport/collections";
import { mergeRecord } from "../passport/merge";
import { upsertItems } from "../passport/ops";
import type { PatientRecord } from "../types";
import { evaluatePassportChange, patientOnlyMedications } from "./safetyWatch";

const now = referenceNow();
const AT = "2026-09-11T09:00:00";
const ALLERGY_RULE = "allergy/medication-conflict/al-h1";
const WARFARIN_PAIR = "drug-drug/known-pairs/warfarin+antiplatelet";

const harold = () => getSeedRecord("p-harold")!;

/** Advil 200 mg as needed, exactly as the medication form builds it. */
function advil() {
  return buildMedication(
    {
      name: "Advil",
      dose: "200",
      unit: "mg",
      frequency: "as needed",
      startDate: "2026-09-11",
      indication: "Knee pain",
      prescriber: "over the counter",
      status: "active",
      stoppedOn: "",
    },
    undefined,
    new Date(AT),
  );
}

function withAdvil(): { record: PatientRecord; local: LocalPassport } {
  const local = upsertItems(emptyPassport("p-harold"), "medications", [advil()], "confirmed", AT);
  return { record: mergeRecord(harold(), local), local };
}

describe("evaluatePassportChange, the one safety-watch seam", () => {
  it("Harold with no local data has nothing new since his last visit", () => {
    const baselineRecord = harold();
    const update = evaluatePassportChange({ record: baselineRecord, baselineRecord, now });
    expect(update.findings).toHaveLength(4);
    expect(update.newCount).toBe(0);
    expect(update.newFindings).toEqual([]);
    expect(update.updatedFindings).toEqual([]);
    expect(update.patientReportedOnly).toEqual([]);
  });

  it("a patient-entered Advil 200 mg adds exactly one new rule", () => {
    const { record, local } = withAdvil();
    const update = evaluatePassportChange({ record, baselineRecord: harold(), now, local });

    expect(update.findings).toHaveLength(5);
    expect(update.newCount).toBe(1);
    expect(update.newFindings.map((f) => f.ruleId)).toEqual([ALLERGY_RULE]);
    expect(update.newFindings[0].medications).toEqual(["Advil"]);
  });

  it("the existing warfarin pair is an UPDATED finding, not a new one", () => {
    const { record, local } = withAdvil();
    const update = evaluatePassportChange({ record, baselineRecord: harold(), now, local });

    const updated = update.updatedFindings.find((u) => u.flag.ruleId === WARFARIN_PAIR);
    expect(updated).toBeDefined();
    expect(updated!.addedMedications).toEqual(["Advil"]);
    expect(updated!.flag.medications).toEqual(["Warfarin", "Aspirin", "Advil"]);
    expect(update.newFindings.map((f) => f.ruleId)).not.toContain(WARFARIN_PAIR);
  });

  it("diffs by ruleId, because flag ids embed the medicine names", () => {
    const { record, local } = withAdvil();
    const baselineRecord = harold();
    const update = evaluatePassportChange({ record, baselineRecord, now, local });
    const pair = update.updatedFindings.find((u) => u.flag.ruleId === WARFARIN_PAIR)!;
    // Same rule, different id: an id diff would have called this a new finding.
    expect(pair.flag.id).toBe(`${WARFARIN_PAIR}:p-harold:Warfarin+Aspirin+Advil`);
  });

  it("marks a finding patient-reported-only when no connected record lists the medicine", () => {
    const { record, local } = withAdvil();
    const update = evaluatePassportChange({ record, baselineRecord: harold(), now, local });

    expect(patientOnlyMedications(record, local)).toEqual(["Advil"]);
    expect(update.patientReportedOnly.map((f) => f.ruleId)).toEqual([ALLERGY_RULE]);
    // The warfarin pair involves seed medicines too, so it is not patient-reported-only.
    expect(update.patientReportedOnly.map((f) => f.ruleId)).not.toContain(WARFARIN_PAIR);
  });

  it("stops calling it patient-reported once a connected record lists it", () => {
    const { record, local } = withAdvil();
    const connected: LocalPassport = {
      ...local,
      connections: [
        {
          id: "epic",
          kind: "ehr",
          name: "Epic MyChart (simulated)",
          status: "connected",
          simulated: true,
          connectedAt: AT,
          snapshot: {
            medications: [{ name: "Advil", genericName: "ibuprofen", dose: "200 mg", frequency: "as needed", status: "active" }],
            allergies: [],
          },
        },
      ],
    };
    const update = evaluatePassportChange({ record, baselineRecord: harold(), now, local: connected });
    expect(patientOnlyMedications(record, connected)).toEqual([]);
    expect(update.patientReportedOnly).toEqual([]);
  });
});
