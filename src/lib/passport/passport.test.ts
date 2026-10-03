import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { evaluatePatient } from "../safetyEngine";
import type { Allergy, DataSource, Medication, MoodCheckIn } from "../types";
import { addEntries, confirmEntry, discardEntry, editEntry, importForReview, removeEntry, resetDemoData } from "./actions";
import { createMemoryBackend } from "./backend";
import { emptyPassport } from "./collections";
import { mergeRecord } from "./merge";
import { pendingEntries, upsertItems } from "./ops";
import { latestLab, latestLabs } from "./selectors";
import { PassportStore } from "./store";

const P = "p-harold";
const AT = "2026-10-03T09:00:00";
const typed = (kind: DataSource["kind"], label: string): DataSource => ({ kind, label, importedAt: AT, verified: false });

const naproxen: Medication = {
  id: "m-scan-1", name: "Naproxen", genericName: "naproxen", class: "nsaid", dose: "500 mg", frequency: "twice daily", startDate: "2026-09-10",
  prescriber: "Dr. Kim, Urgent care", status: "active", source: typed("document-scan", "Scanned prescription"),
};

function freshStore() {
  let t = 0;
  return new PassportStore(createMemoryBackend(), () => `2026-09-30T10:00:${String(t++).padStart(2, "0")}Z`);
}

describe("mergeRecord", () => {
  const seed = getSeedRecord(P)!;

  it("returns the seed record untouched when nothing is stored", () => {
    expect(mergeRecord(seed, undefined)).toBe(seed);
    expect(mergeRecord(seed, emptyPassport(P))).toBe(seed);
  });

  it("ignores pending items entirely", () => {
    const local = upsertItems(emptyPassport(P), "medications", [naproxen], "pending", AT);
    const merged = mergeRecord(seed, local);
    expect(merged.patient.medications.map((m) => m.name)).not.toContain("Naproxen");
  });

  it("applies confirmed items and marks them verified", () => {
    const local = upsertItems(emptyPassport(P), "medications", [naproxen], "confirmed", AT);
    const merged = mergeRecord(seed, local);
    const med = merged.patient.medications.find((m) => m.id === naproxen.id)!;
    expect(med).toBeDefined();
    expect(med.source.verified).toBe(true);
    expect(merged.patient.medications).toHaveLength(seed.patient.medications.length + 1);
  });

  it("an edit replaces the seed item with the same id", () => {
    const edited = { ...seed.patient.medications[0], dose: "7.5 mg", source: typed("patient-entered", "You") };
    const merged = mergeRecord(seed, upsertItems(emptyPassport(P), "medications", [edited], "confirmed", AT));
    expect(merged.patient.medications.find((m) => m.id === edited.id)?.dose).toBe("7.5 mg");
    expect(merged.patient.medications).toHaveLength(seed.patient.medications.length);
  });

  it("stopping a medication moves it to pastMedications", () => {
    const stopped = { ...seed.patient.medications.find((m) => m.name === "Aspirin")!, status: "stopped" as const, stoppedOn: "2026-09-10" };
    const merged = mergeRecord(seed, upsertItems(emptyPassport(P), "medications", [stopped], "confirmed", AT));
    expect(merged.patient.medications.map((m) => m.name)).not.toContain("Aspirin");
    expect(merged.pastMedications.map((m) => m.name)).toEqual(["Aspirin"]);
  });

  it("singletons are replaced by the latest confirmed version", () => {
    const emergency = { ...seed.emergency!, bloodType: "A−", source: typed("patient-entered", "You") };
    const merged = mergeRecord(seed, upsertItems(emptyPassport(P), "emergency", [emergency], "confirmed", AT));
    expect(merged.emergency?.bloodType).toBe("A−");
  });
});

