import type { Patient } from "../types";

/**
 * SYNTHETIC PATIENTS — no real people, no real records.
 *
 * Three personas chosen to exercise different risk profiles:
 *  - p-harold:   68, AFib + diabetes, 7 meds incl. warfarin + statin
 *  - p-margaret: 72, heart failure + depression, 9 meds incl. 2 psychotropics
 *  - p-rosa:     65, newly diagnosed diabetic, 5 meds, patchy nutrition log
 *
 * In a later phase this module is replaced by a FHIR client
 * (Patient / MedicationStatement / Condition / Observation bundles).
 */
export const patients: Patient[] = [
  {
    id: "p-harold",
    name: "Harold Okafor",
    age: 68,
    sex: "male",
    summary: "Atrial fibrillation on warfarin, 7 medications, variable leafy-green intake.",
    primaryClinician: "Dr. Amara Nwosu, Internal Medicine",
    conditions: [
      { name: "Atrial fibrillation", category: "cardiovascular", code: "I48.91", diagnosedOn: "2023-11-02" },
      { name: "Hypertension", category: "hypertension", code: "I10", diagnosedOn: "2015-03-12" },
      { name: "Hyperlipidemia", category: "cardiovascular", code: "E78.5", diagnosedOn: "2015-03-12" },
      { name: "Type 2 diabetes", category: "diabetes", code: "E11.9", diagnosedOn: "2019-06-20" },
    ],
    medications: [
      { id: "m-h1", name: "Warfarin", genericName: "warfarin", class: "anticoagulant", dose: "5 mg", frequency: "once daily (evening)", startDate: "2023-11-10", indication: "Stroke prevention (AFib)" },
      { id: "m-h2", name: "Atorvastatin", genericName: "atorvastatin", class: "statin", dose: "40 mg", frequency: "once daily", startDate: "2015-04-01", indication: "Hyperlipidemia" },
      { id: "m-h3", name: "Metoprolol succinate", genericName: "metoprolol", class: "beta-blocker", dose: "50 mg", frequency: "once daily", startDate: "2023-11-10", indication: "Rate control" },
      { id: "m-h4", name: "Lisinopril", genericName: "lisinopril", class: "ace-inhibitor", dose: "20 mg", frequency: "once daily", startDate: "2015-04-01", indication: "Hypertension" },
      { id: "m-h5", name: "Metformin", genericName: "metformin", class: "biguanide", dose: "1000 mg", frequency: "twice daily", startDate: "2019-07-01", indication: "Type 2 diabetes" },
      { id: "m-h6", name: "Omeprazole", genericName: "omeprazole", class: "proton-pump-inhibitor", dose: "20 mg", frequency: "once daily", startDate: "2022-02-14", indication: "GERD" },
      { id: "m-h7", name: "Aspirin", genericName: "aspirin", class: "antiplatelet", dose: "81 mg", frequency: "once daily", startDate: "2026-08-20", indication: "Added after cardiology visit" },
    ],
    medicationHistory: [
      { id: "e-h1", patientId: "p-harold", date: "2026-08-20", medicationName: "Aspirin", type: "started", detail: "Aspirin 81 mg added after cardiology follow-up." },
    ],
    labs: [
      { id: "l-h1", patientId: "p-harold", name: "INR", value: 3.4, unit: "", date: "2026-09-04", referenceRange: { low: 2.0, high: 3.0 }, status: "abnormal" },
      { id: "l-h2", patientId: "p-harold", name: "HbA1c", value: 6.9, unit: "%", date: "2026-08-15", referenceRange: { high: 7.0 }, status: "normal" },
      { id: "l-h3", patientId: "p-harold", name: "LDL cholesterol", value: 88, unit: "mg/dL", date: "2026-08-15", referenceRange: { high: 100 }, status: "normal" },
      { id: "l-h4", patientId: "p-harold", name: "eGFR", value: 64, unit: "mL/min", date: "2026-08-15", referenceRange: { low: 60 }, status: "borderline" },
      { id: "l-h5", patientId: "p-harold", name: "Potassium", value: 4.6, unit: "mmol/L", date: "2026-08-15", referenceRange: { low: 3.5, high: 5.1 }, status: "normal" },
    ],
    vitals: [
      { id: "v-h1", patientId: "p-harold", timestamp: "2026-09-09T08:10:00", systolic: 134, diastolic: 82, heartRate: 68, weightKg: 88.4 },
      { id: "v-h2", patientId: "p-harold", timestamp: "2026-09-02T08:05:00", systolic: 138, diastolic: 84, heartRate: 72, weightKg: 88.9 },
      { id: "v-h3", patientId: "p-harold", timestamp: "2026-08-26T08:15:00", systolic: 131, diastolic: 80, heartRate: 70, weightKg: 89.1 },
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
      { name: "Heart failure (HFpEF)", category: "cardiovascular", code: "I50.32", diagnosedOn: "2021-09-08" },
      { name: "Type 2 diabetes", category: "diabetes", code: "E11.9", diagnosedOn: "2012-01-17" },
      { name: "Hypertension", category: "hypertension", code: "I10", diagnosedOn: "2008-05-22" },
      { name: "Major depressive disorder", category: "mental-health", code: "F33.1", diagnosedOn: "2020-02-03" },
      { name: "Insomnia", category: "mental-health", code: "G47.00", diagnosedOn: "2022-10-11" },
      { name: "Overactive bladder", category: "other", code: "N32.81", diagnosedOn: "2024-04-30" },
    ],
    medications: [
      { id: "m-m1", name: "Metformin", genericName: "metformin", class: "biguanide", dose: "500 mg", frequency: "twice daily", startDate: "2012-02-01", indication: "Type 2 diabetes" },
      { id: "m-m2", name: "Glipizide", genericName: "glipizide", class: "sulfonylurea", dose: "5 mg", frequency: "once daily", startDate: "2018-08-10", indication: "Type 2 diabetes" },
      { id: "m-m3", name: "Amlodipine", genericName: "amlodipine", class: "calcium-channel-blocker", dose: "5 mg", frequency: "once daily", startDate: "2008-06-01", indication: "Hypertension" },
      { id: "m-m4", name: "Furosemide", genericName: "furosemide", class: "diuretic", dose: "40 mg", frequency: "once daily (morning)", startDate: "2021-09-20", indication: "Heart failure" },
      { id: "m-m5", name: "Carvedilol", genericName: "carvedilol", class: "beta-blocker", dose: "12.5 mg", frequency: "twice daily", startDate: "2021-09-20", indication: "Heart failure" },
      { id: "m-m6", name: "Sertraline", genericName: "sertraline", class: "ssri", dose: "100 mg", frequency: "once daily", startDate: "2020-02-15", indication: "Depression" },
      { id: "m-m7", name: "Zolpidem", genericName: "zolpidem", class: "z-drug", dose: "5 mg", frequency: "at bedtime", startDate: "2022-10-20", indication: "Insomnia" },
      { id: "m-m8", name: "Oxybutynin", genericName: "oxybutynin", class: "bladder-antimuscarinic", dose: "5 mg", frequency: "twice daily", startDate: "2024-05-06", indication: "Overactive bladder" },
      { id: "m-m9", name: "Diphenhydramine", genericName: "diphenhydramine", class: "antihistamine", dose: "25 mg", frequency: "at bedtime as needed", startDate: "2025-12-02", indication: "Sleep (over the counter)" },
    ],
    medicationHistory: [
      { id: "e-m1", patientId: "p-margaret", date: "2026-08-22", medicationName: "Sertraline", type: "dose-changed", detail: "Sertraline increased from 50 mg to 100 mg daily." },
      { id: "e-m2", patientId: "p-margaret", date: "2025-12-02", medicationName: "Diphenhydramine", type: "started", detail: "Patient began taking over-the-counter diphenhydramine for sleep." },
    ],
    labs: [
      { id: "l-m1", patientId: "p-margaret", name: "HbA1c", value: 7.8, unit: "%", date: "2026-08-28", referenceRange: { high: 7.0 }, status: "abnormal" },
      { id: "l-m2", patientId: "p-margaret", name: "eGFR", value: 52, unit: "mL/min", date: "2026-08-28", referenceRange: { low: 60 }, status: "abnormal" },
      { id: "l-m3", patientId: "p-margaret", name: "Potassium", value: 3.4, unit: "mmol/L", date: "2026-08-28", referenceRange: { low: 3.5, high: 5.1 }, status: "borderline" },
      { id: "l-m4", patientId: "p-margaret", name: "NT-proBNP", value: 410, unit: "pg/mL", date: "2026-08-28", referenceRange: { high: 300 }, status: "borderline" },
      { id: "l-m5", patientId: "p-margaret", name: "Sodium", value: 134, unit: "mmol/L", date: "2026-08-28", referenceRange: { low: 135, high: 145 }, status: "borderline" },
    ],
    vitals: [
      { id: "v-m1", patientId: "p-margaret", timestamp: "2026-09-10T07:40:00", systolic: 118, diastolic: 70, heartRate: 62, weightKg: 71.2 },
      { id: "v-m2", patientId: "p-margaret", timestamp: "2026-09-03T07:45:00", systolic: 122, diastolic: 72, heartRate: 64, weightKg: 70.9 },
      { id: "v-m3", patientId: "p-margaret", timestamp: "2026-08-27T07:50:00", systolic: 126, diastolic: 76, heartRate: 66, weightKg: 70.6 },
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
      { name: "Type 2 diabetes (new)", category: "diabetes", code: "E11.9", diagnosedOn: "2026-07-30" },
      { name: "Hypertension", category: "hypertension", code: "I10", diagnosedOn: "2019-10-04" },
      { name: "Hyperlipidemia", category: "cardiovascular", code: "E78.5", diagnosedOn: "2019-10-04" },
      { name: "Hypothyroidism", category: "other", code: "E03.9", diagnosedOn: "2011-02-18" },
    ],
    medications: [
      { id: "m-r1", name: "Metformin", genericName: "metformin", class: "biguanide", dose: "500 mg", frequency: "twice daily with meals", startDate: "2026-08-03", indication: "Type 2 diabetes" },
      { id: "m-r2", name: "Lisinopril", genericName: "lisinopril", class: "ace-inhibitor", dose: "10 mg", frequency: "once daily", startDate: "2019-10-20", indication: "Hypertension" },
      { id: "m-r3", name: "Hydrochlorothiazide", genericName: "hydrochlorothiazide", class: "diuretic", dose: "12.5 mg", frequency: "once daily", startDate: "2021-03-08", indication: "Hypertension" },
      { id: "m-r4", name: "Rosuvastatin", genericName: "rosuvastatin", class: "statin", dose: "10 mg", frequency: "once daily", startDate: "2019-10-20", indication: "Hyperlipidemia" },
      { id: "m-r5", name: "Levothyroxine", genericName: "levothyroxine", class: "thyroid", dose: "75 mcg", frequency: "once daily, empty stomach", startDate: "2011-03-01", indication: "Hypothyroidism" },
    ],
    medicationHistory: [
      { id: "e-r1", patientId: "p-rosa", date: "2026-08-03", medicationName: "Metformin", type: "started", detail: "Metformin 500 mg twice daily started after diabetes diagnosis." },
    ],
    labs: [
      { id: "l-r1", patientId: "p-rosa", name: "HbA1c", value: 8.1, unit: "%", date: "2026-07-30", referenceRange: { high: 7.0 }, status: "abnormal" },
      { id: "l-r2", patientId: "p-rosa", name: "Fasting glucose", value: 156, unit: "mg/dL", date: "2026-07-30", referenceRange: { low: 70, high: 100 }, status: "abnormal" },
      { id: "l-r3", patientId: "p-rosa", name: "LDL cholesterol", value: 118, unit: "mg/dL", date: "2026-07-30", referenceRange: { high: 100 }, status: "borderline" },
      { id: "l-r4", patientId: "p-rosa", name: "TSH", value: 2.1, unit: "mIU/L", date: "2026-07-30", referenceRange: { low: 0.4, high: 4.0 }, status: "normal" },
      { id: "l-r5", patientId: "p-rosa", name: "eGFR", value: 84, unit: "mL/min", date: "2026-07-30", referenceRange: { low: 60 }, status: "normal" },
    ],
    vitals: [
      { id: "v-r1", patientId: "p-rosa", timestamp: "2026-09-08T09:00:00", systolic: 128, diastolic: 78, heartRate: 74, weightKg: 79.5 },
      { id: "v-r2", patientId: "p-rosa", timestamp: "2026-08-25T09:10:00", systolic: 132, diastolic: 80, heartRate: 76, weightKg: 80.2 },
    ],
  },
];
