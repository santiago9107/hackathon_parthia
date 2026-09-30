import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { mergeRecord } from "../passport/merge";
import { emptyPassport } from "../passport/collections";
import { upsertItems } from "../passport/ops";
import { evaluatePatient } from "../safetyEngine";
import {
  allergyMatches,
  buildAllergy,
  buildMedication,
  looksLikePhone,
  medicationChangeEvent,
  toKg,
  validateMedication,
  validateVitals,
  type MedicationInput,
} from "./entries";

const med = (over: Partial<MedicationInput> = {}): MedicationInput => ({
  name: "Naproxen", dose: "500", unit: "mg", frequency: "twice daily", startDate: "2026-09-10", indication: "", prescriber: "", status: "active", stoppedOn: "", ...over,
});

describe("vitals validation", () => {
  const base = { systolic: "", diastolic: "", heartRate: "", weight: "", weightUnit: "kg" as const };
  it("needs at least one reading", () => {
    expect(validateVitals(base).form).toBeDefined();
  });
  it("needs both blood-pressure numbers, bottom below top", () => {
    expect(validateVitals({ ...base, systolic: "120" }).diastolic).toBeDefined();
    expect(validateVitals({ ...base, systolic: "80", diastolic: "120" }).diastolic).toMatch(/lower/);
    expect(validateVitals({ ...base, systolic: "124", diastolic: "78" })).toEqual({});
  });
  it("catches implausible values but accepts real extremes", () => {
    expect(validateVitals({ ...base, systolic: "400", diastolic: "80" }).systolic).toBeDefined();
    expect(validateVitals({ ...base, systolic: "88", diastolic: "52" })).toEqual({});
    expect(validateVitals({ ...base, heartRate: "12" }).heartRate).toBeDefined();
    expect(validateVitals({ ...base, weight: "180", weightUnit: "lb" })).toEqual({});
    expect(validateVitals({ ...base, weight: "180", weightUnit: "kg" })).toEqual({});
    expect(validateVitals({ ...base, weight: "900", weightUnit: "lb" }).weight).toBeDefined();
  });
  it("converts pounds to kilograms", () => {
    expect(toKg(180, "lb")).toBe(81.6);
    expect(toKg(81.64, "kg")).toBe(81.6);
  });
});

describe("medications you enter", () => {
  it("validates the essentials", () => {
    expect(validateMedication(med({ name: "", dose: "abc", frequency: "" }))).toMatchObject({ name: expect.any(String), dose: expect.any(String), frequency: expect.any(String) });
    expect(validateMedication(med({ status: "stopped", stoppedOn: "2026-01-01" })).stoppedOn).toMatch(/before/);
    expect(validateMedication(med())).toEqual({});
  });

  it("matches brand names to the dictionary (generic, class, RxNorm)", () => {
    const m = buildMedication(med({ name: "Aleve", dose: "220" }));
    expect(m).toMatchObject({ name: "Aleve", genericName: "naproxen", class: "nsaid", rxNormCode: "7258", dose: "220 mg", status: "active" });
    expect(m.source).toMatchObject({ kind: "patient-entered", verified: true });
  });

  it("keeps unknown names as written, class 'other'", () => {
    expect(buildMedication(med({ name: "Turmeric capsules" }))).toMatchObject({ genericName: "turmeric capsules", class: "other" });
  });

  it("editing an imported item keeps a note of where it came from", () => {
    const seedMed = getSeedRecord("p-harold")!.patient.medications[0];
    const edited = buildMedication(med({ name: "Warfarin", dose: "7.5" }), seedMed);
    expect(edited.id).toBe(seedMed.id);
    expect(edited.source.label).toBe("Edited by you (was: Sample data)");
  });

  it("derives the right history event", () => {
    const before = buildMedication(med({ name: "Lisinopril", dose: "10" }));
    const higher = buildMedication(med({ name: "Lisinopril", dose: "20" }), before);
    const stopped = buildMedication(med({ name: "Lisinopril", dose: "20", status: "stopped", stoppedOn: "2026-09-10" }), higher);
    expect(medicationChangeEvent("p", undefined, before, "2026-09-11")?.type).toBe("started");
    expect(medicationChangeEvent("p", before, higher, "2026-09-11")).toMatchObject({ type: "dose-changed", detail: expect.stringContaining("10 mg to 20 mg") });
    expect(medicationChangeEvent("p", higher, stopped, "2026-09-11")).toMatchObject({ type: "stopped", date: "2026-09-10" });
    expect(medicationChangeEvent("p", higher, { ...higher }, "2026-09-11")).toBeNull();
  });

  it("a medicine you add is checked by the safety engine (naproxen on warfarin → high flag)", () => {
    const harold = getSeedRecord("p-harold")!;
    const naproxen = buildMedication(med());
    const record = mergeRecord(harold, upsertItems(emptyPassport("p-harold"), "medications", [naproxen], "confirmed", "2026-09-11T09:00:00"));
    const flag = evaluatePatient(record, { now: referenceNow() }).find((f) => f.ruleId === "drug-drug/known-pairs/warfarin+antiplatelet");
    expect(flag?.severity).toBe("high");
    expect(flag?.medications).toContain("Naproxen");
  });
});

describe("allergies you enter", () => {
  it("expands class names so the engine can match them", () => {
    expect(allergyMatches("NSAIDs")?.classes).toContain("nsaid");
    expect(allergyMatches("Ibuprofen")).toMatchObject({ genericNames: ["ibuprofen"], classes: ["nsaid"] });
    expect(allergyMatches("Penicillin")?.genericNames).toEqual(expect.arrayContaining(["penicillin", "amoxicillin"]));
    expect(allergyMatches("Peanuts")).toBeUndefined();
  });
  it("food allergies don't get medication matchers", () => {
    const a = buildAllergy({ substance: "Peanuts", category: "food", reaction: "Hives", severity: "severe", type: "allergy" }, "p-rosa");
    expect(a.matches).toBeUndefined();
    expect(a.source.kind).toBe("patient-entered");
  });
});

it("phone numbers need at least 7 digits", () => {
  expect(looksLikePhone("(555) 010-7781")).toBe(true);
  expect(looksLikePhone("call me")).toBe(false);
});
