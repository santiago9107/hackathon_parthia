import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { evaluatePatient } from "../safetyEngine";
import type { Medication } from "../types";
import { addEntries, importForReview } from "../passport/actions";
import { createMemoryBackend } from "../passport/backend";
import { mergeRecord } from "../passport/merge";
import { PassportStore } from "../passport/store";
import { mapBundle } from "../fhir/mapper";
import { EXPORT_SECTIONS, bundleCounts, toFhirBundle } from "./fhirExport";
import { ImportFileError, buildPassportFile, describePassportFile, importFhirFile, parseImportFile, restorePassportFile } from "./passportFile";

const P = "p-harold";
const now = referenceNow();
const PATIENTS = ["p-harold", "p-margaret", "p-rosa"];
const naproxen: Medication = {
  id: "m-scan-1", name: "Naproxen", genericName: "naproxen", class: "nsaid", dose: "500 mg", frequency: "twice daily", startDate: "2026-09-10",
  status: "active", rxNormCode: "7258", source: { kind: "document-scan", label: "Scanned prescription", importedAt: "2026-09-11T09:00:00", verified: true },
};
const store = () => new PassportStore(createMemoryBackend());

describe("FHIR R4 export", () => {
  const record = getSeedRecord("p-margaret")!;
  const bundle = toFhirBundle(record, { now });

  it("is a collection Bundle tagged as a synthetic Passport export", () => {
    expect(bundle).toMatchObject({ resourceType: "Bundle", type: "collection", timestamp: now.toISOString() });
    expect(bundle.meta?.tag?.map((t) => t.code)).toEqual(["patient-passport", "synthetic"]);
    expect(new Set(bundle.entry!.map((e) => e.fullUrl)).size).toBe(bundle.entry!.length);
  });

  it("uses standard codes and keeps provenance", () => {
    const counts = bundleCounts(bundle);
    expect(counts.Patient).toBe(1);
    expect(counts.MedicationStatement).toBe(record.patient.medications.length + record.pastMedications.length);
    const med = bundle.entry!.find((e) => e.resource.resourceType === "MedicationStatement")!.resource as { medicationCodeableConcept: { coding: { system: string }[] }; meta: { tag: { code: string }[] } };
    expect(med.medicationCodeableConcept.coding[0].system).toBe("http://www.nlm.nih.gov/research/umls/rxnorm");
    expect(med.meta.tag[0].code).toBe("seed");
  });

  it("round-trips through the FHIR mapper", () => {
    const mapped = mapBundle(bundle, { patientId: record.patient.id, sourceLabel: "x", importedAt: "x" });
    expect(mapped.warnings).toEqual([]);
    const all = [...record.patient.medications, ...record.pastMedications];
    expect(mapped.medications.map((m) => [m.genericName, m.dose, m.frequency, m.status ?? "active"])).toEqual(
      all.map((m) => [m.genericName, m.dose, m.frequency, m.status ?? "active"]),
    );
    expect(mapped.labs.map((l) => [l.loincCode, l.value, l.date])).toEqual(record.patient.labs.map((l) => [l.loincCode, l.value, l.date]));
    expect(mapped.allergies.map((a) => [a.substance, a.severity])).toEqual(record.allergies.map((a) => [a.substance, a.severity]));
    expect(mapped.assessments.map((a) => [a.instrument, a.score])).toEqual(record.assessments.map((a) => [a.instrument, a.score]));
    expect(mapped.appointments.map((a) => [a.clinician, a.start])).toEqual(record.appointments.map((a) => [a.clinician, a.start]));
    expect(mapped.immunizations.length).toBe(record.immunizations.length);
    const bp = record.patient.vitals.filter((v) => v.systolic !== undefined);
    expect(mapped.vitals.filter((v) => v.systolic !== undefined).length).toBe(bp.length);
  });

  it("exports only the chosen sections", () => {
    const only = toFhirBundle(record, { now, sections: ["allergies"] });
    expect(Object.keys(bundleCounts(only)).sort()).toEqual(["AllergyIntolerance", "Patient"]);
    expect(EXPORT_SECTIONS.length).toBe(11);
  });

  it("never exports unreviewed imports", async () => {
    const s = store();
    await importForReview(P, { medications: [naproxen] }, "document-scan", "scan", s);
    const b = toFhirBundle(mergeRecord(getSeedRecord(P)!, s.get(P)), { now });
    expect(JSON.stringify(b)).not.toMatch(/Naproxen/);
  });
});

describe("Passport file export → import round trip", () => {
  it("restores the Passport exactly, including pending items, activity and provenance", async () => {
    const a = store();
    await addEntries(P, "medications", [naproxen], undefined, a);
    await importForReview(P, { medications: [{ ...naproxen, id: "m-epic-2", name: "Omeprazole", genericName: "omeprazole", class: "proton-pump-inhibitor" }] }, "ehr", "Epic", a);
    const seed = getSeedRecord(P)!;
    const before = mergeRecord(seed, a.get(P));
    const text = JSON.stringify(buildPassportFile(before, a.get(P), now));

    const parsed = parseImportFile(text);
    expect(parsed.kind).toBe("passport");
    if (parsed.kind !== "passport") return;
    expect(describePassportFile(parsed.file)).toMatchObject({ confirmed: 1, pending: 1 });

    const b = store();
    await restorePassportFile(parsed.file, PATIENTS, b);
    const restored = b.get(P)!;
    expect(restored.entries).toEqual(a.get(P)!.entries);
    expect(restored.activity.slice(1)).toEqual(a.get(P)!.activity);
    expect(restored.activity[0]).toMatchObject({ action: "restore" });
    const after = mergeRecord(seed, restored);
    expect(after).toEqual(before);
    // The restored naproxen still raises Harold's high-severity warfarin + NSAID flag.
    expect(evaluatePatient(after, { now }).some((f) => f.severity === "high" && f.medications.includes("Naproxen"))).toBe(true);
  });

  it("rejects bad files with friendly messages", async () => {
    expect(() => parseImportFile("not json")).toThrow(ImportFileError);
    expect(() => parseImportFile(JSON.stringify({ hello: 1 }))).toThrow(/doesn't look like/);
    expect(() => parseImportFile(JSON.stringify({ format: "parthia-patient-passport", version: 1, passport: {} }))).toThrow(/damaged/);
    const file = buildPassportFile(getSeedRecord(P)!, undefined, now);
    await expect(restorePassportFile({ ...file, patient: { id: "p-x", name: "X" }, passport: { ...file.passport, patientId: "p-x" } }, PATIENTS, store())).rejects.toThrow(/isn't one of the sample patients/);
  });

  it("a plain FHIR Bundle imports for review, de-duplicated", async () => {
    const s = store();
    const seed = getSeedRecord(P)!;
    const withNaproxen = { ...seed, patient: { ...seed.patient, medications: [...seed.patient.medications, naproxen] } };
    const parsed = parseImportFile(JSON.stringify(toFhirBundle(withNaproxen, { now, sections: ["medications"] })));
    expect(parsed.kind).toBe("fhir");
    if (parsed.kind !== "fhir") return;
    const plan = await importFhirFile(parsed.bundle, seed, "other-app.json", s);
    expect(plan.batch.medications?.map((m) => m.name)).toEqual(["Naproxen"]);
    expect(s.get(P)!.entries[0]).toMatchObject({ status: "pending" });
    await expect(importFhirFile(parsed.bundle, getSeedRecord("p-rosa")!, "x.json", s)).rejects.toThrow(/This record is for Harold/);
  });
});