describe("PassportStore + actions (memory backend)", () => {
  it("persists changes and reloads them in a new store over the same backend", async () => {
    const backend = createMemoryBackend();
    const a = new PassportStore(backend);
    const mood: MoodCheckIn = { id: "mo-local-1", patientId: P, timestamp: AT, score: 2, source: typed("patient-entered", "You") };
    await addEntries(P, "moods", [mood], undefined, a);
    const b = new PassportStore(backend);
    await b.ensureLoaded();
    expect(b.get(P)?.entries.map((e) => e.item.id)).toEqual(["mo-local-1"]);
    expect(b.get(P)?.activity[0]).toMatchObject({ action: "add", summary: "Added mood check-in" });
  });

  it("notifies subscribers and bumps the version on every change", async () => {
    const s = freshStore();
    let calls = 0;
    s.subscribe(() => calls++);
    await s.ensureLoaded();
    const v0 = s.getVersion();
    await addEntries(P, "medications", [naproxen], undefined, s);
    expect(s.getVersion()).toBeGreaterThan(v0);
    expect(calls).toBeGreaterThan(0);
  });

  it("import → review → confirm is the only way an import reaches analysis", async () => {
    const s = freshStore();
    const seed = getSeedRecord(P)!;
    await importForReview(P, { medications: [naproxen] }, "document-scan", "Scanned prescription", s);
    expect(pendingEntries(s.get(P))).toHaveLength(1);
    const before = evaluatePatient(mergeRecord(seed, s.get(P)), { now: referenceNow() });
    expect(before.some((f) => f.medications.includes("Naproxen"))).toBe(false);

    await confirmEntry(P, "medications", naproxen.id, s);
    expect(pendingEntries(s.get(P))).toHaveLength(0);
    const after = evaluatePatient(mergeRecord(seed, s.get(P)), { now: referenceNow() });
    expect(after.some((f) => f.medications.includes("Naproxen"))).toBe(true);
    expect(s.get(P)!.activity.map((a) => a.action)).toEqual(["confirm", "import"]);
  });

  it("a discarded import is not resurrected by importing it again", async () => {
    const s = freshStore();
    await importForReview(P, { medications: [naproxen] }, "document-scan", "Scan", s);
    await discardEntry(P, "medications", naproxen.id, s);
    await importForReview(P, { medications: [naproxen] }, "document-scan", "Scan", s);
    expect(s.get(P)!.entries.find((e) => e.item.id === naproxen.id)?.status).toBe("discarded");
  });

  it("removing a seed item hides it from the merged record", async () => {
    const s = freshStore();
    const seed = getSeedRecord(P)!;
    const allergy: Allergy = seed.allergies[1];
    await removeEntry(P, "allergies", allergy, s);
    expect(mergeRecord(seed, s.get(P)).allergies.map((a) => a.id)).not.toContain(allergy.id);
  });

  it("edits are logged", async () => {
    const s = freshStore();
    const seed = getSeedRecord(P)!;
    await editEntry(P, "emergency", { ...seed.emergency!, bloodType: "A−", source: typed("patient-entered", "You") }, undefined, s);
    expect(s.get(P)!.activity[0].summary).toBe("Edited emergency info");
  });

  it("reset forgets local data but seed data is untouched", async () => {
    const s = freshStore();
    await addEntries(P, "medications", [naproxen], undefined, s);
    await resetDemoData(undefined, s);
    expect(s.get(P)).toBeUndefined();
    expect(mergeRecord(getSeedRecord(P)!, s.get(P)).patient.medications).toHaveLength(7);
  });
});

describe("lab selectors", () => {
  const labs = getSeedRecord(P)!.patient.labs;
  it("latestLab picks the most recent INR (3.4), not the first one", () => {
    expect(latestLab(labs, "INR")?.value).toBe(3.4);
    expect(latestLab(labs, "6301-6")?.value).toBe(3.4);
  });
  it("latestLabs returns one result per test", () => {
    const latest = latestLabs(labs);
    expect(latest.map((l) => l.name).sort()).toEqual(["HbA1c", "INR", "LDL cholesterol", "Potassium", "eGFR"]);
  });
});
