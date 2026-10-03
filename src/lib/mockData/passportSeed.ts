import type {
  Allergy,
  Appointment,
  CarePlan,
  CareTeamMember,
  EmergencyInfo,
  Encounter,
  HealthDocument,
  Immunization,
  LabPanel,
  MentalHealthAssessment,
  NutritionProfile,
  PatientId,
  Procedure,
  SocialHistoryItem,
} from "../types";
import { severityBand } from "../screening";
import { seeded, seededAll, type Unsourced } from "./seed";

/**
 * SYNTHETIC PATIENT PASSPORT SEED — no real people, no real records.
 *
 * The rest of each persona's Passport: appointments, visit summaries, care
 * team, allergies, immunizations, procedures, lab panels, care plans,
 * documents, nutrition profile, screening history and emergency info.
 * Everything is coherent with the persona stories in `patients.ts` /
 * `entries.ts` and dated relative to REFERENCE_DATE (2026-09-11).
 */

interface SeedPassport {
  allergies: Unsourced<Allergy>[];
  appointments: Unsourced<Appointment>[];
  encounters: Unsourced<Encounter>[];
  labPanels: Unsourced<LabPanel>[];
  immunizations: Unsourced<Immunization>[];
  procedures: Unsourced<Procedure>[];
  careTeam: Unsourced<CareTeamMember>[];
  carePlans: Unsourced<CarePlan>[];
  documents: Unsourced<HealthDocument>[];
  assessments: Unsourced<MentalHealthAssessment>[];
  socialHistory: Unsourced<SocialHistoryItem>[];
  nutritionProfile: Unsourced<NutritionProfile>;
  emergency: Unsourced<EmergencyInfo>;
}

export interface PassportSeed {
  allergies: Allergy[];
  appointments: Appointment[];
  encounters: Encounter[];
  labPanels: LabPanel[];
  immunizations: Immunization[];
  procedures: Procedure[];
  careTeam: CareTeamMember[];
  carePlans: CarePlan[];
  documents: HealthDocument[];
  assessments: MentalHealthAssessment[];
  socialHistory: SocialHistoryItem[];
  nutritionProfile: NutritionProfile;
  emergency: EmergencyInfo;
}

function panel(id: string, patientId: PatientId, name: string, code: string, date: string, orderedBy: string, performer = "Quest Diagnostics"): Unsourced<LabPanel> {
  return { id, patientId, name, code, date, orderedBy, performer };
}

function screening(
  id: string,
  patientId: PatientId,
  instrument: MentalHealthAssessment["instrument"],
  date: string,
  score: number,
  administeredBy: MentalHealthAssessment["administeredBy"],
): Unsourced<MentalHealthAssessment> {
  return { id, patientId, instrument, date, score, severity: severityBand(instrument, score), administeredBy };
}

/* ======================================================================== */
/* Harold Okafor                                                             */
/* ======================================================================== */
const H: PatientId = "p-harold";
const NWOSU = "Dr. Amara Nwosu";
const CHO = "Dr. Daniel Cho";

