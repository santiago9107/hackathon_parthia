import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { emptyPassport } from "../passport/collections";
import { mergeRecord } from "../passport/merge";
import { upsertItems } from "../passport/ops";
import { buildMedication } from "../log/entries";
import { simulateBpSync } from "../devices/bpMonitor";
import { decodeWithProgress, parseAppleHealth } from "../appleHealth/parser";
import { openAppleHealthXml } from "../appleHealth/zip";
import type { Allergy, LabResult, MentalHealthAssessment, PatientRecord, VitalSign } from "../types";
import { evaluatePatient } from ".";
import { allergyConflictRule, decliningEgfrRule, lowBpMultipleAgentsRule, lowRestingHrBetaBlockerRule, phq9RiseAfterChangeRule } from "./rules/passport";

const now = referenceNow();
const ctx = { now };
const AT = "2026-10-03T09:00:00";
const src = (kind: "device" | "wearable" | "patient-entered" = "device", label = "Test") => ({ kind, label, importedAt: AT, verified: true });

function withConfirmed(r: PatientRecord, items: Partial<Record<"vitals" | "medications" | "labs" | "allergies" | "assessments", unknown[]>>) {
  let local = emptyPassport(r.patient.id);
  for (const [c, list] of Object.entries(items)) local = upsertItems(local, c as never, list as never, "confirmed", AT);
  return mergeRecord(r, local);
}

describe("low blood pressure on several BP medicines", () => {
  const margaret = getSeedRecord("p-margaret")!;

  it("doesn't fire on Margaret's seed readings alone", () => {
    expect(lowBpMultipleAgentsRule.evaluate(margaret, ctx)).toEqual([]);
  });

  it("fires once her home cuff syncs repeated low morning readings", () => {
    const r = withConfirmed(margaret, { vitals: simulateBpSync("p-margaret", "2026-10-03", 14, AT) });
    const [f] = lowBpMultipleAgentsRule.evaluate(r, ctx);
    expect(f.severity).toMatch(/moderate|high/);
    expect(f.medications).toEqual(expect.arrayContaining(["Amlodipine", "Furosemide", "Carvedilol"]));
    expect(f.evidence.join(" ")).toMatch(/Blood pressure monitor \(simulated\)/);
    expect(f.suggestedNextStep).toMatch(/^Ask your doctor/);
  });

  it("needs two or more BP-lowering medicines", () => {
    const rosa = getSeedRecord("p-rosa")!;
    const oneMed = { ...rosa, patient: { ...rosa.patient, medications: rosa.patient.medications.filter((m) => m.class !== "diuretic") } };
    const lows: VitalSign[] = [1, 2, 3, 4].map((d) => ({ id: `v${d}`, patientId: "p-rosa", timestamp: `2026-09-${d + 25}T08:00:00`, systolic: 92, diastolic: 58, source: src() }));
    expect(lowBpMultipleAgentsRule.evaluate(withConfirmed(oneMed, { vitals: lows }), ctx)).toEqual([]);
    expect(lowBpMultipleAgentsRule.evaluate(withConfirmed(rosa, { vitals: lows }), ctx)).toHaveLength(1);
  });
});

describe("low resting heart rate on a beta-blocker", () => {
  it("fires for Harold (metoprolol) after importing the sample Apple Health export", async () => {
    const zip = new Blob([readFileSync(join(__dirname, "..", "..", "..", "public", "samples", "apple-health-export-sample.zip"))]);
    const { stream } = await openAppleHealthXml(zip);
    const { vitals } = await parseAppleHealth(decodeWithProgress(stream), { patientId: "p-harold", since: "2026-08-13", until: "2026-10-03" });
    const r = withConfirmed(getSeedRecord("p-harold")!, { vitals });
    const [f] = lowRestingHrBetaBlockerRule.evaluate(r, ctx);
    expect(f).toMatchObject({ severity: "moderate", medications: ["Metoprolol succinate"], category: "drug-vitals" });
    expect(f.evidence[1]).toMatch(/lowest 4\d bpm/);
  });

  it("doesn't fire without a beta-blocker", () => {
    const rosa = getSeedRecord("p-rosa")!;
    const lows: VitalSign[] = [1, 2, 3].map((d) => ({ id: `r${d}`, patientId: "p-rosa", timestamp: `2026-09-0${d}T23:59:00`, restingHeartRate: 46, source: src("wearable") }));
    expect(lowRestingHrBetaBlockerRule.evaluate(withConfirmed(rosa, { vitals: lows }), ctx)).toEqual([]);
  });
});

