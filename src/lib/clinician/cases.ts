import { getRecord } from "@/lib/mockData";
import { lookupDrug } from "@/lib/terminology/medications";
import type { ClinicianCase, SourceMedication } from "./types";

const AS_OF = "2026-10-03";
const sourceLabel = { passport: "Parthia Passport", hospital: "Hospital EHR", urgent: "Urgent-care EHR", specialist: "Cardiology EHR", photon: "Photon sandbox" } as const;

export const CLINICIAN_COHORT = [
  { id: "p-harold", name: "Harold Okafor", age: 68, summary: "Anticoagulation review", acuity: "high" },
  { id: "p-margaret", name: "Margaret Lindqvist", age: 72, summary: "Polypharmacy + mental health", acuity: "moderate" },
  { id: "p-rosa", name: "Rosa Delgado", age: 65, summary: "New diabetes care", acuity: "stable" },
  { id: "p-aisha", name: "Aisha Rahman", age: 58, summary: "CKD + diabetes reconciliation", acuity: "moderate" },
  { id: "p-daniel", name: "Daniel Kim", age: 44, summary: "Neurology medication transition", acuity: "stable" },
  { id: "p-luis", name: "Luis Martinez", age: 76, summary: "COPD + AFib after discharge", acuity: "high" },
] as const;

function med(id: string, ingredient: string, dose: string | undefined, status: SourceMedication["status"], recordType: SourceMedication["recordType"], sourceId: SourceMedication["sourceId"], recordedOn: string, display?: string): SourceMedication {
  const concept = lookupDrug(ingredient);
  return { id, ingredient, display: display ?? `${concept?.display ?? ingredient} ${dose ?? ""}`.trim(), rxcui: concept?.rxcui, dose, status, recordType, sourceId, sourceLabel: sourceLabel[sourceId], recordedOn };
}

function passportRecords(patientId: string): SourceMedication[] {
  const record = getRecord(patientId)!;
  return record.patient.medications.map((m) => ({
    id: `passport:${m.id}`, ingredient: m.genericName, display: `${m.name} ${m.dose}`, rxcui: m.rxNormCode,
    dose: m.dose, status: m.status === "stopped" ? "stopped" : "active", recordType: "patient-reported",
    sourceId: "passport", sourceLabel: sourceLabel.passport, recordedOn: m.startDate, author: m.prescriber,
  }));
}

function sources(stale = false): ClinicianCase["sources"] {
  return [
    { id: "passport", label: sourceLabel.passport, format: "passport-share", available: true, lastUpdated: AS_OF, simulated: true },
    { id: "hospital", label: sourceLabel.hospital, format: "fhir", available: true, lastUpdated: "2026-09-18", simulated: true },
    { id: "urgent", label: sourceLabel.urgent, format: "fhir", available: true, lastUpdated: "2026-10-02", simulated: true },
    { id: "specialist", label: sourceLabel.specialist, format: "fhir", available: true, lastUpdated: stale ? "2025-10-21" : "2026-08-30", simulated: true },
    { id: "photon", label: sourceLabel.photon, format: "photon-adapter", available: true, lastUpdated: "2026-09-26", simulated: true },
  ];
}

