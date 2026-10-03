import type { Condition, LabResult, Medication, MedicationEvent, Patient, VitalSign } from "../types";
import { lookupDrug } from "../terminology/medications";
import { seeded, type Unsourced } from "./seed";

/**
 * SYNTHETIC PATIENTS — no real people, no real records.
 *
 * Three personas chosen to exercise different risk profiles:
 *  - p-harold:   68, AFib + diabetes, 7 meds incl. warfarin + statin
 *  - p-margaret: 72, heart failure + depression, 9 meds incl. 2 psychotropics
 *  - p-rosa:     65, newly diagnosed diabetic, 5 meds, patchy nutrition log
 *
 * Lab history goes back far enough to show a trend per test. The rest of
 * each persona's Passport (appointments, visits, care team, allergies…)
 * lives in `passportSeed.ts`.
 */

type SeedCondition = Omit<Unsourced<Condition>, "id">;
type SeedPatient = Omit<Patient, "conditions" | "medications" | "medicationHistory" | "labs" | "vitals"> & {
  conditions: SeedCondition[];
  medications: Omit<Unsourced<Medication>, "rxNormCode">[];
  medicationHistory: Unsourced<MedicationEvent>[];
  labs: Unsourced<LabResult>[];
  vitals: Unsourced<VitalSign>[];
};