const harold: SeedPassport = {
  allergies: [
    {
      id: "al-h1", patientId: H, substance: "Ibuprofen (NSAIDs)", category: "medication", type: "allergy",
      matches: { classes: ["nsaid"] }, reaction: "Stomach bleeding requiring a hospital stay (2018)", severity: "severe", recordedOn: "2018-05-03", code: "5640",
    },
    {
      id: "al-h2", patientId: H, substance: "Penicillin", category: "medication", type: "allergy",
      matches: { genericNames: ["penicillin", "amoxicillin"] }, reaction: "Hives", severity: "moderate", recordedOn: "1994-01-01", code: "70618",
    },
  ],
  appointments: [
    { id: "ap-h1", patientId: H, start: "2026-06-10T14:00:00", status: "fulfilled", clinician: "Maya Brooks, RDN", specialty: "Nutrition", location: "Riverside Health — Nutrition Services", reason: "Diet and warfarin", encounterId: "en-h1" },
    { id: "ap-h2", patientId: H, start: "2026-08-15T09:00:00", status: "fulfilled", clinician: NWOSU, specialty: "Internal Medicine", location: "Riverside Health — Primary Care", reason: "Diabetes and blood pressure follow-up", encounterId: "en-h2" },
    { id: "ap-h3", patientId: H, start: "2026-08-20T10:30:00", status: "fulfilled", clinician: CHO, specialty: "Cardiology", location: "Riverside Heart Center", reason: "Atrial fibrillation follow-up", encounterId: "en-h3" },
    { id: "ap-h4", patientId: H, start: "2026-09-04T08:30:00", status: "fulfilled", clinician: "Linda Park, PharmD", specialty: "Anticoagulation clinic", location: "Riverside Heart Center", reason: "INR check", encounterId: "en-h4" },
    { id: "ap-h5", patientId: H, start: "2026-09-18T08:30:00", status: "booked", clinician: "Linda Park, PharmD", specialty: "Anticoagulation clinic", location: "Riverside Heart Center", reason: "INR recheck" },
    { id: "ap-h6", patientId: H, start: "2026-10-02T09:15:00", status: "booked", clinician: NWOSU, specialty: "Internal Medicine", location: "Riverside Health — Primary Care", reason: "Follow-up: bruising, INR, new aspirin" },
    { id: "ap-h7", patientId: H, start: "2026-11-12T11:00:00", status: "booked", clinician: CHO, specialty: "Cardiology", location: "Riverside Heart Center", reason: "Cardiology follow-up" },
  ],
  encounters: [
    {
      id: "en-h1", patientId: H, date: "2026-06-10", type: "office", clinician: "Maya Brooks, RDN", specialty: "Nutrition", organization: "Riverside Health",
      reason: "Diet review while on warfarin",
      summary: "Reviewed usual diet. Harold enjoys kale and spinach but eats them in bursts. Explained that warfarin works best with a steady amount of vitamin K from week to week rather than avoiding greens. Suggested a consistent 3–4 servings of leafy greens per week and keeping a simple food log.",
      diagnoses: ["Long-term (current) use of anticoagulants"], documentId: "doc-h1",
    },
    {
      id: "en-h2", patientId: H, date: "2026-08-15", type: "office", clinician: NWOSU, specialty: "Internal Medicine", organization: "Riverside Health",
      reason: "Diabetes and blood pressure follow-up",
      summary: "A1c 6.9%, improved from 7.1% in February. Blood pressure 136/84 at home on average. Kidney function stable (eGFR 64). Continue current medicines. Encouraged daily walks.",
      diagnoses: ["Type 2 diabetes", "Hypertension"],
    },
    {
      id: "en-h3", patientId: H, date: "2026-08-20", type: "office", clinician: CHO, specialty: "Cardiology", organization: "Riverside Heart Center",
      reason: "Atrial fibrillation follow-up",
      summary: "Rate well controlled on metoprolol. Added aspirin 81 mg daily after discussion of coronary risk. Continue warfarin with INR goal 2.0–3.0. Follow up in 3 months.",
      diagnoses: ["Atrial fibrillation"], documentId: "doc-h2",
    },
    {
      id: "en-h4", patientId: H, date: "2026-09-04", type: "office", clinician: "Linda Park, PharmD", specialty: "Anticoagulation clinic", organization: "Riverside Heart Center",
      reason: "INR check",
      summary: "INR 3.4, above goal (2.0–3.0). Patient reports new bruising on forearms and one short nosebleed. No change to warfarin dose today; recheck INR in two weeks. Reminded about consistent vitamin K intake.",
      diagnoses: ["Long-term (current) use of anticoagulants"],
    },
  ],
  labPanels: [
    panel("lp-h-a1c-0212", H, "Hemoglobin A1c", "4548-4", "2026-02-12", NWOSU),
    panel("lp-h-cmp-0212", H, "Comprehensive metabolic panel", "24323-8", "2026-02-12", NWOSU),
    panel("lp-h-lipid-0212", H, "Lipid panel", "57698-3", "2026-02-12", NWOSU),
    panel("lp-h-inr-0710", H, "Prothrombin time / INR", "34714-6", "2026-07-10", CHO, "Riverside Heart Center lab"),
    panel("lp-h-inr-0724", H, "Prothrombin time / INR", "34714-6", "2026-07-24", CHO, "Riverside Heart Center lab"),
    panel("lp-h-inr-0807", H, "Prothrombin time / INR", "34714-6", "2026-08-07", CHO, "Riverside Heart Center lab"),
    panel("lp-h-a1c-0815", H, "Hemoglobin A1c", "4548-4", "2026-08-15", NWOSU),
    panel("lp-h-cmp-0815", H, "Comprehensive metabolic panel", "24323-8", "2026-08-15", NWOSU),
    panel("lp-h-lipid-0815", H, "Lipid panel", "57698-3", "2026-08-15", NWOSU),
    panel("lp-h-inr-0821", H, "Prothrombin time / INR", "34714-6", "2026-08-21", CHO, "Riverside Heart Center lab"),
    panel("lp-h-inr-0904", H, "Prothrombin time / INR", "34714-6", "2026-09-04", CHO, "Riverside Heart Center lab"),
  ],
  immunizations: [
    { id: "im-h1", patientId: H, vaccine: "Influenza (flu), 2025–26 season", date: "2025-10-08", cvxCode: "197", performer: "Riverside Pharmacy" },
    { id: "im-h2", patientId: H, vaccine: "COVID-19, 2025–26 formula", date: "2025-10-08", cvxCode: "309", performer: "Riverside Pharmacy" },
    { id: "im-h3", patientId: H, vaccine: "Pneumococcal conjugate (PCV20)", date: "2024-01-15", cvxCode: "216", performer: NWOSU },
    { id: "im-h4", patientId: H, vaccine: "Shingles (recombinant zoster)", date: "2023-05-02", cvxCode: "187", doseNote: "Dose 2 of 2", performer: "Riverside Pharmacy" },
    { id: "im-h5", patientId: H, vaccine: "Tdap", date: "2020-07-19", cvxCode: "115", performer: NWOSU },
  ],
  procedures: [
    { id: "pr-h1", patientId: H, name: "Echocardiogram", date: "2023-11-05", code: "40701008", performer: CHO, outcome: "Normal pumping function; mildly enlarged left atrium." },
    { id: "pr-h2", patientId: H, name: "Colonoscopy", date: "2022-03-10", code: "73761001", performer: "Dr. Ruth Adler, Gastroenterology", outcome: "One small polyp removed; repeat in 5 years." },
  ],
  careTeam: [
    { id: "ct-h1", patientId: H, name: NWOSU, role: "primary-care", specialty: "Internal Medicine", organization: "Riverside Health", phone: "(555) 010-2200", isPrimary: true },
    { id: "ct-h2", patientId: H, name: CHO, role: "specialist", specialty: "Cardiology", organization: "Riverside Heart Center", phone: "(555) 010-3300" },
    { id: "ct-h3", patientId: H, name: "Linda Park, PharmD", role: "pharmacist", specialty: "Anticoagulation clinic", organization: "Riverside Heart Center", phone: "(555) 010-3345" },
    { id: "ct-h4", patientId: H, name: "Maya Brooks, RDN", role: "dietitian", specialty: "Nutrition", organization: "Riverside Health", email: "nutrition@riverside.example" },
    { id: "ct-h5", patientId: H, name: "Grace Okafor", role: "caregiver", specialty: "Spouse", phone: "(555) 010-7781" },
  ],
  carePlans: [
    {
      id: "cp-h1", patientId: H, title: "Warfarin monitoring", category: "monitoring", author: "Linda Park, PharmD", date: "2026-09-04", status: "active",
      instructions: ["INR goal 2.0–3.0.", "INR check every two weeks until two results in range.", "Call the clinic for unusual bruising, blood in urine or stool, or a nosebleed that won't stop."],
    },
    {
      id: "cp-h2", patientId: H, title: "Keep vitamin K steady", category: "nutrition", author: "Maya Brooks, RDN", date: "2026-06-10", status: "active",
      instructions: ["Aim for 3–4 servings of leafy greens spread across the week, rather than in bursts.", "Log meals so patterns are easy to review at INR checks."],
    },
    {
      id: "cp-h3", patientId: H, title: "Blood pressure and diabetes", category: "lifestyle", author: NWOSU, date: "2026-08-15", status: "active",
      instructions: ["Home blood pressure goal under 130/80.", "30-minute walk most days.", "A1c recheck in 6 months."],
    },
  ],
  documents: [
    {
      id: "doc-h1", patientId: H, title: "Nutrition visit — diet and warfarin", type: "dietitian-note", date: "2026-06-10", author: "Maya Brooks, RDN", organization: "Riverside Health",
      text: "NUTRITION NOTE\nReason: diet review while on warfarin.\nAssessment: intermittent high intake of leafy greens (kale, spinach) alternating with weeks of none.\nPlan: consistent vitamin K intake, 3–4 servings of leafy greens per week spread evenly; keep a simple food log; bring log to INR visits.",
    },
    {
      id: "doc-h2", patientId: H, title: "Cardiology visit summary", type: "visit-summary", date: "2026-08-20", author: CHO, organization: "Riverside Heart Center",
      text: "CARDIOLOGY FOLLOW-UP\nAtrial fibrillation, rate controlled on metoprolol succinate 50 mg daily.\nStarted aspirin 81 mg daily.\nContinue warfarin 5 mg daily, INR goal 2.0–3.0.\nReturn in 3 months.",
    },
  ],
  assessments: [
    screening("as-h1", H, "PHQ-9", "2026-02-12", 2, "clinician"),
    screening("as-h2", H, "GAD-7", "2026-02-12", 3, "clinician"),
    screening("as-h3", H, "PHQ-9", "2026-08-15", 3, "clinician"),
    screening("as-h4", H, "GAD-7", "2026-08-15", 4, "clinician"),
  ],
  socialHistory: [
    { id: "sh-h1", patientId: H, category: "tobacco", value: "Former smoker — quit in 2009", date: "2026-08-15", code: "72166-2" },
    { id: "sh-h2", patientId: H, category: "alcohol", value: "A glass of wine with dinner on weekends", date: "2026-08-15", code: "11331-6" },
  ],
  nutritionProfile: {
    id: `np-${H}`, patientId: H, dietaryPattern: "Mediterranean-style home cooking; working on eating greens steadily through the week",
    restrictions: ["Keep vitamin K intake consistent week to week", "Sodium under 2,300 mg a day"],
    intolerances: [],
    goals: ["3–4 servings of leafy greens spread across the week", "Log at least two meals a day"],
    dietitianNotes: [{ date: "2026-06-10", author: "Maya Brooks, RDN", note: "Greens are welcome — the goal is consistency, not avoidance." }],
    updatedAt: "2026-06-10T15:00:00",
  },
  emergency: {
    id: `em-${H}`, patientId: H, bloodType: "A+",
    contacts: [
      { name: "Grace Okafor", relationship: "Spouse", phone: "(555) 010-7781" },
      { name: "Daniel Okafor", relationship: "Son", phone: "(555) 010-4412" },
    ],
    criticalAllergies: ["NSAIDs (ibuprofen) — stomach bleeding", "Penicillin — hives"],
    criticalConditions: ["Atrial fibrillation", "Takes a blood thinner (warfarin)", "Type 2 diabetes"],
    notes: "On warfarin — bleeding risk. Cardiologist: Dr. Daniel Cho, Riverside Heart Center.",
    updatedAt: "2026-09-04T12:00:00",
  },
};

