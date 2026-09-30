import { describe, expect, it } from "vitest";
import { getSeedRecord } from "../mockData";
import { frequencyText, mapBundle, medicationNameFromDisplay } from "./mapper";
import { prepareFhirImport } from "./importer";
import type { FhirBundle } from "./types";
import haroldJson from "./bundles/p-harold.json";
import margaretJson from "./bundles/p-margaret.json";
import rosaJson from "./bundles/p-rosa.json";

const harold = haroldJson as unknown as FhirBundle;
const margaret = margaretJson as unknown as FhirBundle;
const rosa = rosaJson as unknown as FhirBundle;
const opts = (patientId: string) => ({ patientId, sourceLabel: "Epic MyChart (simulated)", importedAt: "2026-09-11T09:00:00Z" });

describe("synthetic bundles", () => {
  it.each([["Harold", harold], ["Margaret", margaret], ["Rosa", rosa]] as const)("%s's bundle is tagged SYNTHETIC and covers every resource type", (_n, b) => {
    expect(b.meta?.tag?.[0].code).toBe("SYNTHETIC");
    const types = new Set(b.entry!.map((e) => e.resource.resourceType));
    for (const t of ["Patient", "Condition", "MedicationRequest", "AllergyIntolerance", "Observation", "DiagnosticReport", "Encounter", "Appointment", "Immunization", "CareTeam", "Practitioner", "CarePlan", "DocumentReference"]) {
      expect(types.has(t), t).toBe(true);
    }
  });

  it("includes a dietitian note and behavioral health notes", () => {
    const loincs = (b: FhirBundle) => b.entry!.flatMap((e) => ((e.resource as { type?: { coding?: { code?: string }[] } }).type?.coding ?? []).map((c) => c.code));
    expect(loincs(harold)).toContain("34765-3");
    expect(loincs(margaret)).toEqual(expect.arrayContaining(["34765-3", "34748-9"]));
  });
});

describe("mapper helpers", () => {
  it("names medications from RxNorm clinical-drug display text", () => {
    expect(medicationNameFromDisplay("warfarin sodium 5 MG Oral Tablet")).toBe("Warfarin");
    expect(medicationNameFromDisplay("metoprolol succinate 25 MG Extended Release Oral Tablet")).toBe("Metoprolol succinate");
    expect(medicationNameFromDisplay("potassium chloride 10 MEQ Extended Release Oral Tablet")).toBe("Potassium chloride");
    expect(medicationNameFromDisplay("metformin hydrochloride 500 MG Oral Tablet")).toBe("Metformin");
  });

  it("turns FHIR timing into plain language", () => {
    expect(frequencyText({ timing: { repeat: { frequency: 2, period: 1, periodUnit: "d" } } })).toBe("twice daily");
    expect(frequencyText({ text: "Take 1 tablet every evening", timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } } })).toBe("once daily (evening)");
    expect(frequencyText({ text: "at bedtime", timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } } })).toBe("at bedtime");
    expect(frequencyText({ asNeededBoolean: true, timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } } })).toBe("once daily as needed");
    expect(frequencyText({ timing: { repeat: { frequency: 1, period: 1, periodUnit: "wk" } } })).toBe("once weekly");
  });
});