function extendedCase(patientId: string): ClinicianCase | undefined {
  if (patientId === "p-aisha") return {
    patientId, patientName: "Aisha Rahman", age: 58,
    conditions: ["Type 2 diabetes", "Stage 3 chronic kidney disease", "Hypertension"], allergies: ["Sulfonamides"], sharedAt: `${AS_OF}T09:14:00-04:00`, sources: sources(),
    records: [
      med("passport:a-metformin", "metformin", "1000 mg", "active", "patient-reported", "passport", AS_OF),
      med("hospital:a-metformin", "metformin", "500 mg", "active", "prescribed", "hospital", "2026-09-18"),
      med("hospital:a-lisinopril", "lisinopril", "20 mg", "active", "prescribed", "hospital", "2026-09-18"),
      med("specialist:a-metformin", "metformin", "500 mg", "stopped", "prescribed", "specialist", "2026-08-30"),
      med("photon:a-metformin", "metformin", "1000 mg", "fulfilled", "fulfillment", "photon", "2026-09-26"),
    ],
  };
  if (patientId === "p-daniel") return {
    patientId, patientName: "Daniel Kim", age: 44,
    conditions: ["Focal epilepsy", "Migraine", "Generalized anxiety"], allergies: [], sharedAt: `${AS_OF}T09:14:00-04:00`, sources: sources(),
    records: [
      med("passport:d-lamotrigine", "lamotrigine", "150 mg", "active", "patient-reported", "passport", AS_OF),
      med("hospital:d-lamotrigine", "lamotrigine", "150 mg", "active", "prescribed", "hospital", "2026-09-18"),
      med("urgent:d-topiramate", "topiramate", "25 mg", "stopped", "prescribed", "urgent", "2026-10-02"),
      med("specialist:d-topiramate", "topiramate", "50 mg", "active", "prescribed", "specialist", "2026-08-30"),
      med("photon:d-lamotrigine", "lamotrigine", "150 mg", "fulfilled", "fulfillment", "photon", "2026-09-26"),
    ],
  };
  if (patientId === "p-luis") return {
    patientId, patientName: "Luis Martinez", age: 76,
    conditions: ["Atrial fibrillation", "COPD", "Stage 2 chronic kidney disease"], allergies: ["Penicillin"], sharedAt: `${AS_OF}T09:14:00-04:00`, sources: sources(true),
    records: [
      med("passport:l-warfarin", "warfarin", "3 mg", "active", "patient-reported", "passport", AS_OF),
      med("hospital:l-warfarin", "warfarin", "3 mg", "active", "prescribed", "hospital", "2026-09-18"),
      med("urgent:l-cipro", "ciprofloxacin", "500 mg", "active", "prescribed", "urgent", "2026-10-02"),
      med("specialist:l-metoprolol", "metoprolol", "25 mg", "stopped", "prescribed", "specialist", "2025-10-21"),
      med("hospital:l-metoprolol", "metoprolol", "25 mg", "active", "prescribed", "hospital", "2026-09-18"),
      med("photon:l-warfarin", "warfarin", "3 mg", "fulfilled", "fulfillment", "photon", "2026-09-26"),
    ],
  };
  return undefined;
}

export function buildClinicianCase(patientId: string): ClinicianCase {
  const extended = extendedCase(patientId);
  if (extended) return extended;
  const base = getRecord(patientId) ?? getRecord("p-harold")!;
  const p = base.patient;
  const passport = passportRecords(p.id);
  const clinical = p.medications.slice(0, Math.min(5, p.medications.length)).map((m, index) =>
    med(`hospital:${m.id}`, m.genericName, m.dose, "active", "prescribed", "hospital", `2026-09-${String(18 - index).padStart(2, "0")}`, `${m.name} ${m.dose}`),
  );
  let extras: SourceMedication[] = [];
  let allergies = base.allergies.filter((a) => a.category === "medication").map((a) => a.substance);
  if (p.id === "p-harold") {
    allergies = allergies.length ? allergies : ["Ibuprofen (severe reaction)"];
    extras = [
      med("urgent:cipro", "ciprofloxacin", "500 mg", "active", "prescribed", "urgent", "2026-10-02", "Ciprofloxacin 500 mg tablet"),
      med("specialist:metoprolol", "metoprolol", "50 mg", "stopped", "prescribed", "specialist", "2026-02-12", "Metoprolol succinate 50 mg"),
      med("photon:warfarin", "warfarin", "5 mg", "fulfilled", "fulfillment", "photon", "2026-09-26", "Warfarin 5 mg tablet"),
      med("photon:atorvastatin", "atorvastatin", "40 mg", "fulfilled", "fulfillment", "photon", "2026-09-26", "Atorvastatin 40 mg tablet"),
      med("passport:otc-ibuprofen", "ibuprofen", "200 mg", "unconfirmed", "patient-reported", "passport", AS_OF, "Advil 200 mg tablet"),
    ];
  } else if (p.id === "p-margaret") {
    extras = [
      med("specialist:sertraline", "sertraline", "50 mg", "stopped", "prescribed", "specialist", "2026-01-05", "Sertraline 50 mg"),
      med("photon:sertraline", "sertraline", "100 mg", "fulfilled", "fulfillment", "photon", "2026-09-23", "Sertraline 100 mg"),
      med("passport:otc-diphenhydramine", "diphenhydramine", "25 mg", "unconfirmed", "patient-reported", "passport", AS_OF, "Benadryl 25 mg tablet"),
    ];
  } else {
    extras = [
      med("photon:metformin", "metformin", "500 mg", "fulfilled", "fulfillment", "photon", "2026-09-22", "Metformin 500 mg tablet"),
      med("specialist:levothyroxine", "levothyroxine", "75 mcg", "active", "prescribed", "specialist", "2026-08-30", "Levothyroxine 75 mcg"),
    ];
  }
  return {
    patientId: p.id, patientName: p.name, age: p.age, conditions: p.conditions.map((c) => c.name), allergies,
    sharedAt: "2026-10-03T09:14:00-04:00",
    sources: sources(p.id === "p-harold"),
    records: [...passport, ...clinical, ...extras],
    passport: base,
  };
}

export const CLINICIAN_AS_OF = AS_OF;