/* ======================================================================== */
/* Margaret Lindqvist                                                        */
/* ======================================================================== */
const M: PatientId = "p-margaret";
const REYES = "Dr. Samuel Reyes";
const PETROV = "Dr. Nadia Petrov";
const MOREAU = "Dr. Lena Moreau, PsyD";
const GRANT = "Dr. Olivia Grant";

const margaret: SeedPassport = {
  allergies: [
    { id: "al-m1", patientId: M, substance: "Codeine", category: "medication", type: "intolerance", matches: { genericNames: ["codeine"] }, reaction: "Severe nausea and vomiting", severity: "moderate", recordedOn: "2019-03-14", code: "2670" },
    { id: "al-m2", patientId: M, substance: "Shellfish", category: "food", type: "allergy", reaction: "Lip swelling", severity: "moderate", recordedOn: "2004-07-01" },
  ],
  appointments: [
    { id: "ap-m1", patientId: M, start: "2026-05-14T13:30:00", status: "fulfilled", clinician: "Carmen Ruiz, RDN", specialty: "Nutrition", location: "Lakeside Medical — Nutrition", reason: "Heart failure diet", encounterId: "en-m1" },
    { id: "ap-m2", patientId: M, start: "2026-07-10T10:00:00", status: "fulfilled", clinician: GRANT, specialty: "Cardiology (heart failure clinic)", location: "Lakeside Heart & Vascular", reason: "Heart failure follow-up", encounterId: "en-m2" },
    { id: "ap-m3", patientId: M, start: "2026-08-22T15:00:00", status: "fulfilled", clinician: PETROV, specialty: "Psychiatry", location: "Lakeside Behavioral Health", reason: "Medication review — depression", encounterId: "en-m3" },
    { id: "ap-m4", patientId: M, start: "2026-08-28T09:00:00", status: "fulfilled", clinician: REYES, specialty: "Family Medicine", location: "Lakeside Medical — Primary Care", reason: "Labs and diabetes check", encounterId: "en-m4" },
    { id: "ap-m5", patientId: M, start: "2026-09-02T11:00:00", status: "fulfilled", clinician: MOREAU, specialty: "Psychology", location: "Lakeside Behavioral Health", reason: "Therapy session", encounterId: "en-m5" },
    { id: "ap-m6", patientId: M, start: "2026-09-15T11:00:00", status: "booked", clinician: MOREAU, specialty: "Psychology", location: "Lakeside Behavioral Health", reason: "Therapy session" },
    { id: "ap-m7", patientId: M, start: "2026-09-24T15:30:00", status: "booked", clinician: PETROV, specialty: "Psychiatry", location: "Lakeside Behavioral Health", reason: "Follow-up after sertraline dose change" },
    { id: "ap-m8", patientId: M, start: "2026-10-06T09:00:00", status: "booked", clinician: REYES, specialty: "Family Medicine", location: "Lakeside Medical — Primary Care", reason: "Diabetes and kidney function follow-up" },
  ],
  encounters: [
    {
      id: "en-m1", patientId: M, date: "2026-05-14", type: "office", clinician: "Carmen Ruiz, RDN", specialty: "Nutrition", organization: "Lakeside Medical",
      reason: "Heart failure and diabetes diet",
      summary: "Discussed keeping sodium under 2 g a day and fluids around 1.5–2 L. Canned soups and deli meats are the main sources of salt. Carbohydrate portions reviewed for diabetes.",
      diagnoses: ["Heart failure", "Type 2 diabetes"], documentId: "doc-m1",
    },
    {
      id: "en-m2", patientId: M, date: "2026-07-10", type: "office", clinician: GRANT, specialty: "Cardiology", organization: "Lakeside Heart & Vascular",
      reason: "Heart failure follow-up",
      summary: "Stable symptoms, mild ankle swelling in the evening. Weight steady. Continue furosemide 40 mg and carvedilol 12.5 mg twice daily. Daily weights; call if up 2 lb in a day or 5 lb in a week.",
      diagnoses: ["Heart failure with preserved ejection fraction"],
    },
    {
      id: "en-m3", patientId: M, date: "2026-08-22", type: "office", clinician: PETROV, specialty: "Psychiatry", organization: "Lakeside Behavioral Health",
      reason: "Medication review — depression",
      summary: "Residual low mood and poor sleep on sertraline 50 mg. PHQ-9 today 7. Increased sertraline to 100 mg daily. Discussed that it can take several weeks to notice a benefit and to report any worsening mood sooner. Follow up in about 4 weeks.",
      diagnoses: ["Major depressive disorder, recurrent, moderate"], documentId: "doc-m2",
    },
    {
      id: "en-m4", patientId: M, date: "2026-08-28", type: "office", clinician: REYES, specialty: "Family Medicine", organization: "Lakeside Medical",
      reason: "Labs and diabetes check",
      summary: "A1c 7.8% (up from 7.6%). eGFR 52, lower than in May (57) and February (61). Potassium 3.4, sodium 134. Will recheck kidney function at next visit. Patient mentions dry mouth and feeling foggy.",
      diagnoses: ["Type 2 diabetes", "Chronic kidney disease stage 3a (to confirm)"],
    },
    {
      id: "en-m5", patientId: M, date: "2026-09-02", type: "therapy", clinician: MOREAU, specialty: "Psychology", organization: "Lakeside Behavioral Health",
      reason: "Therapy session",
      summary: "Reports lower energy and less interest in her usual activities over the past two weeks; spending more time in bed. PHQ-9 12, GAD-7 8. No thoughts of self-harm. Worked on scheduling small pleasant activities. Encouraged her to share these changes with Dr. Petrov.",
      diagnoses: ["Major depressive disorder, recurrent"], documentId: "doc-m3",
    },
  ],
  labPanels: [
    panel("lp-m-a1c-0212", M, "Hemoglobin A1c", "4548-4", "2026-02-12", REYES),
    panel("lp-m-bmp-0212", M, "Basic metabolic panel", "51990-0", "2026-02-12", REYES),
    panel("lp-m-a1c-0520", M, "Hemoglobin A1c", "4548-4", "2026-05-20", REYES),
    panel("lp-m-bmp-0520", M, "Basic metabolic panel", "51990-0", "2026-05-20", REYES),
    panel("lp-m-bnp-0520", M, "NT-proBNP", "33762-6", "2026-05-20", GRANT),
    panel("lp-m-a1c-0828", M, "Hemoglobin A1c", "4548-4", "2026-08-28", REYES),
    panel("lp-m-bmp-0828", M, "Basic metabolic panel", "51990-0", "2026-08-28", REYES),
    panel("lp-m-bnp-0828", M, "NT-proBNP", "33762-6", "2026-08-28", GRANT),
  ],
  immunizations: [
    { id: "im-m1", patientId: M, vaccine: "Influenza (flu), high-dose, 2025–26 season", date: "2025-10-02", cvxCode: "197", performer: "Lakeside Pharmacy" },
    { id: "im-m2", patientId: M, vaccine: "COVID-19, 2025–26 formula", date: "2025-10-02", cvxCode: "309", performer: "Lakeside Pharmacy" },
    { id: "im-m3", patientId: M, vaccine: "RSV (respiratory syncytial virus)", date: "2024-09-20", cvxCode: "305", performer: "Lakeside Pharmacy" },
    { id: "im-m4", patientId: M, vaccine: "Pneumococcal conjugate (PCV20)", date: "2023-03-11", cvxCode: "216", performer: REYES },
    { id: "im-m5", patientId: M, vaccine: "Shingles (recombinant zoster)", date: "2021-06-14", cvxCode: "187", doseNote: "Dose 2 of 2", performer: "Lakeside Pharmacy" },
  ],
  procedures: [
    { id: "pr-m1", patientId: M, name: "Echocardiogram", date: "2021-09-06", code: "40701008", performer: GRANT, outcome: "Preserved ejection fraction (58%); signs of stiff heart muscle." },
    { id: "pr-m2", patientId: M, name: "Cataract surgery, right eye", date: "2023-02-21", code: "54885007", performer: "Dr. Hugo Lindberg, Ophthalmology", outcome: "Uncomplicated." },
  ],
  careTeam: [
    { id: "ct-m1", patientId: M, name: REYES, role: "primary-care", specialty: "Family Medicine", organization: "Lakeside Medical", phone: "(555) 020-1100", isPrimary: true },
    { id: "ct-m2", patientId: M, name: GRANT, role: "specialist", specialty: "Cardiology (heart failure)", organization: "Lakeside Heart & Vascular", phone: "(555) 020-3300" },
    { id: "ct-m3", patientId: M, name: PETROV, role: "psychiatrist", specialty: "Psychiatry", organization: "Lakeside Behavioral Health", phone: "(555) 020-4400" },
    { id: "ct-m4", patientId: M, name: MOREAU, role: "psychologist", specialty: "Psychology", organization: "Lakeside Behavioral Health", phone: "(555) 020-4410" },
    { id: "ct-m5", patientId: M, name: "Carmen Ruiz, RDN", role: "dietitian", specialty: "Nutrition", organization: "Lakeside Medical" },
    { id: "ct-m6", patientId: M, name: "Thomas Webb, PharmD", role: "pharmacist", specialty: "Community pharmacy", organization: "Lakeside Pharmacy", phone: "(555) 020-9900" },
    { id: "ct-m7", patientId: M, name: "Ingrid Lindqvist", role: "caregiver", specialty: "Daughter", phone: "(555) 020-6621" },
  ],
  carePlans: [
    {
      id: "cp-m1", patientId: M, title: "Heart failure self-care", category: "monitoring", author: GRANT, date: "2026-07-10", status: "active",
      instructions: ["Weigh yourself every morning after using the bathroom.", "Call the clinic if weight is up 2 lb in a day or 5 lb in a week.", "Sodium under 2 g a day; fluids about 1.5–2 L."],
    },
    {
      id: "cp-m2", patientId: M, title: "Depression care", category: "mental-health", author: PETROV, date: "2026-08-22", status: "active",
      instructions: ["Sertraline 100 mg once daily.", "Weekly therapy with Dr. Moreau.", "Report worsening mood, new or stronger thoughts of self-harm, or unusual restlessness right away."],
    },
    {
      id: "cp-m3", patientId: M, title: "Kidney function follow-up", category: "follow-up", author: REYES, date: "2026-08-28", status: "active",
      instructions: ["Repeat kidney function (eGFR) and potassium at the October visit.", "Bring an up-to-date list of all medicines, including over-the-counter sleep aids."],
    },
  ],
  documents: [
    {
      id: "doc-m1", patientId: M, title: "Nutrition visit — heart failure diet", type: "dietitian-note", date: "2026-05-14", author: "Carmen Ruiz, RDN", organization: "Lakeside Medical",
      text: "NUTRITION NOTE\nDiagnoses: HFpEF, type 2 diabetes.\nSodium goal under 2 g/day; fluids 1.5–2 L/day.\nMain sodium sources: canned soup, deli meat, restaurant meals.\nCarbohydrate portions reviewed (plate method).",
    },
    {
      id: "doc-m2", patientId: M, title: "Psychiatry visit — medication review", type: "visit-summary", date: "2026-08-22", author: PETROV, organization: "Lakeside Behavioral Health",
      text: "PSYCHIATRY FOLLOW-UP\nPHQ-9: 7. Residual low mood, poor sleep.\nPlan: increase sertraline 50 mg → 100 mg daily. Continue therapy.\nFollow up in ~4 weeks; report worsening mood sooner.",
    },
    {
      id: "doc-m3", patientId: M, title: "Therapy session note", type: "behavioral-health-note", date: "2026-09-02", author: MOREAU, organization: "Lakeside Behavioral Health",
      text: "BEHAVIORAL HEALTH NOTE\nLower energy and interest over two weeks, more time in bed.\nPHQ-9: 12 (moderate). GAD-7: 8 (mild). Denies thoughts of self-harm.\nIntervention: behavioral activation, small scheduled activities.\nPlan: continue weekly; patient to share changes with psychiatrist.",
    },
  ],
  assessments: [
    screening("as-m1", M, "PHQ-9", "2026-03-10", 5, "clinician"),
    screening("as-m2", M, "GAD-7", "2026-03-10", 4, "clinician"),
    screening("as-m3", M, "PHQ-9", "2026-06-15", 5, "self"),
    screening("as-m4", M, "PHQ-9", "2026-08-22", 7, "clinician"),
    screening("as-m5", M, "GAD-7", "2026-08-22", 5, "clinician"),
    screening("as-m6", M, "PHQ-9", "2026-09-02", 12, "clinician"),
    screening("as-m7", M, "GAD-7", "2026-09-02", 8, "clinician"),
    screening("as-m8", M, "PHQ-9", "2026-09-09", 16, "self"),
  ],
  socialHistory: [
    { id: "sh-m1", patientId: M, category: "tobacco", value: "Never smoked", date: "2026-08-28", code: "72166-2" },
    { id: "sh-m2", patientId: M, category: "alcohol", value: "Doesn't drink alcohol", date: "2026-08-28", code: "11331-6" },
  ],
  nutritionProfile: {
    id: `np-${M}`, patientId: M, dietaryPattern: "Heart-failure diet (low sodium) with consistent carbohydrates for diabetes",
    restrictions: ["Sodium under 2 g a day", "Fluids about 1.5–2 L a day", "Consistent carbohydrate portions"],
    intolerances: ["Shellfish (allergy)"],
    goals: ["Swap canned soup for homemade low-sodium soup", "Use the plate method at dinner"],
    dietitianNotes: [{ date: "2026-05-14", author: "Carmen Ruiz, RDN", note: "Deli meat and canned soups are the biggest salt sources — start there." }],
    updatedAt: "2026-05-14T15:00:00",
  },
  emergency: {
    id: `em-${M}`, patientId: M, bloodType: "O+",
    contacts: [{ name: "Ingrid Lindqvist", relationship: "Daughter", phone: "(555) 020-6621" }],
    criticalAllergies: ["Codeine — severe nausea and vomiting", "Shellfish — lip swelling"],
    criticalConditions: ["Heart failure", "Type 2 diabetes (takes glipizide — low blood sugar possible)", "Depression"],
    notes: "Takes 9 medicines including a sleep aid; may be drowsy or unsteady.",
    updatedAt: "2026-08-28T12:00:00",
  },
};

