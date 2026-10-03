import { describe, expect, it } from "vitest";
import { getSeedRecord, listPatients, referenceNow } from ".";
import { evaluatePatient } from "../safetyEngine";
import { severityBand } from "../screening";
import type { PatientRecord, Sourced } from "../types";

function allItems(r: PatientRecord): Sourced[] {
  return [
    ...r.patient.conditions, ...r.patient.medications, ...r.patient.medicationHistory, ...r.patient.labs, ...r.patient.vitals,
    ...r.symptoms, ...r.moods, ...r.nutrition, ...r.allergies, ...r.appointments, ...r.encounters, ...r.labPanels,
    ...r.immunizations, ...r.procedures, ...r.careTeam, ...r.carePlans, ...r.documents, ...r.assessments, ...r.socialHistory,
    ...(r.nutritionProfile ? [r.nutritionProfile] : []), ...(r.emergency ? [r.emergency] : []),
  ];
}

const records = listPatients().map((p) => getSeedRecord(p.id)!);
/** The demo personas. The Synthea patient is an import-only shell, so the fully populated checks do not apply to it. */
const fullySeededRecords = records.filter((r) => r.patient.id !== "p-synthea-shaun");

describe("seed Passport", () => {
  it.each(records.map((r) => [r.patient.name, r] as const))("%s: every item carries seed provenance", (_n, r) => {
    for (const item of allItems(r)) {
      expect(item.source).toMatchObject({ kind: "seed", label: "Sample data", verified: true });
    }
  });

  it("the Synthea patient starts empty so its Passport is built by the FHIR review flow", () => {
    const r = records.find((record) => record.patient.id === "p-synthea-shaun")!;
    expect(r.patient.medications).toEqual([]);
    expect(r.allergies).toEqual([]);
    expect(r.patient.labs).toEqual([]);
  });

  it.each(fullySeededRecords.map((r) => [r.patient.name, r] as const))("%s: has every Passport section", (_n, r) => {
    for (const key of ["allergies", "appointments", "encounters", "labPanels", "immunizations", "procedures", "careTeam", "carePlans", "documents", "assessments", "socialHistory"] as const) {
      expect(r[key].length, key).toBeGreaterThan(0);
    }
    expect(r.nutritionProfile).toBeDefined();
    expect(r.emergency?.contacts.length).toBeGreaterThan(0);
    expect(r.appointments.some((a) => a.status === "booked" && a.start > "2026-09-11")).toBe(true);
    expect(r.appointments.some((a) => a.status === "fulfilled")).toBe(true);
    expect(r.assessments.some((a) => a.instrument === "PHQ-9")).toBe(true);
    expect(r.assessments.some((a) => a.instrument === "GAD-7")).toBe(true);
  });

  it.each(records.map((r) => [r.patient.name, r] as const))("%s: cross-references resolve", (_n, r) => {
    const panelIds = new Set(r.labPanels.map((p) => p.id));
    for (const l of r.patient.labs) expect(panelIds.has(l.panelId!), `${l.id} → ${l.panelId}`).toBe(true);
    const encounterIds = new Set(r.encounters.map((e) => e.id));
    for (const a of r.appointments) if (a.encounterId) expect(encounterIds.has(a.encounterId), a.id).toBe(true);
    const docIds = new Set(r.documents.map((d) => d.id));
    for (const e of r.encounters) if (e.documentId) expect(docIds.has(e.documentId), e.id).toBe(true);
    for (const m of r.patient.medications) expect(m.rxNormCode, m.name).toMatch(/^\d+$/);
    for (const l of r.patient.labs) expect(l.loincCode, l.name).toMatch(/^\d+-\d$/);
  });

  it.each(records.map((r) => [r.patient.name, r] as const))("%s: screening severities match the standard bands", (_n, r) => {
    for (const a of r.assessments) expect(a.severity).toBe(severityBand(a.instrument, a.score));
  });

  it("all ids are unique within each persona", () => {
    for (const r of records) {
      const ids = allItems(r).map((i) => (i as unknown as { id: string }).id);
      expect(new Set(ids).size, r.patient.name).toBe(ids.length);
    }
  });

  it("Margaret's PHQ-9 rises after the sertraline dose change on 2026-08-22", () => {
    const m = records.find((r) => r.patient.id === "p-margaret")!;
    const phq = m.assessments.filter((a) => a.instrument === "PHQ-9").sort((a, b) => a.date.localeCompare(b.date));
    const before = phq.filter((a) => a.date <= "2026-08-22").map((a) => a.score);
    const after = phq.filter((a) => a.date > "2026-08-22").map((a) => a.score);
    expect(after.length).toBeGreaterThanOrEqual(2);
    expect(Math.min(...after)).toBeGreaterThan(Math.max(...before));
    expect(after).toEqual([...after].sort((a, b) => a - b)); // keeps rising
  });

  it("Margaret's eGFR declines across the year while on metformin", () => {
    const m = records.find((r) => r.patient.id === "p-margaret")!;
    const egfr = m.patient.labs.filter((l) => l.name === "eGFR").sort((a, b) => a.date.localeCompare(b.date)).map((l) => l.value);
    expect(egfr).toEqual([61, 57, 52]);
  });
});

describe("safety flags on the seed Passports", () => {
  const flagsFor = (id: string) => evaluatePatient(getSeedRecord(id)!, { now: referenceNow() }).map((f) => `${f.severity}:${f.ruleId}`);

  it("Harold: 4 flags incl. high vitamin-K swing (INR above target) and warfarin + aspirin", () => {
    const f = flagsFor("p-harold");
    expect(f).toHaveLength(4);
    expect(f).toContain("high:drug-nutrient/warfarin-vitamin-k");
    expect(f).toContain("high:drug-drug/known-pairs/warfarin+antiplatelet");
    expect(f).toContain("moderate:drug-nutrient/statin-grapefruit");
    expect(f).toContain("low:drug-drug/known-pairs/multiple-bp-lowering+dizziness");
  });

  it("Margaret: the original 6 flags plus 2 from her fuller Passport (PHQ-9 rise, falling eGFR)", () => {
    const f = flagsFor("p-margaret");
    expect(f).toHaveLength(9);
    expect(f).toContain("moderate:heart-failure/rapid-weight-gain");
    expect(f).toContain("high:burden/anticholinergic-score");
    expect(f).toContain("high:drug-mood/decline-after-change");
    expect(f).toContain("high:drug-mood/phq9-rise-after-change/e-m1");
    expect(f).toContain("moderate:drug-kidney/declining-egfr");
  });

  it("Rosa: 1 flag (metformin + alcohol)", () => {
    expect(flagsFor("p-rosa")).toEqual(["low:drug-nutrient/metformin-alcohol"]);
  });
});