const seedPatients: SeedPatient[] = [
  {
    id: "p-harold",
    name: "Harold Okafor",
    age: 68,
    sex: "male",
    summary: "Atrial fibrillation on warfarin, 7 medications, variable leafy-green intake.",
    primaryClinician: "Dr. Amara Nwosu, Internal Medicine",
    conditions: [
      { name: "Atrial fibrillation", category: "cardiovascular", code: "I48.91", snomedCode: "49436004", diagnosedOn: "2023-11-02", clinicalStatus: "active" },
      { name: "Hypertension", category: "hypertension", code: "I10", snomedCode: "38341003", diagnosedOn: "2015-03-12", clinicalStatus: "active" },
      { name: "Hyperlipidemia", category: "cardiovascular", code: "E78.5", snomedCode: "55822004", diagnosedOn: "2015-03-12", clinicalStatus: "active" },
      { name: "Type 2 diabetes", category: "diabetes", code: "E11.9", snomedCode: "44054006", diagnosedOn: "2019-06-20", clinicalStatus: "active" },
    ],
    medications: [
      { id: "m-h1", name: "Warfarin", genericName: "warfarin", class: "anticoagulant", dose: "5 mg", frequency: "once daily (evening)", startDate: "2023-11-10", indication: "Stroke prevention (AFib)", prescriber: "Dr. Daniel Cho, Cardiology" },
      { id: "m-h2", name: "Atorvastatin", genericName: "atorvastatin", class: "statin", dose: "40 mg", frequency: "once daily", startDate: "2015-04-01", indication: "Hyperlipidemia", prescriber: "Dr. Amara Nwosu, Internal Medicine" },
      { id: "m-h3", name: "Metoprolol succinate", genericName: "metoprolol", class: "beta-blocker", dose: "50 mg", frequency: "once daily", startDate: "2023-11-10", indication: "Rate control", prescriber: "Dr. Daniel Cho, Cardiology" },
      { id: "m-h4", name: "Lisinopril", genericName: "lisinopril", class: "ace-inhibitor", dose: "20 mg", frequency: "once daily", startDate: "2015-04-01", indication: "Hypertension", prescriber: "Dr. Amara Nwosu, Internal Medicine" },
      { id: "m-h5", name: "Metformin", genericName: "metformin", class: "biguanide", dose: "1000 mg", frequency: "twice daily", startDate: "2019-07-01", indication: "Type 2 diabetes", prescriber: "Dr. Amara Nwosu, Internal Medicine" },
      { id: "m-h6", name: "Omeprazole", genericName: "omeprazole", class: "proton-pump-inhibitor", dose: "20 mg", frequency: "once daily", startDate: "2022-02-14", indication: "GERD", prescriber: "Dr. Amara Nwosu, Internal Medicine" },
      { id: "m-h7", name: "Aspirin", genericName: "aspirin", class: "antiplatelet", dose: "81 mg", frequency: "once daily", startDate: "2026-08-20", indication: "Added after cardiology visit", prescriber: "Dr. Daniel Cho, Cardiology" },
    ],
    medicationHistory: [
      { id: "e-h1", patientId: "p-harold", date: "2026-08-20", medicationName: "Aspirin", type: "started", detail: "Aspirin 81 mg added after cardiology follow-up." },
    ],
    labs: [
      // Anticoagulation clinic INR checks (every two weeks)
      { id: "l-h6", patientId: "p-harold", name: "INR", loincCode: "6301-6", panelId: "lp-h-inr-0710", value: 2.4, unit: "", date: "2026-07-10", referenceRange: { low: 2.0, high: 3.0 }, status: "normal" },
      { id: "l-h7", patientId: "p-harold", name: "INR", loincCode: "6301-6", panelId: "lp-h-inr-0724", value: 2.6, unit: "", date: "2026-07-24", referenceRange: { low: 2.0, high: 3.0 }, status: "normal" },
      { id: "l-h8", patientId: "p-harold", name: "INR", loincCode: "6301-6", panelId: "lp-h-inr-0807", value: 2.8, unit: "", date: "2026-08-07", referenceRange: { low: 2.0, high: 3.0 }, status: "normal" },
      { id: "l-h9", patientId: "p-harold", name: "INR", loincCode: "6301-6", panelId: "lp-h-inr-0821", value: 3.1, unit: "", date: "2026-08-21", referenceRange: { low: 2.0, high: 3.0 }, status: "borderline" },
      { id: "l-h1", patientId: "p-harold", name: "INR", loincCode: "6301-6", panelId: "lp-h-inr-0904", value: 3.4, unit: "", date: "2026-09-04", referenceRange: { low: 2.0, high: 3.0 }, status: "abnormal" },
      // February annual labs
      { id: "l-h10", patientId: "p-harold", name: "HbA1c", loincCode: "4548-4", panelId: "lp-h-a1c-0212", value: 7.1, unit: "%", date: "2026-02-12", referenceRange: { high: 7.0 }, status: "borderline" },
      { id: "l-h11", patientId: "p-harold", name: "eGFR", loincCode: "98979-8", panelId: "lp-h-cmp-0212", value: 66, unit: "mL/min", date: "2026-02-12", referenceRange: { low: 60 }, status: "normal" },
      { id: "l-h12", patientId: "p-harold", name: "Potassium", loincCode: "2823-3", panelId: "lp-h-cmp-0212", value: 4.4, unit: "mmol/L", date: "2026-02-12", referenceRange: { low: 3.5, high: 5.1 }, status: "normal" },
      { id: "l-h13", patientId: "p-harold", name: "LDL cholesterol", loincCode: "13457-7", panelId: "lp-h-lipid-0212", value: 96, unit: "mg/dL", date: "2026-02-12", referenceRange: { high: 100 }, status: "normal" },
      // August labs
      { id: "l-h2", patientId: "p-harold", name: "HbA1c", loincCode: "4548-4", panelId: "lp-h-a1c-0815", value: 6.9, unit: "%", date: "2026-08-15", referenceRange: { high: 7.0 }, status: "normal" },
      { id: "l-h3", patientId: "p-harold", name: "LDL cholesterol", loincCode: "13457-7", panelId: "lp-h-lipid-0815", value: 88, unit: "mg/dL", date: "2026-08-15", referenceRange: { high: 100 }, status: "normal" },
      { id: "l-h4", patientId: "p-harold", name: "eGFR", loincCode: "98979-8", panelId: "lp-h-cmp-0815", value: 64, unit: "mL/min", date: "2026-08-15", referenceRange: { low: 60 }, status: "borderline" },
      { id: "l-h5", patientId: "p-harold", name: "Potassium", loincCode: "2823-3", panelId: "lp-h-cmp-0815", value: 4.6, unit: "mmol/L", date: "2026-08-15", referenceRange: { low: 3.5, high: 5.1 }, status: "normal" },
    ],
    vitals: [
      { id: "v-h1", patientId: "p-harold", timestamp: "2026-09-09T08:10:00", systolic: 134, diastolic: 82, heartRate: 68, weightKg: 88.4, bpSetting: "home-cuff" },
      { id: "v-h2", patientId: "p-harold", timestamp: "2026-09-02T08:05:00", systolic: 138, diastolic: 84, heartRate: 72, weightKg: 88.9, bpSetting: "home-cuff" },
      { id: "v-h3", patientId: "p-harold", timestamp: "2026-08-26T08:15:00", systolic: 131, diastolic: 80, heartRate: 70, weightKg: 89.1, bpSetting: "home-cuff" },
      { id: "v-h4", patientId: "p-harold", timestamp: "2026-08-20T10:30:00", systolic: 136, diastolic: 84, heartRate: 71, weightKg: 89.3, bpSetting: "clinic" },
    ],
  },
  {
    id: "p-margaret",
    name: "Margaret Lindqvist",
    age: 72,
    sex: "female",
    summary: "Heart failure and depression, 9 medications including 2 psychotropics, mood trending down.",
    primaryClinician: "Dr. Samuel Reyes, Family Medicine",
    conditions: [
      { name: "Heart failure (HFpEF)", category: "cardiovascular", code: "I50.32", snomedCode: "446221000", diagnosedOn: "2021-09-08", clinicalStatus: "active" },
      { name: "Type 2 diabetes", category: "diabetes", code: "E11.9", snomedCode: "44054006", diagnosedOn: "2012-01-17", clinicalStatus: "active" },
      { name: "Hypertension", category: "hypertension", code: "I10", snomedCode: "38341003", diagnosedOn: "2008-05-22", clinicalStatus: "active" },
      { name: "Major depressive disorder", category: "mental-health", code: "F33.1", snomedCode: "66344007", diagnosedOn: "2020-02-03", clinicalStatus: "active" },
      { name: "Insomnia", category: "mental-health", code: "G47.00", snomedCode: "193462001", diagnosedOn: "2022-10-11", clinicalStatus: "active" },
      { name: "Overactive bladder", category: "other", code: "N32.81", snomedCode: "412714001", diagnosedOn: "2024-04-30", clinicalStatus: "active" },
    ],
    medications: [
      { id: "m-m1", name: "Metformin", genericName: "metformin", class: "biguanide", dose: "500 mg", frequency: "twice daily", startDate: "2012-02-01", indication: "Type 2 diabetes", prescriber: "Dr. Samuel Reyes, Family Medicine" },
      { id: "m-m2", name: "Glipizide", genericName: "glipizide", class: "sulfonylurea", dose: "5 mg", frequency: "once daily", startDate: "2018-08-10", indication: "Type 2 diabetes", prescriber: "Dr. Samuel Reyes, Family Medicine" },
      { id: "m-m3", name: "Amlodipine", genericName: "amlodipine", class: "calcium-channel-blocker", dose: "5 mg", frequency: "once daily", startDate: "2008-06-01", indication: "Hypertension", prescriber: "Dr. Samuel Reyes, Family Medicine" },
      { id: "m-m4", name: "Furosemide", genericName: "furosemide", class: "diuretic", dose: "40 mg", frequency: "once daily (morning)", startDate: "2021-09-20", indication: "Heart failure", prescriber: "Dr. Olivia Grant, Cardiology" },
      { id: "m-m5", name: "Carvedilol", genericName: "carvedilol", class: "beta-blocker", dose: "12.5 mg", frequency: "twice daily", startDate: "2021-09-20", indication: "Heart failure", prescriber: "Dr. Olivia Grant, Cardiology" },
      { id: "m-m6", name: "Sertraline", genericName: "sertraline", class: "ssri", dose: "100 mg", frequency: "once daily", startDate: "2020-02-15", indication: "Depression", prescriber: "Dr. Nadia Petrov, Psychiatry" },
      { id: "m-m7", name: "Zolpidem", genericName: "zolpidem", class: "z-drug", dose: "5 mg", frequency: "at bedtime", startDate: "2022-10-20", indication: "Insomnia", prescriber: "Dr. Samuel Reyes, Family Medicine" },
      { id: "m-m8", name: "Oxybutynin", genericName: "oxybutynin", class: "bladder-antimuscarinic", dose: "5 mg", frequency: "twice daily", startDate: "2024-05-06", indication: "Overactive bladder", prescriber: "Dr. Samuel Reyes, Family Medicine" },
      { id: "m-m9", name: "Diphenhydramine", genericName: "diphenhydramine", class: "antihistamine", dose: "25 mg", frequency: "at bedtime as needed", startDate: "2025-12-02", indication: "Sleep (over the counter)", prescriber: "Self (over the counter)" },
    ],
    medicationHistory: [
      { id: "e-m1", patientId: "p-margaret", date: "2026-08-22", medicationName: "Sertraline", type: "dose-changed", detail: "Sertraline increased from 50 mg to 100 mg daily." },
      { id: "e-m2", patientId: "p-margaret", date: "2025-12-02", medicationName: "Diphenhydramine", type: "started", detail: "Patient began taking over-the-counter diphenhydramine for sleep." },
    ],
    labs: [
      // February
      { id: "l-m6", patientId: "p-margaret", name: "HbA1c", loincCode: "4548-4", panelId: "lp-m-a1c-0212", value: 7.4, unit: "%", date: "2026-02-12", referenceRange: { high: 7.0 }, status: "abnormal" },
      { id: "l-m7", patientId: "p-margaret", name: "eGFR", loincCode: "98979-8", panelId: "lp-m-bmp-0212", value: 61, unit: "mL/min", date: "2026-02-12", referenceRange: { low: 60 }, status: "normal" },
      { id: "l-m8", patientId: "p-margaret", name: "Potassium", loincCode: "2823-3", panelId: "lp-m-bmp-0212", value: 3.8, unit: "mmol/L", date: "2026-02-12", referenceRange: { low: 3.5, high: 5.1 }, status: "normal" },
      { id: "l-m9", patientId: "p-margaret", name: "Sodium", loincCode: "2951-2", panelId: "lp-m-bmp-0212", value: 137, unit: "mmol/L", date: "2026-02-12", referenceRange: { low: 135, high: 145 }, status: "normal" },
      // May
      { id: "l-m10", patientId: "p-margaret", name: "HbA1c", loincCode: "4548-4", panelId: "lp-m-a1c-0520", value: 7.6, unit: "%", date: "2026-05-20", referenceRange: { high: 7.0 }, status: "abnormal" },
      { id: "l-m11", patientId: "p-margaret", name: "eGFR", loincCode: "98979-8", panelId: "lp-m-bmp-0520", value: 57, unit: "mL/min", date: "2026-05-20", referenceRange: { low: 60 }, status: "borderline" },
      { id: "l-m12", patientId: "p-margaret", name: "NT-proBNP", loincCode: "33762-6", panelId: "lp-m-bnp-0520", value: 280, unit: "pg/mL", date: "2026-05-20", referenceRange: { high: 300 }, status: "normal" },
      // August
      { id: "l-m1", patientId: "p-margaret", name: "HbA1c", loincCode: "4548-4", panelId: "lp-m-a1c-0828", value: 7.8, unit: "%", date: "2026-08-28", referenceRange: { high: 7.0 }, status: "abnormal" },
      { id: "l-m2", patientId: "p-margaret", name: "eGFR", loincCode: "98979-8", panelId: "lp-m-bmp-0828", value: 52, unit: "mL/min", date: "2026-08-28", referenceRange: { low: 60 }, status: "abnormal" },
      { id: "l-m3", patientId: "p-margaret", name: "Potassium", loincCode: "2823-3", panelId: "lp-m-bmp-0828", value: 3.4, unit: "mmol/L", date: "2026-08-28", referenceRange: { low: 3.5, high: 5.1 }, status: "borderline" },
      { id: "l-m4", patientId: "p-margaret", name: "NT-proBNP", loincCode: "33762-6", panelId: "lp-m-bnp-0828", value: 410, unit: "pg/mL", date: "2026-08-28", referenceRange: { high: 300 }, status: "borderline" },
      { id: "l-m5", patientId: "p-margaret", name: "Sodium", loincCode: "2951-2", panelId: "lp-m-bmp-0828", value: 134, unit: "mmol/L", date: "2026-08-28", referenceRange: { low: 135, high: 145 }, status: "borderline" },
    ],
    vitals: [
      { id: "v-m1", patientId: "p-margaret", timestamp: "2026-09-10T07:40:00", systolic: 118, diastolic: 70, heartRate: 62, weightKg: 71.2, bpSetting: "home-cuff" },
      { id: "v-m2", patientId: "p-margaret", timestamp: "2026-09-03T07:45:00", systolic: 122, diastolic: 72, heartRate: 64, weightKg: 70.9, bpSetting: "home-cuff" },
      { id: "v-m3", patientId: "p-margaret", timestamp: "2026-08-27T07:50:00", systolic: 126, diastolic: 76, heartRate: 66, weightKg: 70.6, bpSetting: "home-cuff" },
      { id: "v-m4", patientId: "p-margaret", timestamp: "2026-08-28T09:20:00", systolic: 124, diastolic: 74, heartRate: 65, weightKg: 70.8, bpSetting: "clinic" },
    ],
  },
  {
    id: "p-rosa",
    name: "Rosa Delgado",
    age: 65,
    sex: "female",
    summary: "Newly diagnosed type 2 diabetes, 5 medications, still building a logging habit.",
    primaryClinician: "Dr. Priya Raman, Endocrinology",
    conditions: [
      { name: "Type 2 diabetes (new)", category: "diabetes", code: "E11.9", snomedCode: "44054006", diagnosedOn: "2026-07-30", clinicalStatus: "active" },
      { name: "Hypertension", category: "hypertension", code: "I10", snomedCode: "38341003", diagnosedOn: "2019-10-04", clinicalStatus: "active" },
      { name: "Hyperlipidemia", category: "cardiovascular", code: "E78.5", snomedCode: "55822004", diagnosedOn: "2019-10-04", clinicalStatus: "active" },
      { name: "Hypothyroidism", category: "other", code: "E03.9", snomedCode: "40930008", diagnosedOn: "2011-02-18", clinicalStatus: "active" },
    ],
    medications: [
      { id: "m-r1", name: "Metformin", genericName: "metformin", class: "biguanide", dose: "500 mg", frequency: "twice daily with meals", startDate: "2026-08-03", indication: "Type 2 diabetes", prescriber: "Dr. Priya Raman, Endocrinology" },
      { id: "m-r2", name: "Lisinopril", genericName: "lisinopril", class: "ace-inhibitor", dose: "10 mg", frequency: "once daily", startDate: "2019-10-20", indication: "Hypertension", prescriber: "Dr. Marcus Bell, Family Medicine" },
      { id: "m-r3", name: "Hydrochlorothiazide", genericName: "hydrochlorothiazide", class: "diuretic", dose: "12.5 mg", frequency: "once daily", startDate: "2021-03-08", indication: "Hypertension", prescriber: "Dr. Marcus Bell, Family Medicine" },
      { id: "m-r4", name: "Rosuvastatin", genericName: "rosuvastatin", class: "statin", dose: "10 mg", frequency: "once daily", startDate: "2019-10-20", indication: "Hyperlipidemia", prescriber: "Dr. Marcus Bell, Family Medicine" },
      { id: "m-r5", name: "Levothyroxine", genericName: "levothyroxine", class: "thyroid", dose: "75 mcg", frequency: "once daily, empty stomach", startDate: "2011-03-01", indication: "Hypothyroidism", prescriber: "Dr. Marcus Bell, Family Medicine" },
    ],
    medicationHistory: [
      { id: "e-r1", patientId: "p-rosa", date: "2026-08-03", medicationName: "Metformin", type: "started", detail: "Metformin 500 mg twice daily started after diabetes diagnosis." },
    ],
    labs: [
      // Annual labs, a year before diagnosis
      { id: "l-r6", patientId: "p-rosa", name: "HbA1c", loincCode: "4548-4", panelId: "lp-r-a1c-2506", value: 6.2, unit: "%", date: "2025-06-20", referenceRange: { high: 7.0 }, status: "normal" },
      { id: "l-r7", patientId: "p-rosa", name: "LDL cholesterol", loincCode: "13457-7", panelId: "lp-r-lipid-2506", value: 124, unit: "mg/dL", date: "2025-06-20", referenceRange: { high: 100 }, status: "abnormal" },
      { id: "l-r8", patientId: "p-rosa", name: "TSH", loincCode: "3016-3", panelId: "lp-r-tsh-2506", value: 2.4, unit: "mIU/L", date: "2025-06-20", referenceRange: { low: 0.4, high: 4.0 }, status: "normal" },
      { id: "l-r9", patientId: "p-rosa", name: "eGFR", loincCode: "98979-8", panelId: "lp-r-cmp-2506", value: 88, unit: "mL/min", date: "2025-06-20", referenceRange: { low: 60 }, status: "normal" },
      // Diagnosis
      { id: "l-r1", patientId: "p-rosa", name: "HbA1c", loincCode: "4548-4", panelId: "lp-r-a1c-2607", value: 8.1, unit: "%", date: "2026-07-30", referenceRange: { high: 7.0 }, status: "abnormal" },
      { id: "l-r2", patientId: "p-rosa", name: "Fasting glucose", loincCode: "1558-6", panelId: "lp-r-cmp-2607", value: 156, unit: "mg/dL", date: "2026-07-30", referenceRange: { low: 70, high: 100 }, status: "abnormal" },
      { id: "l-r3", patientId: "p-rosa", name: "LDL cholesterol", loincCode: "13457-7", panelId: "lp-r-lipid-2607", value: 118, unit: "mg/dL", date: "2026-07-30", referenceRange: { high: 100 }, status: "borderline" },
      { id: "l-r4", patientId: "p-rosa", name: "TSH", loincCode: "3016-3", panelId: "lp-r-tsh-2607", value: 2.1, unit: "mIU/L", date: "2026-07-30", referenceRange: { low: 0.4, high: 4.0 }, status: "normal" },
      { id: "l-r5", patientId: "p-rosa", name: "eGFR", loincCode: "98979-8", panelId: "lp-r-cmp-2607", value: 84, unit: "mL/min", date: "2026-07-30", referenceRange: { low: 60 }, status: "normal" },
    ],
    vitals: [
      { id: "v-r1", patientId: "p-rosa", timestamp: "2026-09-08T09:00:00", systolic: 128, diastolic: 78, heartRate: 74, weightKg: 79.5, bpSetting: "home-cuff" },
      { id: "v-r2", patientId: "p-rosa", timestamp: "2026-08-25T09:10:00", systolic: 132, diastolic: 80, heartRate: 76, weightKg: 80.2, bpSetting: "home-cuff" },
      { id: "v-r3", patientId: "p-rosa", timestamp: "2026-07-30T10:15:00", systolic: 136, diastolic: 82, heartRate: 78, weightKg: 81.0, bpSetting: "clinic" },
    ],
  },
  {
    // An empty Passport shell. It is filled by importing the bundled Synthea
    // FHIR R4 record at /passport/add/synthea/, through the same review queue
    // every other import uses.
    id: "p-synthea-shaun",
    name: "Shaun461 Javier97 Cormier289",
    age: 73,
    sex: "male",
    summary: "Synthetic Synthea patient. Import the FHIR record to build this Passport.",
    primaryClinician: "Not imported yet",
    conditions: [],
    medications: [],
    medicationHistory: [],
    labs: [],
    vitals: [],
  },
];

function normalize(p: SeedPatient): Patient {
  return {
    ...p,
    conditions: p.conditions.map((c, i) => seeded<Condition>({ ...c, id: `cond-${p.id}-${i + 1}` })),
    medications: p.medications.map((m) =>
      seeded<Medication>({ ...m, status: m.status ?? "active", rxNormCode: lookupDrug(m.genericName)?.rxcui }),
    ),
    medicationHistory: p.medicationHistory.map((e) => seeded<MedicationEvent>(e)),
    labs: p.labs.map((l) => seeded<LabResult>(l)),
    vitals: p.vitals.map((v) => seeded<VitalSign>(v)),
  };
}

export const patients: Patient[] = seedPatients.map(normalize);
