#!/usr/bin/env node
/**
 * Generates SYNTHETIC FHIR R4 Bundles — one per demo persona — shaped like a
 * Patient/$everything response from an Epic (MyChart) health system.
 * No real people, no real records.
 *
 * Each bundle mirrors much of what the persona's Passport already holds
 * (so the importer has to de-duplicate), plus new items and deliberate
 * gaps / conflicts for the reconciliation demo:
 *
 *   Harold   – Aspirin 81 mg MISSING (cardiology advised it over the counter);
 *              Metoprolol succinate DOSE DIFFERS (Epic 25 mg vs Passport 50 mg);
 *              Omeprazole marked STOPPED in Epic while still on the Passport
 *   Margaret – Diphenhydramine MISSING (over the counter);
 *              Furosemide DOSE DIFFERS (Epic 20 mg vs 40 mg);
 *              NEW Potassium chloride prescription
 *   Rosa     – Levothyroxine MISSING (prescribed by a PCP outside Epic);
 *              Metformin FREQUENCY DIFFERS (Epic once daily vs twice daily)
 *
 * Usage: node scripts/generate-fhir-bundles.mjs
 * Output: src/lib/fhir/bundles/<patient-id>.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "fhir", "bundles");
const S = {
  rxnorm: "http://www.nlm.nih.gov/research/umls/rxnorm",
  loinc: "http://loinc.org",
  snomed: "http://snomed.info/sct",
  icd10: "http://hl7.org/fhir/sid/icd-10-cm",
  cvx: "http://hl7.org/fhir/sid/cvx",
  ucum: "http://unitsofmeasure.org",
  obs: "http://terminology.hl7.org/CodeSystem/observation-category",
  cond: "http://terminology.hl7.org/CodeSystem/condition-clinical",
  allergy: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  act: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
};

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const cc = (system, code, display, text) => ({ coding: [{ system, code, display }], text: text ?? display });

function builder(prefix, patientRef) {
  const resources = [];
  let n = 0;
  const id = (type) => `${prefix}-${type}-${++n}`;
  const add = (r) => (resources.push(r), r);
  const pr = {};
  return {
    resources,
    practitioner(key, given, family, qual, phone) {
      const r = add({ resourceType: "Practitioner", id: id("prac"), name: [{ given: [given], family, prefix: qual === "MD" || qual === "DO" ? ["Dr."] : undefined, suffix: [qual] }], qualification: [{ code: { text: qual } }], telecom: phone ? [{ system: "phone", value: phone, use: "work" }] : undefined });
      pr[key] = { reference: `Practitioner/${r.id}`, display: `${given} ${family}, ${qual}` };
      return pr[key];
    },
    ref: (key) => pr[key],
    condition(icd, snomed, display, onset, status = "active") {
      return add({
        resourceType: "Condition", id: id("cond"),
        clinicalStatus: cc(S.cond, status, status === "active" ? "Active" : "Resolved"),
        category: [cc("http://terminology.hl7.org/CodeSystem/condition-category", "problem-list-item", "Problem List Item")],
        code: { coding: [{ system: S.icd10, code: icd, display }, { system: S.snomed, code: snomed, display }], text: display },
        subject: patientRef, onsetDateTime: onset, recordedDate: onset,
      });
    },
    med({ rxcui, display, dose, unit, frequency, period = 1, periodUnit = "d", text, authoredOn, requester, reason, asNeeded, status = "active" }) {
      return add({
        resourceType: "MedicationRequest", id: id("medrx"), status, intent: "order",
        medicationCodeableConcept: cc(S.rxnorm, rxcui, display), subject: patientRef, authoredOn, requester,
        reasonCode: reason ? [{ text: reason }] : undefined,
        dosageInstruction: [{ text, asNeededBoolean: asNeeded, timing: { repeat: { frequency, period, periodUnit } }, doseAndRate: [{ doseQuantity: { value: dose, unit, system: S.ucum, code: unit } }] }],
      });
    },
    allergy({ code, system = S.rxnorm, display, category, type = "allergy", criticality = "low", reaction, severity, recorded }) {
      return add({
        resourceType: "AllergyIntolerance", id: id("allergy"),
        clinicalStatus: cc(S.allergy, "active", "Active"), type, category: [category], criticality,
        code: code ? cc(system, code, display) : { text: display }, patient: patientRef, recordedDate: recorded,
        reaction: [{ manifestation: [{ text: reaction }], severity }],
      });
    },
    lab(loinc, display, value, unit, date, low, high, interp) {
      return add({
        resourceType: "Observation", id: id("lab"), status: "final",
        category: [cc(S.obs, "laboratory", "Laboratory")], code: cc(S.loinc, loinc, display), subject: patientRef,
        effectiveDateTime: `${date}T08:00:00Z`, valueQuantity: { value, unit, system: S.ucum, code: unit },
        interpretation: interp ? [cc("http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", interp, interp === "H" ? "High" : interp === "L" ? "Low" : "Normal")] : undefined,
        referenceRange: [{ low: low !== undefined ? { value: low, unit } : undefined, high: high !== undefined ? { value: high, unit } : undefined }],
      });
    },
    report(loinc, display, date, results, performer, interpreter) {
      return add({
        resourceType: "DiagnosticReport", id: id("report"), status: "final",
        category: [cc("http://terminology.hl7.org/CodeSystem/v2-0074", "LAB", "Laboratory")], code: cc(S.loinc, loinc, display),
        subject: patientRef, effectiveDateTime: `${date}T08:00:00Z`, performer: [{ display: performer }], resultsInterpreter: interpreter ? [interpreter] : undefined,
        result: results.map((r) => ({ reference: `Observation/${r.id}` })),
      });
    },
    vitals(date, sys, dia, hr, weightKg) {
      const out = [];
      if (sys) out.push(add({ resourceType: "Observation", id: id("bp"), status: "final", category: [cc(S.obs, "vital-signs", "Vital Signs")], code: cc(S.loinc, "85354-9", "Blood pressure panel"), subject: patientRef, effectiveDateTime: date,
        component: [{ code: cc(S.loinc, "8480-6", "Systolic blood pressure"), valueQuantity: { value: sys, unit: "mm[Hg]" } }, { code: cc(S.loinc, "8462-4", "Diastolic blood pressure"), valueQuantity: { value: dia, unit: "mm[Hg]" } }] }));
      if (hr) out.push(add({ resourceType: "Observation", id: id("hr"), status: "final", category: [cc(S.obs, "vital-signs", "Vital Signs")], code: cc(S.loinc, "8867-4", "Heart rate"), subject: patientRef, effectiveDateTime: date, valueQuantity: { value: hr, unit: "/min" } }));
      if (weightKg) out.push(add({ resourceType: "Observation", id: id("wt"), status: "final", category: [cc(S.obs, "vital-signs", "Vital Signs")], code: cc(S.loinc, "29463-7", "Body weight"), subject: patientRef, effectiveDateTime: date, valueQuantity: { value: weightKg, unit: "kg" } }));
      return out;
    },
    social(loinc, display, date, valueText, snomed) {
      return add({ resourceType: "Observation", id: id("social"), status: "final", category: [cc(S.obs, "social-history", "Social History")], code: cc(S.loinc, loinc, display), subject: patientRef, effectiveDateTime: date,
        valueCodeableConcept: snomed ? cc(S.snomed, snomed, valueText) : { text: valueText } });
    },
    screening(loinc, display, date, score) {
      return add({ resourceType: "Observation", id: id("survey"), status: "final", category: [cc(S.obs, "survey", "Survey")], code: cc(S.loinc, loinc, display), subject: patientRef, effectiveDateTime: `${date}T10:00:00Z`, valueQuantity: { value: score, unit: "{score}" } });
    },
    encounter({ date, type, specialty, practitioner, reason, org, cls = "AMB" }) {
      return add({ resourceType: "Encounter", id: id("enc"), status: "finished", class: { system: S.act, code: cls, display: cls === "VR" ? "virtual" : "ambulatory" },
        type: [{ text: type }], serviceType: { text: specialty }, subject: patientRef, participant: [{ individual: practitioner }],
        period: { start: `${date}T09:00:00Z`, end: `${date}T09:40:00Z` }, reasonCode: [{ text: reason }], serviceProvider: { display: org } });
    },
    note({ date, loinc, typeDisplay, title, author, org, encounter, text }) {
      return add({ resourceType: "DocumentReference", id: id("doc"), status: "current", type: cc(S.loinc, loinc, typeDisplay), category: [{ text: "Clinical Note" }], subject: patientRef,
        date: `${date}T12:00:00Z`, author: [author], custodian: { display: org }, description: title,
        content: [{ attachment: { contentType: "text/plain", title, data: b64(text) } }], context: encounter ? { encounter: [{ reference: `Encounter/${encounter.id}` }] } : undefined });
    },
    appointment({ start, status, practitioner, specialty, reason, location }) {
      return add({ resourceType: "Appointment", id: id("appt"), status, specialty: [{ text: specialty }], reasonCode: [{ text: reason }], description: reason, start,
        participant: [{ actor: patientRef, status: "accepted" }, { actor: practitioner, status: "accepted" }, ...(location ? [{ actor: { display: location }, status: "accepted" }] : [])] });
    },
    immunization(cvx, display, date, performer, dose, series) {
      return add({ resourceType: "Immunization", id: id("imm"), status: "completed", vaccineCode: cc(S.cvx, cvx, display), patient: patientRef, occurrenceDateTime: date, performer: [{ actor: { display: performer } }],
        protocolApplied: dose ? [{ doseNumberPositiveInt: dose, seriesDosesPositiveInt: series }] : undefined });
    },
    procedure(snomed, display, date, performer, outcome) {
      return add({ resourceType: "Procedure", id: id("proc"), status: "completed", code: cc(S.snomed, snomed, display), subject: patientRef, performedDateTime: date, performer: [{ actor: performer }], outcome: { text: outcome } });
    },
    careTeam(org, members) {
      return add({ resourceType: "CareTeam", id: id("careteam"), status: "active", subject: patientRef, managingOrganization: [{ display: org }],
        participant: members.map(([role, member, onBehalfOf]) => ({ role: [{ text: role }], member, onBehalfOf: onBehalfOf ? { display: onBehalfOf } : undefined })) });
    },
    carePlan({ title, category, author, date, activities }) {
      return add({ resourceType: "CarePlan", id: id("careplan"), status: "active", intent: "plan", title, category: [{ text: category }], subject: patientRef, author, created: date, period: { start: date },
        activity: activities.map((d) => ({ detail: { description: d, status: "in-progress" } })) });
    },
  };
}

function bundle(pid, patient, resources, org) {
  return {
    resourceType: "Bundle", id: `everything-${pid}`, type: "searchset", timestamp: "2026-10-03T07:00:00Z",
    meta: { tag: [{ system: "https://parthiahealth.com/fhir/tags", code: "SYNTHETIC", display: `SYNTHETIC — simulated ${org} (Epic MyChart) export, no real patient` }] },
    entry: [patient, ...resources].map((r) => ({ fullUrl: `urn:uuid:${r.id}`, resource: r })),
  };
}

/* ======================================================================== */
function harold() {
  const pat = { resourceType: "Patient", id: "epic-harold", name: [{ use: "official", given: ["Harold"], family: "Okafor" }], gender: "male", birthDate: "1958-03-02", telecom: [{ system: "phone", value: "(555) 010-5501" }] };
  const ref = { reference: "Patient/epic-harold", display: "Harold Okafor" };
  const b = builder("h", ref);
  const nwosu = b.practitioner("nwosu", "Amara", "Nwosu", "MD", "(555) 010-2200");
  const cho = b.practitioner("cho", "Daniel", "Cho", "MD", "(555) 010-3300");
  const park = b.practitioner("park", "Linda", "Park", "PharmD", "(555) 010-3345");
  const brooks = b.practitioner("brooks", "Maya", "Brooks", "RDN");
  const adler = b.practitioner("adler", "Ruth", "Adler", "MD", "(555) 010-6600");
  const ORG = "Riverside Health";

  b.condition("I48.91", "49436004", "Atrial fibrillation", "2023-11-02");
  b.condition("I10", "38341003", "Essential hypertension", "2015-03-12");
  b.condition("E78.5", "55822004", "Hyperlipidemia", "2015-03-12");
  b.condition("E11.9", "44054006", "Type 2 diabetes mellitus without complications", "2019-06-20");
  b.condition("K21.9", "235595009", "Gastro-esophageal reflux disease", "2022-02-14"); // NEW

  b.med({ rxcui: "855332", display: "warfarin sodium 5 MG Oral Tablet", dose: 5, unit: "mg", frequency: 1, text: "Take 1 tablet (5 mg) by mouth every evening", authoredOn: "2023-11-10", requester: cho, reason: "Atrial fibrillation" });
  b.med({ rxcui: "617312", display: "atorvastatin 40 MG Oral Tablet", dose: 40, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily", authoredOn: "2015-04-01", requester: nwosu, reason: "Hyperlipidemia" });
  // CONFLICT: Epic still lists the old 25 mg dose
  b.med({ rxcui: "866427", display: "metoprolol succinate 25 MG Extended Release Oral Tablet", dose: 25, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily", authoredOn: "2023-11-10", requester: cho, reason: "Atrial fibrillation — rate control" });
  b.med({ rxcui: "314077", display: "lisinopril 20 MG Oral Tablet", dose: 20, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily", authoredOn: "2015-04-01", requester: nwosu, reason: "Hypertension" });
  b.med({ rxcui: "861004", display: "metformin hydrochloride 1000 MG Oral Tablet", dose: 1000, unit: "mg", frequency: 2, text: "Take 1 tablet by mouth twice daily with meals", authoredOn: "2019-07-01", requester: nwosu, reason: "Type 2 diabetes" });
  // POSSIBLY STOPPED: Epic marks omeprazole as stopped (reflux settled), but Harold still takes it.
  b.med({ rxcui: "198053", display: "omeprazole 20 MG Delayed Release Oral Capsule", dose: 20, unit: "mg", frequency: 1, text: "Take 1 capsule by mouth daily before breakfast", authoredOn: "2022-02-14", requester: nwosu, reason: "GERD", status: "stopped" });
  // GAP: aspirin 81 mg is not in Epic (recommended over the counter at the cardiology visit)

  b.allergy({ code: "5640", display: "Ibuprofen", category: "medication", criticality: "high", reaction: "Gastrointestinal hemorrhage", severity: "severe", recorded: "2018-05-03" });
  b.allergy({ code: "70618", display: "Penicillin", category: "medication", reaction: "Urticaria (hives)", severity: "moderate", recorded: "1994-01-01" });

  // Labs: existing + NEW hemoglobin and creatinine
  const cmp = [b.lab("98979-8", "Glomerular filtration rate/1.73 sq M.predicted (CKD-EPI 2021)", 64, "mL/min/{1.73_m2}", "2026-08-15", 60, undefined), b.lab("2823-3", "Potassium [Moles/volume] in Serum or Plasma", 4.6, "mmol/L", "2026-08-15", 3.5, 5.1), b.lab("2160-0", "Creatinine [Mass/volume] in Serum or Plasma", 1.2, "mg/dL", "2026-08-15", 0.7, 1.3)];
  b.report("24323-8", "Comprehensive metabolic panel", "2026-08-15", cmp, "Quest Diagnostics", nwosu);
  b.report("4548-4", "Hemoglobin A1c", "2026-08-15", [b.lab("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 6.9, "%", "2026-08-15", undefined, 7.0)], "Quest Diagnostics", nwosu);
  b.report("57698-3", "Lipid panel", "2026-08-15", [b.lab("13457-7", "Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation", 88, "mg/dL", "2026-08-15", undefined, 100)], "Quest Diagnostics", nwosu);
  b.report("34714-6", "Prothrombin time / INR", "2026-08-21", [b.lab("6301-6", "INR in Platelet poor plasma by Coagulation assay", 3.1, "{INR}", "2026-08-21", 2.0, 3.0, "H")], "Riverside Heart Center lab", cho);
  b.report("34714-6", "Prothrombin time / INR", "2026-09-04", [b.lab("6301-6", "INR in Platelet poor plasma by Coagulation assay", 3.4, "{INR}", "2026-09-04", 2.0, 3.0, "H")], "Riverside Heart Center lab", park);
  b.report("58410-2", "Complete blood count", "2026-09-04", [b.lab("718-7", "Hemoglobin [Mass/volume] in Blood", 13.1, "g/dL", "2026-09-04", 13.5, 17.5, "L")], "Riverside Heart Center lab", park);

  b.vitals("2026-08-20T10:30:00Z", 136, 84, 71, 89.3);
  b.vitals("2026-08-15T09:05:00Z", 138, 86, 72, 89.5); // NEW clinic reading
  b.social("72166-2", "Tobacco smoking status", "2026-08-15", "Former smoker", "8517006");
  b.social("11331-6", "History of alcohol use", "2026-08-15", "A glass of wine with dinner on weekends");
  b.screening("44261-6", "Patient Health Questionnaire 9 item (PHQ-9) total score", "2026-08-15", 3);
  b.screening("70274-6", "Generalized anxiety disorder 7 item (GAD-7) total score", "2026-08-15", 4);

  const e1 = b.encounter({ date: "2026-06-10", type: "Office visit", specialty: "Nutrition", practitioner: brooks, reason: "Diet review while on warfarin", org: ORG });
  b.encounter({ date: "2026-08-15", type: "Office visit", specialty: "Internal Medicine", practitioner: nwosu, reason: "Diabetes and blood pressure follow-up", org: ORG });
  const e3 = b.encounter({ date: "2026-08-20", type: "Office visit", specialty: "Cardiology", practitioner: cho, reason: "Atrial fibrillation follow-up", org: ORG });
  const e4 = b.encounter({ date: "2026-09-04", type: "Anticoagulation clinic visit", specialty: "Anticoagulation clinic", practitioner: park, reason: "INR check", org: ORG });
  const e5 = b.encounter({ date: "2026-07-10", type: "Anticoagulation clinic visit", specialty: "Anticoagulation clinic", practitioner: park, reason: "INR check", org: ORG }); // NEW

  b.note({ date: "2026-06-10", loinc: "34765-3", typeDisplay: "Nutrition and dietetics Note", title: "Nutrition visit — diet and warfarin", author: brooks, org: ORG, encounter: e1,
    text: "NUTRITION NOTE\nReason: diet review while on warfarin.\nAssessment: intermittent high intake of leafy greens (kale, spinach) alternating with weeks of none.\nPlan: consistent vitamin K intake, 3–4 servings of leafy greens per week spread evenly; keep a simple food log; bring log to INR visits." });
  b.note({ date: "2026-08-20", loinc: "11506-3", typeDisplay: "Progress note", title: "Cardiology visit summary", author: cho, org: ORG, encounter: e3,
    text: "CARDIOLOGY FOLLOW-UP\nAtrial fibrillation, rate controlled on metoprolol succinate.\nRecommend aspirin 81 mg daily (over the counter).\nContinue warfarin 5 mg daily, INR goal 2.0–3.0.\nReturn in 3 months." });
  b.note({ date: "2026-09-04", loinc: "11506-3", typeDisplay: "Progress note", title: "Anticoagulation clinic note", author: park, org: ORG, encounter: e4,
    text: "ANTICOAGULATION CLINIC\nINR 3.4 (goal 2.0–3.0). Hgb 13.1 (slightly low).\nReports bruising on forearms and one brief nosebleed since aspirin was added.\nNo warfarin dose change today; recheck INR and CBC in 2 weeks.\nReviewed bleeding precautions and consistent vitamin K intake." });
  b.note({ date: "2026-07-10", loinc: "11506-3", typeDisplay: "Progress note", title: "Anticoagulation clinic note", author: park, org: ORG, encounter: e5,
    text: "ANTICOAGULATION CLINIC\nINR 2.4, in range. Continue warfarin 5 mg daily. Recheck in 2 weeks." });

  b.appointment({ start: "2026-10-10T08:30:00", status: "booked", practitioner: park, specialty: "Anticoagulation clinic", reason: "INR recheck", location: "Riverside Heart Center" });
  b.appointment({ start: "2026-10-10T08:15:00", status: "booked", practitioner: park, specialty: "Laboratory", reason: "CBC recheck (lab draw before INR visit)", location: "Riverside Heart Center lab" }); // NEW
  b.appointment({ start: "2026-10-24T09:15:00", status: "booked", practitioner: nwosu, specialty: "Internal Medicine", reason: "Follow-up: bruising, INR, new aspirin", location: "Riverside Health — Primary Care" });
  b.appointment({ start: "2026-11-12T11:00:00", status: "booked", practitioner: cho, specialty: "Cardiology", reason: "Cardiology follow-up", location: "Riverside Heart Center" });

  b.immunization("197", "Influenza, high-dose, quadrivalent, preservative free", "2025-10-08", "Riverside Pharmacy");
  b.immunization("309", "COVID-19, mRNA, 2025–2026 formula", "2025-10-08", "Riverside Pharmacy");
  b.immunization("216", "Pneumococcal conjugate PCV 20", "2024-01-15", "Dr. Amara Nwosu");
  b.immunization("187", "Zoster recombinant", "2023-05-02", "Riverside Pharmacy", 2, 2);
  b.procedure("40701008", "Echocardiography", "2023-11-05", cho, "Normal pumping function; mildly enlarged left atrium.");
  b.procedure("73761001", "Colonoscopy", "2022-03-10", adler, "One small polyp removed; repeat in 5 years.");

  b.careTeam(ORG, [["Primary care physician", nwosu], ["Cardiologist", cho], ["Anticoagulation pharmacist", park], ["Dietitian", brooks], ["Gastroenterologist", adler]]);
  b.carePlan({ title: "Warfarin monitoring", category: "Monitoring", author: park, date: "2026-09-04", activities: ["INR goal 2.0–3.0.", "INR check every two weeks until two results in range.", "Call the clinic for unusual bruising, blood in urine or stool, or a nosebleed that won't stop."] });
  return bundle("p-harold", pat, b.resources, ORG);
}

/* ======================================================================== */
function margaret() {
  const pat = { resourceType: "Patient", id: "epic-margaret", name: [{ use: "official", given: ["Margaret"], family: "Lindqvist" }], gender: "female", birthDate: "1954-06-19" };
  const ref = { reference: "Patient/epic-margaret", display: "Margaret Lindqvist" };
  const b = builder("m", ref);
  const reyes = b.practitioner("reyes", "Samuel", "Reyes", "MD", "(555) 020-1100");
  const grant = b.practitioner("grant", "Olivia", "Grant", "MD", "(555) 020-3300");
  const petrov = b.practitioner("petrov", "Nadia", "Petrov", "MD", "(555) 020-4400");
  const moreau = b.practitioner("moreau", "Lena", "Moreau", "PsyD", "(555) 020-4410");
  const ruiz = b.practitioner("ruiz", "Carmen", "Ruiz", "RDN");
  const ORG = "Lakeside Medical";

  b.condition("I50.32", "446221000", "Chronic diastolic (congestive) heart failure", "2021-09-08");
  b.condition("E11.9", "44054006", "Type 2 diabetes mellitus without complications", "2012-01-17");
  b.condition("I10", "38341003", "Essential hypertension", "2008-05-22");
  b.condition("F33.1", "66344007", "Major depressive disorder, recurrent, moderate", "2020-02-03");
  b.condition("G47.00", "193462001", "Insomnia, unspecified", "2022-10-11");
  b.condition("N32.81", "412714001", "Overactive bladder", "2024-04-30");
  b.condition("N18.31", "700378005", "Chronic kidney disease, stage 3a", "2026-08-28"); // NEW

  b.med({ rxcui: "861007", display: "metformin hydrochloride 500 MG Oral Tablet", dose: 500, unit: "mg", frequency: 2, text: "Take 1 tablet by mouth twice daily with meals", authoredOn: "2012-02-01", requester: reyes, reason: "Type 2 diabetes" });
  b.med({ rxcui: "310490", display: "glipizide 5 MG Oral Tablet", dose: 5, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily with breakfast", authoredOn: "2018-08-10", requester: reyes, reason: "Type 2 diabetes" });
  b.med({ rxcui: "197361", display: "amlodipine 5 MG Oral Tablet", dose: 5, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily", authoredOn: "2008-06-01", requester: reyes, reason: "Hypertension" });
  // CONFLICT: Epic has 20 mg; the patient takes 40 mg
  b.med({ rxcui: "310429", display: "furosemide 20 MG Oral Tablet", dose: 20, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth every morning", authoredOn: "2021-09-20", requester: grant, reason: "Heart failure" });
  b.med({ rxcui: "200033", display: "carvedilol 12.5 MG Oral Tablet", dose: 12.5, unit: "mg", frequency: 2, text: "Take 1 tablet by mouth twice daily with food", authoredOn: "2021-09-20", requester: grant, reason: "Heart failure" });
  b.med({ rxcui: "312941", display: "sertraline 100 MG Oral Tablet", dose: 100, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily", authoredOn: "2026-08-22", requester: petrov, reason: "Depression" });
  b.med({ rxcui: "854873", display: "zolpidem tartrate 5 MG Oral Tablet", dose: 5, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth at bedtime", authoredOn: "2022-10-20", requester: reyes, reason: "Insomnia" });
  b.med({ rxcui: "863619", display: "oxybutynin chloride 5 MG Oral Tablet", dose: 5, unit: "mg", frequency: 2, text: "Take 1 tablet by mouth twice daily", authoredOn: "2024-05-06", requester: reyes, reason: "Overactive bladder" });
  // NEW: potassium chloride after potassium 3.4
  b.med({ rxcui: "628958", display: "potassium chloride 10 MEQ Extended Release Oral Tablet", dose: 10, unit: "mEq", frequency: 1, text: "Take 1 tablet by mouth daily with food", authoredOn: "2026-08-29", requester: reyes, reason: "Low potassium" });
  // GAP: diphenhydramine (over the counter) is not in Epic

  b.allergy({ code: "2670", display: "Codeine", category: "medication", type: "intolerance", reaction: "Nausea and vomiting", severity: "moderate", recorded: "2019-03-14" });
  b.allergy({ system: "http://snomed.info/sct", code: "44027008", display: "Seafood (shellfish)", category: "food", reaction: "Swelling of lips", severity: "moderate", recorded: "2004-07-01" });
  b.allergy({ system: "http://snomed.info/sct", code: "111088007", display: "Latex", category: "environment", reaction: "Contact dermatitis", severity: "mild", recorded: "2017-03-22" }); // NEW

  const bmp = [b.lab("98979-8", "Glomerular filtration rate/1.73 sq M.predicted (CKD-EPI 2021)", 52, "mL/min/{1.73_m2}", "2026-08-28", 60, undefined, "L"), b.lab("2823-3", "Potassium [Moles/volume] in Serum or Plasma", 3.4, "mmol/L", "2026-08-28", 3.5, 5.1, "L"), b.lab("2951-2", "Sodium [Moles/volume] in Serum or Plasma", 134, "mmol/L", "2026-08-28", 135, 145, "L"), b.lab("2160-0", "Creatinine [Mass/volume] in Serum or Plasma", 1.1, "mg/dL", "2026-08-28", 0.5, 1.0, "H")];
  b.report("51990-0", "Basic metabolic panel", "2026-08-28", bmp, "Quest Diagnostics", reyes);
  b.report("4548-4", "Hemoglobin A1c", "2026-08-28", [b.lab("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 7.8, "%", "2026-08-28", undefined, 7.0, "H")], "Quest Diagnostics", reyes);
  b.report("33762-6", "NT-proBNP", "2026-08-28", [b.lab("33762-6", "Natriuretic peptide.B prohormone N-Terminal [Mass/volume] in Serum or Plasma", 410, "pg/mL", "2026-08-28", undefined, 300, "H")], "Quest Diagnostics", grant);

  b.vitals("2026-08-28T09:20:00Z", 124, 74, 65, 70.8);
  b.vitals("2026-07-10T10:05:00Z", 128, 76, 67, 70.4); // NEW
  b.social("72166-2", "Tobacco smoking status", "2026-08-28", "Never smoker", "266919005");
  b.screening("44261-6", "Patient Health Questionnaire 9 item (PHQ-9) total score", "2026-08-22", 7);
  b.screening("44261-6", "Patient Health Questionnaire 9 item (PHQ-9) total score", "2026-09-02", 12);
  b.screening("70274-6", "Generalized anxiety disorder 7 item (GAD-7) total score", "2026-09-02", 8);

  const e1 = b.encounter({ date: "2026-05-14", type: "Office visit", specialty: "Nutrition", practitioner: ruiz, reason: "Heart failure and diabetes diet", org: ORG });
  b.encounter({ date: "2026-07-10", type: "Office visit", specialty: "Cardiology", practitioner: grant, reason: "Heart failure follow-up", org: ORG });
  const e3 = b.encounter({ date: "2026-08-22", type: "Office visit", specialty: "Psychiatry", practitioner: petrov, reason: "Medication review — depression", org: ORG });
  b.encounter({ date: "2026-08-28", type: "Office visit", specialty: "Family Medicine", practitioner: reyes, reason: "Labs and diabetes check", org: ORG });
  const e5 = b.encounter({ date: "2026-09-02", type: "Psychotherapy session", specialty: "Psychology", practitioner: moreau, reason: "Therapy session", org: ORG });
  const e6 = b.encounter({ date: "2026-09-09", type: "Telephone encounter", specialty: "Psychiatry", practitioner: petrov, reason: "Phone check-in after dose change", org: ORG, cls: "VR" }); // NEW

  b.note({ date: "2026-05-14", loinc: "34765-3", typeDisplay: "Nutrition and dietetics Note", title: "Nutrition visit — heart failure diet", author: ruiz, org: ORG, encounter: e1,
    text: "NUTRITION NOTE\nDiagnoses: HFpEF, type 2 diabetes.\nSodium goal under 2 g/day; fluids 1.5–2 L/day.\nMain sodium sources: canned soup, deli meat, restaurant meals.\nCarbohydrate portions reviewed (plate method)." });
  b.note({ date: "2026-08-22", loinc: "11506-3", typeDisplay: "Progress note", title: "Psychiatry visit — medication review", author: petrov, org: ORG, encounter: e3,
    text: "PSYCHIATRY FOLLOW-UP\nPHQ-9: 7. Residual low mood, poor sleep.\nPlan: increase sertraline 50 mg → 100 mg daily. Continue therapy.\nFollow up in ~4 weeks; report worsening mood sooner." });
  b.note({ date: "2026-09-02", loinc: "34748-9", typeDisplay: "Mental health Note", title: "Therapy session note", author: moreau, org: ORG, encounter: e5,
    text: "BEHAVIORAL HEALTH NOTE\nLower energy and interest over two weeks, more time in bed.\nPHQ-9: 12 (moderate). GAD-7: 8 (mild). Denies thoughts of self-harm.\nIntervention: behavioral activation, small scheduled activities.\nPlan: continue weekly; patient to share changes with psychiatrist." });
  b.note({ date: "2026-09-09", loinc: "34748-9", typeDisplay: "Mental health Note", title: "Psychiatry phone check-in", author: petrov, org: ORG, encounter: e6,
    text: "BEHAVIORAL HEALTH — TELEPHONE\nPatient reports feeling more tired and 'foggy' since the sertraline increase; mood lower. Self-reported PHQ-9 16 via MyChart.\nDenies thoughts of self-harm. Taking an over-the-counter sleep aid some nights.\nPlan: keep 9/24 appointment; call sooner if worse. Bring all medicines including OTC to the visit." });

  b.appointment({ start: "2026-09-15T11:00:00", status: "booked", practitioner: moreau, specialty: "Psychology", reason: "Therapy session", location: "Lakeside Behavioral Health" });
  b.appointment({ start: "2026-09-19T08:00:00", status: "booked", practitioner: reyes, specialty: "Laboratory", reason: "Basic metabolic panel recheck (potassium)", location: "Lakeside Medical lab" }); // NEW
  b.appointment({ start: "2026-09-24T15:30:00", status: "booked", practitioner: petrov, specialty: "Psychiatry", reason: "Follow-up after sertraline dose change", location: "Lakeside Behavioral Health" });
  b.appointment({ start: "2026-10-06T09:00:00", status: "booked", practitioner: reyes, specialty: "Family Medicine", reason: "Diabetes and kidney function follow-up", location: "Lakeside Medical — Primary Care" });

  b.immunization("197", "Influenza, high-dose, quadrivalent, preservative free", "2025-10-02", "Lakeside Pharmacy");
  b.immunization("305", "RSV, bivalent, protein subunit RSVpreF", "2024-09-20", "Lakeside Pharmacy");
  b.procedure("40701008", "Echocardiography", "2021-09-06", grant, "Preserved ejection fraction (58%).");

  b.careTeam(ORG, [["Primary care physician", reyes], ["Cardiologist", grant], ["Psychiatrist", petrov], ["Psychologist", moreau], ["Dietitian", ruiz]]);
  b.carePlan({ title: "Heart failure self-care", category: "Monitoring", author: grant, date: "2026-07-10", activities: ["Weigh yourself every morning after using the bathroom.", "Call the clinic if weight is up 2 lb in a day or 5 lb in a week.", "Sodium under 2 g a day; fluids about 1.5–2 L."] });
  b.carePlan({ title: "Low potassium", category: "Medication", author: reyes, date: "2026-08-29", activities: ["Potassium chloride 10 mEq daily with food.", "Recheck potassium and kidney function on 9/19."] }); // NEW
  return bundle("p-margaret", pat, b.resources, ORG);
}

/* ======================================================================== */
function rosa() {
  const pat = { resourceType: "Patient", id: "epic-rosa", name: [{ use: "official", given: ["Rosa"], family: "Delgado" }], gender: "female", birthDate: "1961-01-27" };
  const ref = { reference: "Patient/epic-rosa", display: "Rosa Delgado" };
  const b = builder("r", ref);
  const raman = b.practitioner("raman", "Priya", "Raman", "MD", "(555) 030-5500");
  const cole = b.practitioner("cole", "Hannah", "Cole", "RN, CDCES", "(555) 030-5520");
  const marquez = b.practitioner("marquez", "Sofía", "Márquez", "RDN");
  const haddad = b.practitioner("haddad", "Omar", "Haddad", "MD");
  const ORG = "Mesa Valley Health";

  b.condition("E11.9", "44054006", "Type 2 diabetes mellitus without complications", "2026-07-30");
  b.condition("I10", "38341003", "Essential hypertension", "2019-10-04");
  b.condition("E78.5", "55822004", "Hyperlipidemia", "2019-10-04");
  b.condition("E03.9", "40930008", "Hypothyroidism, unspecified", "2011-02-18");
  b.condition("E55.9", "34713006", "Vitamin D deficiency", "2026-07-30"); // NEW

  // CONFLICT: Epic says once daily; the patient takes it twice daily
  b.med({ rxcui: "861007", display: "metformin hydrochloride 500 MG Oral Tablet", dose: 500, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily with dinner", authoredOn: "2026-07-30", requester: raman, reason: "Type 2 diabetes" });
  b.med({ rxcui: "314076", display: "lisinopril 10 MG Oral Tablet", dose: 10, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily (outside prescription, reconciled at intake)", authoredOn: "2019-10-20", requester: { display: "Marcus Bell, MD (outside provider)" }, reason: "Hypertension" });
  b.med({ rxcui: "310798", display: "hydrochlorothiazide 12.5 MG Oral Capsule", dose: 12.5, unit: "mg", frequency: 1, text: "Take 1 capsule by mouth daily (outside prescription, reconciled at intake)", authoredOn: "2021-03-08", requester: { display: "Marcus Bell, MD (outside provider)" }, reason: "Hypertension" });
  b.med({ rxcui: "859749", display: "rosuvastatin calcium 10 MG Oral Tablet", dose: 10, unit: "mg", frequency: 1, text: "Take 1 tablet by mouth daily (outside prescription, reconciled at intake)", authoredOn: "2019-10-20", requester: { display: "Marcus Bell, MD (outside provider)" }, reason: "Hyperlipidemia" });
  // GAP: levothyroxine (prescribed by her PCP outside Epic) is missing

  b.allergy({ code: "723", display: "Amoxicillin", category: "medication", reaction: "Rash and hives", severity: "moderate", recorded: "2009-11-20" });
  b.allergy({ system: "http://snomed.info/sct", code: "293637006", display: "Iodinated contrast media", category: "medication", reaction: "Hives", severity: "moderate", recorded: "2016-04-11" }); // NEW

  b.report("4548-4", "Hemoglobin A1c", "2026-07-30", [b.lab("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", 8.1, "%", "2026-07-30", undefined, 7.0, "H")], "Mesa Valley Lab", raman);
  b.report("24323-8", "Comprehensive metabolic panel", "2026-07-30", [b.lab("1558-6", "Fasting glucose [Mass/volume] in Serum or Plasma", 156, "mg/dL", "2026-07-30", 70, 100, "H"), b.lab("98979-8", "Glomerular filtration rate/1.73 sq M.predicted (CKD-EPI 2021)", 84, "mL/min/{1.73_m2}", "2026-07-30", 60, undefined)], "Mesa Valley Lab", raman);
  b.report("9318-7", "Urine albumin/creatinine ratio", "2026-07-30", [b.lab("9318-7", "Albumin/Creatinine [Mass Ratio] in Urine", 18, "mg/g", "2026-07-30", undefined, 30)], "Mesa Valley Lab", raman); // NEW
  b.report("1989-3", "Vitamin D, 25-hydroxy", "2026-07-30", [b.lab("1989-3", "25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma", 18, "ng/mL", "2026-07-30", 30, 100, "L")], "Mesa Valley Lab", raman); // NEW

  b.vitals("2026-07-30T10:15:00Z", 136, 82, 78, 81.0);
  b.social("72166-2", "Tobacco smoking status", "2026-07-30", "Never smoker", "266919005");
  b.social("11331-6", "History of alcohol use", "2026-07-30", "Occasional beer or wine on weekends");
  b.screening("44261-6", "Patient Health Questionnaire 9 item (PHQ-9) total score", "2026-07-30", 8);
  b.screening("70274-6", "Generalized anxiety disorder 7 item (GAD-7) total score", "2026-07-30", 9);

  const e1 = b.encounter({ date: "2026-07-30", type: "New patient visit", specialty: "Endocrinology", practitioner: raman, reason: "New diagnosis — type 2 diabetes", org: ORG });
  const e2 = b.encounter({ date: "2026-08-03", type: "Education visit", specialty: "Diabetes education", practitioner: cole, reason: "Starting metformin; meter training", org: ORG });
  const e3 = b.encounter({ date: "2026-08-19", type: "Office visit", specialty: "Nutrition", practitioner: marquez, reason: "Meal planning for diabetes", org: ORG });

  b.note({ date: "2026-07-30", loinc: "11506-3", typeDisplay: "Progress note", title: "Endocrinology — new diagnosis", author: raman, org: ORG, encounter: e1,
    text: "ENDOCRINOLOGY CONSULT\nA1c 8.1%, fasting glucose 156 mg/dL → type 2 diabetes.\nStart metformin 500 mg PO daily with dinner x1 week, then BID with meals.\nVitamin D 18 ng/mL — start vitamin D3 2,000 units daily (OTC).\nRefer: diabetes education, nutrition. Recheck A1c in 3 months." });
  b.note({ date: "2026-08-03", loinc: "11506-3", typeDisplay: "Progress note", title: "Diabetes education visit", author: cole, org: ORG, encounter: e2,
    text: "DIABETES EDUCATION\nMeter teaching completed; return demonstration good.\nReviewed hypo/hyperglycemia symptoms, taking metformin with food.\nPatient anxious about diagnosis — encouraged small steps, family involvement." }); // NEW
  b.note({ date: "2026-08-19", loinc: "34765-3", typeDisplay: "Nutrition and dietetics Note", title: "Nutrition visit — meal planning", author: marquez, org: ORG, encounter: e3,
    text: "NUTRITION NOTE\nNewly diagnosed T2DM. Afternoon sweet bread + sweetened coffee most days.\nPlan: fruit + nuts swap, plate method, measured tortillas, limit alcohol with metformin.\nFollow-up in 4 weeks." });

  b.appointment({ start: "2026-09-16T14:00:00", status: "booked", practitioner: marquez, specialty: "Nutrition", reason: "Meal planning follow-up", location: "Mesa Valley Endocrine" });
  b.appointment({ start: "2026-10-29T08:30:00", status: "booked", practitioner: raman, specialty: "Endocrinology", reason: "3-month diabetes follow-up (A1c recheck)", location: "Mesa Valley Endocrine" });
  b.appointment({ start: "2026-11-05T13:00:00", status: "booked", practitioner: haddad, specialty: "Ophthalmology", reason: "Diabetic eye exam", location: "Clearview Eye Care" });

  b.immunization("197", "Influenza, quadrivalent, preservative free", "2025-10-15", "Mesa Pharmacy");
  b.immunization("187", "Zoster recombinant", "2026-03-04", "Mesa Pharmacy", 1, 2);
  b.careTeam(ORG, [["Endocrinologist", raman], ["Diabetes educator", cole], ["Dietitian", marquez]]);
  b.carePlan({ title: "Starting diabetes care", category: "Medication", author: raman, date: "2026-07-30", activities: ["Metformin 500 mg daily with dinner for one week, then twice daily with meals.", "Check fasting blood sugar 3 mornings a week and bring the log.", "A1c recheck in 3 months."] });
  return bundle("p-rosa", pat, b.resources, ORG);
}

mkdirSync(OUT, { recursive: true });
for (const [pid, make] of [["p-harold", harold], ["p-margaret", margaret], ["p-rosa", rosa]]) {
  const bundleJson = make();
  writeFileSync(join(OUT, `${pid}.json`), JSON.stringify(bundleJson, null, 2) + "\n");
  console.log(`${pid}: ${bundleJson.entry.length} resources`);
}