describe("medicine conflicting with a recorded allergy", () => {
  it("is silent on the seed Passports", () => {
    for (const id of ["p-harold", "p-margaret", "p-rosa"]) expect(allergyConflictRule.evaluate(getSeedRecord(id)!, ctx)).toEqual([]);
  });

  it("HAROLD: naproxen matches his NSAID allergy (severe) → high", () => {
    const naproxen = buildMedication({ name: "Naproxen", dose: "500", unit: "mg", frequency: "twice daily", startDate: "2026-09-10", indication: "", prescriber: "Dr. Kevin Liu", status: "active", stoppedOn: "" });
    const r = withConfirmed(getSeedRecord("p-harold")!, { medications: [naproxen] });
    const [f] = allergyConflictRule.evaluate(r, ctx);
    expect(f).toMatchObject({ severity: "high", medications: ["Naproxen"], category: "drug-allergy" });
    expect(f.title).toMatch(/allergy to Ibuprofen/);
    expect(f.explanation).toMatch(/same family of medicines \(nsaid\)/);
    // …and the whole engine now has TWO high flags about naproxen.
    const high = evaluatePatient(r, { now }).filter((x) => x.severity === "high" && x.medications.includes("Naproxen")).map((x) => x.category);
    expect(high.sort()).toEqual(["drug-allergy", "drug-drug"]);
  });

  it("an intolerance is low severity", () => {
    const margaret = getSeedRecord("p-margaret")!;
    const codeine = buildMedication({ name: "Codeine", dose: "30", unit: "mg", frequency: "every 6 hours as needed", startDate: "2026-09-10", indication: "", prescriber: "", status: "active", stoppedOn: "" });
    const [f] = allergyConflictRule.evaluate(withConfirmed(margaret, { medications: [codeine] }), ctx);
    expect(f.severity).toBe("low");
    expect(f.title).toMatch(/intolerance to Codeine/);
  });

  it("matches by generic name too (penicillin allergy → amoxicillin)", () => {
    const amox = buildMedication({ name: "Amoxicillin", dose: "500", unit: "mg", frequency: "three times daily", startDate: "2026-09-10", indication: "", prescriber: "", status: "active", stoppedOn: "" });
    const [f] = allergyConflictRule.evaluate(withConfirmed(getSeedRecord("p-harold")!, { medications: [amox] }), ctx);
    expect(f).toMatchObject({ severity: "moderate", medications: ["Amoxicillin"] });
  });
});

describe("PHQ-9 rising after a medication change", () => {
  it("MARGARET: 7 before the sertraline increase, 16 after → high", () => {
    const [f] = phq9RiseAfterChangeRule.evaluate(getSeedRecord("p-margaret")!, ctx);
    expect(f).toMatchObject({ severity: "high", medications: ["Sertraline"], category: "drug-mood" });
    expect(f.evidence[1]).toBe("PHQ-9 before: 7 on Sep 13. After: 12 on Sep 24, 16 on Oct 1.");
    expect(f.explanation).toMatch(/isn't a diagnosis/);
  });

  it("mentions 988 when a later screening had a self-harm answer", () => {
    const m = getSeedRecord("p-margaret")!;
    const a: MentalHealthAssessment = { id: "as-x", patientId: "p-margaret", instrument: "PHQ-9", date: "2026-09-30", score: 11, severity: "Moderate", answers: [1, 1, 1, 1, 1, 2, 2, 1, 1], administeredBy: "self", source: src("patient-entered", "You") };
    const [f] = phq9RiseAfterChangeRule.evaluate(withConfirmed(m, { assessments: [a] }), ctx);
    expect(f.severity).toBe("high");
    expect(f.explanation).toMatch(/988/);
  });

  it("stays quiet for small changes (Harold 2 → 3) and falling scores (Rosa 8 → 4)", () => {
    expect(phq9RiseAfterChangeRule.evaluate(getSeedRecord("p-harold")!, ctx)).toEqual([]);
    expect(phq9RiseAfterChangeRule.evaluate(getSeedRecord("p-rosa")!, ctx)).toEqual([]);
  });
});

describe("declining eGFR on medicines that need renal dose review", () => {
  it("MARGARET: 61 → 57 → 52 on metformin + glipizide → moderate", () => {
    const [f] = decliningEgfrRule.evaluate(getSeedRecord("p-margaret")!, ctx);
    expect(f).toMatchObject({ severity: "moderate", category: "drug-kidney" });
    expect(f.medications).toEqual(["Metformin", "Glipizide"]);
    expect(f.evidence[0]).toBe("eGFR results: 61 (Feb 12) → 57 (May 20) → 52 (Aug 28).");
  });

  it("becomes high when eGFR reaches 45 or below", () => {
    const low: LabResult = { id: "l-x", patientId: "p-margaret", name: "eGFR", loincCode: "98979-8", value: 44, unit: "mL/min", date: "2026-09-09", referenceRange: { low: 60 }, status: "abnormal", source: src("patient-entered", "Scanned lab report") };
    expect(decliningEgfrRule.evaluate(withConfirmed(getSeedRecord("p-margaret")!, { labs: [low] }), ctx)[0].severity).toBe("high");
  });

  it("doesn't fire while eGFR is above 60 (Harold 66 → 64) or stable", () => {
    expect(decliningEgfrRule.evaluate(getSeedRecord("p-harold")!, ctx)).toEqual([]);
    expect(decliningEgfrRule.evaluate(getSeedRecord("p-rosa")!, ctx)).toEqual([]);
  });
});

describe("the engine only sees confirmed data", () => {
  it("a pending allergy or reading changes nothing until confirmed", () => {
    const harold = getSeedRecord("p-harold")!;
    const naproxen = buildMedication({ name: "Naproxen", dose: "500", unit: "mg", frequency: "twice daily", startDate: "2026-09-10", indication: "", prescriber: "", status: "active", stoppedOn: "" });
    const pending = upsertItems(emptyPassport("p-harold"), "medications", [naproxen], "pending", AT);
    expect(evaluatePatient(mergeRecord(harold, pending), { now }).some((f) => f.category === "drug-allergy")).toBe(false);
    const allergy: Allergy = { ...harold.allergies[0], id: "al-x" };
    expect(allergy).toBeDefined();
  });
});
