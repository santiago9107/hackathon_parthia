import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { emptyPassport } from "../passport/collections";
import { mergeRecord } from "../passport/merge";
import { upsertItems } from "../passport/ops";
import { evaluatePatient } from "../safetyEngine";
import { extractDocument, linesFromText } from "./extract";
import { buildScanItems, defaultTitle, rowsFromExtraction, type ScanDetails } from "./toPassport";

const fixture = (name: string) => linesFromText(readFileSync(join(__dirname, "fixtures", `${name}.txt`), "utf8"), 94);

function scanAndConfirm(sample: string, patientId: string, saveDocument = false) {
  const record = getSeedRecord(patientId)!;
  const x = extractDocument(fixture(sample));
  const { meds, labs } = rowsFromExtraction(x, record);
  const details: ScanDetails = { type: x.documentType, date: x.date!, prescriber: x.prescriber ?? "", organization: x.organization ?? "", title: defaultTitle(x), panelName: x.panelName, saveDocument };
  const items = buildScanItems(details, meds, labs, { patientId, text: "…", textConfidence: x.textConfidence, now: new Date("2026-10-03T10:00:00") });
  let local = emptyPassport(patientId);
  for (const [c, list] of Object.entries(items)) local = upsertItems(local, c as never, list as never, "confirmed", "2026-10-03T10:00:00");
  return { record, x, meds, labs, items, merged: mergeRecord(record, local) };
}

describe("scanned documents → Passport", () => {
  it("HAROLD: confirming the urgent-care naproxen prescription triggers the high-severity warfarin + NSAID flag", () => {
    const { items, merged } = scanAndConfirm("sample-prescription-harold", "p-harold");
    const naproxen = items.medications[0];
    expect(naproxen).toMatchObject({ name: "Naproxen", genericName: "naproxen", class: "nsaid", dose: "500 mg", frequency: "twice daily for 10 days", startDate: "2026-09-10", prescriber: "Dr. Kevin Liu, Northside Urgent Care", indication: "back pain" });
    expect(naproxen.source).toMatchObject({ kind: "document-scan", label: "Scanned prescription", verified: true, originalText: "Naproxen 500 mg tablet" });
    expect(items.medicationHistory[0]).toMatchObject({ type: "started", medicationName: "Naproxen", date: "2026-09-10" });

    const flags = evaluatePatient(merged, { now: referenceNow() });
    const bleed = flags.find((f) => f.ruleId === "drug-drug/known-pairs/warfarin+antiplatelet")!;
    expect(bleed.severity).toBe("high");
    expect(bleed.medications).toEqual(expect.arrayContaining(["Warfarin", "Naproxen"]));
  });

  it("MARGARET: lab values join her Passport as a scanned panel with the right statuses", () => {
    const { items, merged } = scanAndConfirm("sample-lab-report-margaret", "p-margaret");
    expect(items.labPanels).toHaveLength(1);
    expect(items.labPanels[0]).toMatchObject({ name: "Basic Metabolic Panel", date: "2026-09-09", orderedBy: "Dr. Samuel Reyes" });
    const egfr = merged.patient.labs.filter((l) => l.name === "eGFR").sort((a, b) => a.date.localeCompare(b.date)).map((l) => l.value);
    expect(egfr).toEqual([61, 57, 52, 49]);
    expect(items.labs.every((l) => l.panelId === items.labPanels[0].id && l.loincCode)).toBe(true);
  });

  it("ROSA: medicines already on her list are recognised and not added again", () => {
    const { meds, items } = scanAndConfirm("sample-visit-summary-rosa", "p-rosa");
    expect(meds.map((m) => [m.name, m.alreadyInPassport, m.include])).toEqual([
      ["Levothyroxine", true, false],
      ["Vitamin D3", false, true],
      ["Lisinopril", true, false],
    ]);
    expect(items.medications.map((m) => `${m.name} ${m.dose}`)).toEqual(["Vitamin D3 2000 units"]);
    expect(items.medications[0]).toMatchObject({ genericName: "cholecalciferol", class: "supplement" });
  });

  it("saves the document only when the patient chooses to", () => {
    expect(scanAndConfirm("sample-prescription-harold", "p-harold").items.documents).toEqual([]);
    const withDoc = scanAndConfirm("sample-prescription-harold", "p-harold", true).items.documents;
    expect(withDoc).toHaveLength(1);
    expect(withDoc[0]).toMatchObject({ type: "prescription", title: "Prescription — Northside Urgent Care", source: { kind: "document-scan" } });
  });
});