/* ======================================================================== */
/* Rosa Delgado                                                              */
/* ======================================================================== */
const R: PatientId = "p-rosa";
const RAMAN = "Dr. Priya Raman";
const BELL = "Dr. Marcus Bell";

const rosa: SeedPassport = {
  allergies: [
    { id: "al-r1", patientId: R, substance: "Amoxicillin", category: "medication", type: "allergy", matches: { genericNames: ["amoxicillin", "penicillin"] }, reaction: "Rash and hives", severity: "moderate", recordedOn: "2009-11-20", code: "723" },
  ],
  appointments: [
    { id: "ap-r1", patientId: R, start: "2026-07-30T08:30:00", status: "fulfilled", clinician: RAMAN, specialty: "Endocrinology", location: "Mesa Valley Endocrine", reason: "New diagnosis — type 2 diabetes", encounterId: "en-r1" },
    { id: "ap-r2", patientId: R, start: "2026-08-03T10:00:00", status: "fulfilled", clinician: "Hannah Cole, RN, CDCES", specialty: "Diabetes education", location: "Mesa Valley Endocrine", reason: "Starting metformin; glucose meter training", encounterId: "en-r2" },
    { id: "ap-r3", patientId: R, start: "2026-08-19T14:00:00", status: "fulfilled", clinician: "Sofía Márquez, RDN", specialty: "Nutrition", location: "Mesa Valley Endocrine", reason: "Meal planning for diabetes", encounterId: "en-r3" },
    { id: "ap-r4", patientId: R, start: "2026-09-16T14:00:00", status: "booked", clinician: "Sofía Márquez, RDN", specialty: "Nutrition", location: "Mesa Valley Endocrine", reason: "Meal planning follow-up", patientNotes: "Ask about snacks in the afternoon." },
    { id: "ap-r5", patientId: R, start: "2026-10-29T08:30:00", status: "booked", clinician: RAMAN, specialty: "Endocrinology", location: "Mesa Valley Endocrine", reason: "3-month diabetes follow-up (A1c recheck)" },
    { id: "ap-r6", patientId: R, start: "2026-11-05T13:00:00", status: "booked", clinician: "Dr. Omar Haddad", specialty: "Ophthalmology", location: "Clearview Eye Care", reason: "Diabetic eye exam" },
  ],
  encounters: [
    {
      id: "en-r1", patientId: R, date: "2026-07-30", type: "office", clinician: RAMAN, specialty: "Endocrinology", organization: "Mesa Valley Endocrine",
      reason: "New diagnosis — type 2 diabetes",
      summary: "A1c 8.1% and fasting glucose 156 confirm type 2 diabetes. Start metformin 500 mg twice daily with meals; stomach upset usually eases in 2–3 weeks. Referred to diabetes education and nutrition. Recheck A1c in 3 months.",
      diagnoses: ["Type 2 diabetes mellitus"], documentId: "doc-r1",
    },
    {
      id: "en-r2", patientId: R, date: "2026-08-03", type: "office", clinician: "Hannah Cole, RN, CDCES", specialty: "Diabetes education", organization: "Mesa Valley Endocrine",
      reason: "Starting metformin; meter training",
      summary: "Taught glucose meter use and signs of high and low blood sugar. Reviewed taking metformin with food. Rosa feels overwhelmed by the diagnosis; encouraged small steps.",
      diagnoses: ["Type 2 diabetes mellitus"],
    },
    {
      id: "en-r3", patientId: R, date: "2026-08-19", type: "office", clinician: "Sofía Márquez, RDN", specialty: "Nutrition", organization: "Mesa Valley Endocrine",
      reason: "Meal planning for diabetes",
      summary: "Reviewed a typical day. Afternoon pan dulce with sweetened coffee most days. Suggested swapping to fruit with nuts or a smaller portion, keeping traditional dishes with more vegetables and measured tortillas. Alcohol occasionally on weekends — discussed limits with metformin.",
      diagnoses: ["Type 2 diabetes mellitus"], documentId: "doc-r2",
    },
  ],
  labPanels: [
    panel("lp-r-a1c-2506", R, "Hemoglobin A1c", "4548-4", "2025-06-20", BELL),
    panel("lp-r-lipid-2506", R, "Lipid panel", "57698-3", "2025-06-20", BELL),
    panel("lp-r-tsh-2506", R, "TSH", "3016-3", "2025-06-20", BELL),
    panel("lp-r-cmp-2506", R, "Comprehensive metabolic panel", "24323-8", "2025-06-20", BELL),
    panel("lp-r-a1c-2607", R, "Hemoglobin A1c", "4548-4", "2026-07-30", RAMAN),
    panel("lp-r-cmp-2607", R, "Comprehensive metabolic panel", "24323-8", "2026-07-30", RAMAN),
    panel("lp-r-lipid-2607", R, "Lipid panel", "57698-3", "2026-07-30", RAMAN),
    panel("lp-r-tsh-2607", R, "TSH", "3016-3", "2026-07-30", RAMAN),
  ],
  immunizations: [
    { id: "im-r1", patientId: R, vaccine: "Influenza (flu), 2025–26 season", date: "2025-10-15", cvxCode: "197", performer: "Mesa Pharmacy" },
    { id: "im-r2", patientId: R, vaccine: "COVID-19, 2025–26 formula", date: "2025-10-15", cvxCode: "309", performer: "Mesa Pharmacy" },
    { id: "im-r3", patientId: R, vaccine: "Shingles (recombinant zoster)", date: "2026-03-04", cvxCode: "187", doseNote: "Dose 1 of 2 — second dose due", performer: "Mesa Pharmacy" },
    { id: "im-r4", patientId: R, vaccine: "Tdap", date: "2019-10-04", cvxCode: "115", performer: BELL },
  ],
  procedures: [
    { id: "pr-r1", patientId: R, name: "Screening mammogram", date: "2026-04-09", code: "241055006", performer: "Mesa Imaging", outcome: "No findings of concern." },
    { id: "pr-r2", patientId: R, name: "Thyroid ultrasound", date: "2011-02-10", code: "169230002", performer: "Mesa Imaging", outcome: "Diffusely enlarged thyroid consistent with Hashimoto's." },
  ],
  careTeam: [
    { id: "ct-r1", patientId: R, name: RAMAN, role: "specialist", specialty: "Endocrinology", organization: "Mesa Valley Endocrine", phone: "(555) 030-5500", isPrimary: true },
    { id: "ct-r2", patientId: R, name: BELL, role: "primary-care", specialty: "Family Medicine", organization: "Mesa Family Practice", phone: "(555) 030-1100" },
    { id: "ct-r3", patientId: R, name: "Sofía Márquez, RDN", role: "dietitian", specialty: "Nutrition", organization: "Mesa Valley Endocrine" },
    { id: "ct-r4", patientId: R, name: "Hannah Cole, RN, CDCES", role: "nurse", specialty: "Diabetes education", organization: "Mesa Valley Endocrine", phone: "(555) 030-5520" },
    { id: "ct-r5", patientId: R, name: "Luis Delgado", role: "caregiver", specialty: "Husband", phone: "(555) 030-8870" },
  ],
  carePlans: [
    {
      id: "cp-r1", patientId: R, title: "Starting diabetes care", category: "medication", author: RAMAN, date: "2026-07-30", status: "active",
      instructions: ["Metformin 500 mg twice daily with breakfast and dinner.", "Check fasting blood sugar 3 mornings a week and bring the log.", "A1c recheck in 3 months."],
    },
    {
      id: "cp-r2", patientId: R, title: "Meal plan", category: "nutrition", author: "Sofía Márquez, RDN", date: "2026-08-19", status: "active",
      instructions: ["Swap afternoon pan dulce for fruit with a handful of nuts most days.", "Half the plate vegetables at lunch and dinner.", "Limit alcohol to special occasions while starting metformin."],
    },
  ],
  documents: [
    {
      id: "doc-r1", patientId: R, title: "Endocrinology — new diagnosis", type: "visit-summary", date: "2026-07-30", author: RAMAN, organization: "Mesa Valley Endocrine",
      text: "ENDOCRINOLOGY CONSULT\nA1c 8.1%, fasting glucose 156 mg/dL → type 2 diabetes.\nStart metformin 500 mg PO BID with meals.\nRefer: diabetes education, nutrition.\nRecheck A1c in 3 months.",
    },
    {
      id: "doc-r2", patientId: R, title: "Nutrition visit — meal planning", type: "dietitian-note", date: "2026-08-19", author: "Sofía Márquez, RDN", organization: "Mesa Valley Endocrine",
      text: "NUTRITION NOTE\nNewly diagnosed T2DM. Afternoon sweet bread + sweetened coffee most days.\nPlan: fruit + nuts swap, plate method, measured tortillas, limit alcohol with metformin.\nFollow-up in 4 weeks.",
    },
  ],
  assessments: [
    screening("as-r1", R, "PHQ-9", "2026-07-30", 8, "clinician"),
    screening("as-r2", R, "GAD-7", "2026-07-30", 9, "clinician"),
    screening("as-r3", R, "PHQ-9", "2026-09-05", 4, "self"),
    screening("as-r4", R, "GAD-7", "2026-09-05", 5, "self"),
  ],
  socialHistory: [
    { id: "sh-r1", patientId: R, category: "tobacco", value: "Never smoked", date: "2026-07-30", code: "72166-2" },
    { id: "sh-r2", patientId: R, category: "alcohol", value: "Occasional beer or wine on weekends", date: "2026-07-30", code: "11331-6" },
  ],
  nutritionProfile: {
    id: `np-${R}`, patientId: R, dietaryPattern: "Traditional Mexican home cooking; learning carbohydrate awareness",
    restrictions: ["Limit sugary drinks and sweet bread", "Alcohol only on special occasions"],
    intolerances: [],
    goals: ["Log meals every day, even briefly", "Fruit and nuts instead of pan dulce most afternoons"],
    dietitianNotes: [{ date: "2026-08-19", author: "Sofía Márquez, RDN", note: "Keep the dishes she loves — adjust portions and add vegetables." }],
    updatedAt: "2026-08-19T15:00:00",
  },
  emergency: {
    id: `em-${R}`, patientId: R, bloodType: "B+",
    contacts: [{ name: "Luis Delgado", relationship: "Husband", phone: "(555) 030-8870" }],
    criticalAllergies: ["Amoxicillin / penicillin — rash and hives"],
    criticalConditions: ["Type 2 diabetes", "Hypothyroidism"],
    updatedAt: "2026-08-03T12:00:00",
  },
};

const SEED: Record<PatientId, SeedPassport> = { [H]: harold, [M]: margaret, [R]: rosa };

/** The seed Passport sections for one persona, stamped with "Sample data" provenance. */
export function passportSeedFor(patientId: PatientId): PassportSeed | undefined {
  const s = SEED[patientId];
  if (!s) return undefined;
  return {
    allergies: seededAll<Allergy>(s.allergies),
    appointments: seededAll<Appointment>(s.appointments),
    encounters: seededAll<Encounter>(s.encounters),
    labPanels: seededAll<LabPanel>(s.labPanels),
    immunizations: seededAll<Immunization>(s.immunizations),
    procedures: seededAll<Procedure>(s.procedures),
    careTeam: seededAll<CareTeamMember>(s.careTeam),
    carePlans: seededAll<CarePlan>(s.carePlans),
    documents: seededAll<HealthDocument>(s.documents),
    assessments: seededAll<MentalHealthAssessment>(s.assessments),
    socialHistory: seededAll<SocialHistoryItem>(s.socialHistory),
    nutritionProfile: seeded<NutritionProfile>(s.nutritionProfile),
    emergency: seeded<EmergencyInfo>(s.emergency),
  };
}
