import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { evaluatePatient } from "../safetyEngine";
import { simulateBpSync } from "../devices/bpMonitor";
import type { MentalHealthAssessment, PatientRecord } from "../types";
import { computeIndicators } from "./indicators";

const now = referenceNow();
const levels = (r: PatientRecord, differences: { resolution?: unknown }[] = []) =>
  Object.fromEntries(computeIndicators(r, evaluatePatient(r, { now }), now, differences).map((i) => [i.domain, i.level]));
const byDomain = (r: PatientRecord, differences: { resolution?: unknown }[] = []) =>
  Object.fromEntries(computeIndicators(r, evaluatePatient(r, { now }), now, differences).map((i) => [i.domain, i]));

describe("four separate indicators on the seed Passports", () => {
  it("keep their levels", () => {
    expect(levels(getSeedRecord("p-harold")!)).toEqual({ "medication-safety": "attention", physical: "watch", "mental-health": "good", nutrition: "watch" });
    expect(levels(getSeedRecord("p-margaret")!)).toEqual({ "medication-safety": "attention", physical: "attention", "mental-health": "attention", nutrition: "watch" });
    expect(levels(getSeedRecord("p-rosa")!)).toEqual({ "medication-safety": "good", physical: "attention", "mental-health": "good", nutrition: "attention" });
  });

  it("are never combined into one score", () => {
    const ind = computeIndicators(getSeedRecord("p-harold")!, [], now);
    expect(ind.map((i) => i.domain)).toEqual(["medication-safety", "physical", "mental-health", "nutrition"]);
  });

  it("Mental Health reports the latest screening (labelled a screening)", () => {
    expect(byDomain(getSeedRecord("p-margaret")!)["mental-health"].detail).toMatch(/Screening: PHQ-9 16 \(moderately severe\)/);
  });

  it("Nutrition uses the patient's own limits", () => {
    expect(byDomain(getSeedRecord("p-margaret")!).nutrition.headline).toMatch(/despite a sodium limit/);
  });

  it("Physical mentions falling kidney function", () => {
    expect(byDomain(getSeedRecord("p-margaret")!).physical.detail).toMatch(/kidney function \(eGFR\) falling/);
  });
});

describe("the fuller Passport moves the indicators", () => {
  it("open differences between records put Medication Safety at least on watch", () => {
    const rosa = getSeedRecord("p-rosa")!;
    const noFlags = computeIndicators(rosa, [], now, [{}, {}])[0];
    expect(noFlags).toMatchObject({ level: "watch", headline: "2 differences between your records to review", metric: "No flags · 2 to reconcile" });
    expect(computeIndicators(rosa, [], now, [{ resolution: {} }])[0].level).toBe("good");
  });

  it("low home blood pressure readings reach Physical & Labs", () => {
    const rosa = getSeedRecord("p-rosa")!;
    const lows = simulateBpSync("p-margaret", "2026-09-11", 14).map((v) => ({ ...v, patientId: "p-rosa" }));
    const r = { ...rosa, patient: { ...rosa.patient, vitals: [...rosa.patient.vitals, ...lows] } };
    const p = byDomain(r).physical;
    expect(p.level).toBe("attention");
    expect(p.detail).toMatch(/low blood pressure readings/);
  });

  it("a PHQ-9 of 10+ puts Mental Health on watch even when daily mood looks fine", () => {
    const rosa = getSeedRecord("p-rosa")!;
    const a: MentalHealthAssessment = { id: "x", patientId: "p-rosa", instrument: "PHQ-9", date: "2026-09-10", score: 12, severity: "Moderate", administeredBy: "self", source: { kind: "patient-entered", label: "You", importedAt: "x", verified: true } };
    const m = byDomain({ ...rosa, assessments: [...rosa.assessments, a] })["mental-health"];
    expect(m.level).toBe("watch");
    expect(m.detail).toMatch(/PHQ-9 12 \(moderate\) on 09\/10, up from 4/);
  });
});