describe("mapBundle (Harold)", () => {
  const m = mapBundle(harold, opts("p-harold"));

  it("maps everything with no unmapped resources", () => {
    expect(m.warnings).toEqual([]);
    expect(m.patient?.name).toBe("Harold Okafor");
  });

  it("medications: RxNorm → generic, class, ingredient RxCUI; dose and frequency", () => {
    const warfarin = m.medications.find((x) => x.genericName === "warfarin")!;
    expect(warfarin).toMatchObject({ name: "Warfarin", class: "anticoagulant", rxNormCode: "11289", dose: "5 mg", frequency: "once daily (evening)", prescriber: "Dr. Daniel Cho", startDate: "2023-11-10" });
    expect(warfarin.source).toMatchObject({ kind: "ehr", label: "Epic MyChart (simulated)", verified: false, refId: expect.stringMatching(/^MedicationRequest\//), originalText: "warfarin sodium 5 MG Oral Tablet" });
    expect(m.medications.find((x) => x.genericName === "metoprolol")?.dose).toBe("25 mg");
    expect(m.medications.map((x) => x.genericName)).not.toContain("aspirin"); // the planted gap
  });

  it("conditions: ICD-10 + SNOMED, category from the ICD chapter", () => {
    const gerd = m.conditions.find((c) => c.code === "K21.9")!;
    expect(gerd).toMatchObject({ snomedCode: "235595009", category: "other", diagnosedOn: "2022-02-14" });
    expect(m.conditions.find((c) => c.code === "I48.91")?.category).toBe("cardiovascular");
    expect(m.conditions.find((c) => c.code === "E11.9")?.category).toBe("diabetes");
  });

  it("labs: LOINC → canonical name/unit, interpretation, linked to their panel", () => {
    const inr = m.labs.filter((l) => l.loincCode === "6301-6");
    expect(inr.map((l) => [l.date, l.value, l.status])).toEqual([["2026-08-21", 3.1, "borderline"], ["2026-09-04", 3.4, "abnormal"]]);
    expect(inr[0].unit).toBe("");
    const egfr = m.labs.find((l) => l.loincCode === "98979-8")!;
    expect(egfr).toMatchObject({ name: "eGFR", unit: "mL/min" });
    const hgb = m.labs.find((l) => l.loincCode === "718-7")!;
    expect(hgb).toMatchObject({ value: 13.1, status: "borderline" });
    const cbc = m.labPanels.find((p) => p.code === "58410-2")!;
    expect(hgb.panelId).toBe(cbc.id);
    expect(cbc.orderedBy).toBe("Linda Park, PharmD");
  });

  it("vitals: components grouped into one reading per time", () => {
    expect(m.vitals.find((v) => v.timestamp === "2026-08-20T10:30:00")).toMatchObject({ systolic: 136, diastolic: 84, heartRate: 71, weightKg: 89.3, bpSetting: "clinic" });
  });

  it("encounters carry their note as the summary; documents are decoded", () => {
    const anticoag = m.encounters.find((e) => e.date === "2026-09-04")!;
    expect(anticoag.summary).toMatch(/INR 3\.4/);
    expect(anticoag.clinician).toBe("Linda Park, PharmD");
    const doc = m.documents.find((d) => d.id === anticoag.documentId)!;
    expect(doc.text).toMatch(/^ANTICOAGULATION CLINIC/);
    expect(m.documents.find((d) => d.date === "2026-06-10")?.type).toBe("dietitian-note");
  });

  it("care team: roles, primary clinician, phone from the Practitioner", () => {
    expect(m.careTeam.find((c) => c.role === "primary-care")).toMatchObject({ name: "Dr. Amara Nwosu", isPrimary: true, phone: "(555) 010-2200" });
    expect(m.careTeam.find((c) => c.name === "Dr. Ruth Adler")?.specialty).toBe("Gastroenterology");
  });

  it("allergies, immunizations, social history, screenings", () => {
    expect(m.allergies.find((a) => a.substance === "Ibuprofen")).toMatchObject({ severity: "severe", matches: { classes: ["nsaid"] } });
    expect(m.immunizations.find((i) => i.cvxCode === "187")?.doseNote).toBe("Dose 2 of 2");
    expect(m.socialHistory.find((s) => s.category === "tobacco")?.value).toBe("Former smoker");
    expect(m.assessments.find((a) => a.instrument === "PHQ-9")).toMatchObject({ score: 3, severity: "Minimal", administeredBy: "clinician" });
  });
});

describe("mapBundle (Margaret, Rosa)", () => {
  it("Margaret: new potassium chloride, furosemide 20 mg, a telehealth psychiatry check-in, no diphenhydramine", () => {
    const m = mapBundle(margaret, opts("p-margaret"));
    expect(m.warnings).toEqual([]);
    expect(m.medications.find((x) => x.genericName === "potassium chloride")).toMatchObject({ class: "supplement", dose: "10 mEq" });
    expect(m.medications.find((x) => x.genericName === "furosemide")?.dose).toBe("20 mg");
    expect(m.medications.map((x) => x.genericName)).not.toContain("diphenhydramine");
    expect(m.encounters.find((e) => e.date === "2026-09-09")).toMatchObject({ type: "telehealth", specialty: "Psychiatry" });
    expect(m.encounters.find((e) => e.date === "2026-09-02")?.type).toBe("therapy");
    expect(m.documents.filter((d) => d.type === "behavioral-health-note")).toHaveLength(2);
  });

  it("Rosa: metformin once daily, outside prescribers, no levothyroxine", () => {
    const m = mapBundle(rosa, opts("p-rosa"));
    expect(m.medications.find((x) => x.genericName === "metformin")?.frequency).toBe("once daily");
    expect(m.medications.find((x) => x.genericName === "lisinopril")?.prescriber).toBe("Dr. Marcus Bell (outside provider)");
    expect(m.medications.map((x) => x.genericName)).not.toContain("levothyroxine");
    expect(m.labs.find((l) => l.loincCode === "1989-3")).toMatchObject({ name: "Vitamin D (25-OH)", status: "abnormal" });
  });
});

describe("import planning against the Passport", () => {
  const record = getSeedRecord("p-harold")!;
  const { plan, identityMismatch } = prepareFhirImport(harold, record, "Epic MyChart (simulated)", "2026-09-11T09:00:00Z");

  it("skips what the Passport already has", () => {
    expect(identityMismatch).toBeNull();
    expect(plan.duplicates.conditions).toBe(4);
    expect(plan.duplicates.allergies).toBe(2);
    expect(plan.duplicates.encounters).toBe(4);
    expect(plan.duplicates.documents).toBe(2);
    expect(plan.duplicates.immunizations).toBe(4);
    expect(plan.duplicates.careTeam).toBe(4);
    expect(plan.duplicates.medications).toBe(5); // warfarin, atorvastatin, lisinopril, metformin, omeprazole
  });

  it("keeps only what is new or different", () => {
    const b = plan.batch;
    expect(b.conditions?.map((c) => c.code)).toEqual(["K21.9"]);
    expect(b.medications?.map((x) => `${x.genericName} ${x.dose}`)).toEqual(["metoprolol 25 mg"]);
    expect(b.labs?.map((l) => l.name).sort()).toEqual(["Creatinine", "Hemoglobin"]);
    expect(b.careTeam?.map((c) => c.name)).toEqual(["Dr. Ruth Adler"]);
    expect(b.encounters?.map((e) => e.date)).toEqual(["2026-07-10"]);
    expect(b.appointments?.map((a) => a.reason)).toEqual(["CBC recheck (lab draw before INR visit)"]);
    expect(b.allergies).toBeUndefined();
  });

  it("links a new result to the existing panel it belongs to", () => {
    const creat = plan.batch.labs!.find((l) => l.name === "Creatinine")!;
    expect(creat.panelId).toBe("lp-h-cmp-0815");
  });

  it("re-importing after confirming finds nothing new", () => {
    const { plan: again } = prepareFhirImport(harold, record, "Epic MyChart (simulated)", "x");
    expect(Object.keys(again.batch)).toEqual(Object.keys(plan.batch));
  });

  it("refuses a bundle for a different person", () => {
    const { identityMismatch: bad } = prepareFhirImport(margaret, record, "Epic", "x");
    expect(bad).toMatch(/Margaret Lindqvist, not Harold Okafor/);
  });

  it("Rosa's conflicting metformin frequency comes in for review; the vitamin D allergy-free extras too", () => {
    const { plan: r } = prepareFhirImport(rosa, getSeedRecord("p-rosa")!, "Epic", "x");
    expect(r.batch.medications?.map((x) => `${x.genericName} ${x.frequency}`)).toEqual(["metformin once daily"]);
    expect(r.batch.allergies?.map((a) => a.substance)).toEqual(["Iodinated contrast media"]);
    expect(r.batch.conditions?.map((c) => c.code)).toEqual(["E55.9"]);
  });
});
