import type {
  Allergy,
  Appointment,
  CarePlan,
  CareTeamMember,
  CareTeamRole,
  Condition,
  ConditionCategory,
  DataSource,
  DocumentType,
  Encounter,
  EncounterType,
  HealthDocument,
  Immunization,
  LabPanel,
  LabResult,
  Medication,
  MentalHealthAssessment,
  PatientId,
  Procedure,
  SocialHistoryItem,
  VitalSign,
} from "../types";
import { allergyMatches } from "../log/entries";
import { severityBand } from "../screening";
import { interpretLab, lookupLab } from "../terminology/labs";
import { lookupDrug, lookupRxcui } from "../terminology/medications";
import {
  SYSTEMS,
  type Attachment,
  type CodeableConcept,
  type Dosage,
  type FhirAllergyIntolerance,
  type FhirAppointment,
  type FhirBundle,
  type FhirCarePlan,
  type FhirCareTeam,
  type FhirCondition,
  type FhirDiagnosticReport,
  type FhirDocumentReference,
  type FhirEncounter,
  type FhirImmunization,
  type FhirMedication,
  type FhirMedicationRequest,
  type FhirMedicationStatement,
  type FhirObservation,
  type FhirPatient,
  type FhirPractitioner,
  type FhirProcedure,
  type FhirResource,
  type Reference,
} from "./types";

/**
 * FHIR R4 → Patient Passport mapper.
 *
 * Converts a Bundle (e.g. a Patient/$everything response from an EHR) into
 * Passport items, using standard codes where present — RxNorm for
 * medications, ICD-10-CM and SNOMED CT for conditions, LOINC for labs, vitals,
 * screenings and note types, CVX for vaccines — and falling back to the
 * display text. Every item gets `kind: "ehr"` provenance pointing at its
 * source resource, and is left unverified for the patient to review.
 */

export interface MappedPassport {
  patient?: { name: string; birthDate?: string; gender?: string };
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  labs: LabResult[];
  labPanels: LabPanel[];
  vitals: VitalSign[];
  socialHistory: SocialHistoryItem[];
  assessments: MentalHealthAssessment[];
  encounters: Encounter[];
  documents: HealthDocument[];
  appointments: Appointment[];
  immunizations: Immunization[];
  procedures: Procedure[];
  careTeam: CareTeamMember[];
  carePlans: CarePlan[];
  /** Resources we saw but didn't map, and why. */
  warnings: string[];
}

export interface MapOptions {
  patientId: PatientId;
  /** Provenance label, e.g. "Epic MyChart (simulated)". */
  sourceLabel: string;
  importedAt: string;
}

/* ---- Small helpers ------------------------------------------------------- */

export function coding(cc: CodeableConcept | undefined, system: string) {
  return cc?.coding?.find((c) => c.system === system);
}

export function textOf(cc: CodeableConcept | undefined): string {
  return cc?.text ?? cc?.coding?.find((c) => c.display)?.display ?? "";
}

/** "2026-08-20T10:30:00Z" → "2026-08-20T10:30:00" (the demo treats times as local). */
function localDateTime(iso: string | undefined): string {
  return (iso ?? "").replace(/(\.\d+)?(Z|[+-]\d\d:\d\d)$/, "");
}

function dateOnly(iso: string | undefined): string {
  return (iso ?? "").slice(0, 10);
}

export function decodeBase64Utf8(data: string): string {
  const bin = atob(data);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const SALTS = /\b(sodium|hydrochloride|hcl|calcium|tartrate|maleate|besylate|mesylate|potassium(?! chloride))\b/gi;

/** "metoprolol succinate 25 MG Extended Release Oral Tablet" → "Metoprolol succinate" */
export function medicationNameFromDisplay(display: string): string {
  const normalized = display.replace(/^\d+\s*HR\s+/i, "");
  const beforeStrength = normalized.split(/\s\d/)[0].replace(SALTS, "").replace(/\s+/g, " ").trim();
  return beforeStrength.charAt(0).toUpperCase() + beforeStrength.slice(1);
}

const TIMES_A_DAY: Record<number, string> = { 1: "once daily", 2: "twice daily", 3: "three times daily", 4: "four times daily" };

export function frequencyText(d: Dosage | undefined): string {
  if (!d) return "as directed";
  const r = d.timing?.repeat;
  // Free-text only (e.g. a Passport export of "at bedtime"): keep it as written.
  if (!r) return `${d.text ?? "as directed"}${d.asNeededBoolean && !/as needed/i.test(d.text ?? "") ? " as needed" : ""}`;
  const text = (d.text ?? "").toLowerCase();
  let out: string;
  if (r?.frequency && (r.periodUnit ?? "d") === "d" && (r.period ?? 1) === 1) out = TIMES_A_DAY[r.frequency] ?? `${r.frequency} times daily`;
  else if (r?.periodUnit === "wk") out = r.frequency === 1 ? "once weekly" : `${r.frequency} times weekly`;
  else if (r?.periodUnit === "h" && r.period) out = `every ${r.period} hours`;
  else out = d.text ?? "as directed";
  if (/bedtime/.test(text)) out = out === "once daily" ? "at bedtime" : `${out} (bedtime)`;
  else if (/evening/.test(text)) out = `${out} (evening)`;
  else if (/morning/.test(text)) out = `${out} (morning)`;
  if (d.asNeededBoolean) out = `${out} as needed`;
  return out;
}

function practitionerName(p: FhirPractitioner | undefined, fallback?: string): string {
  const n = p?.name?.[0];
  if (!n) {
    // Display-only reference, e.g. "Marcus Bell, MD (outside provider)" → "Dr. Marcus Bell (outside provider)"
    const m = (fallback ?? "").match(/^(.*?),\s*(MD|DO)\b(.*)$/i);
    return m ? `Dr. ${m[1]}${m[3]}` : fallback ?? "";
  }
  const qual = p?.qualification?.[0]?.code.text ?? n.suffix?.[0];
  const core = [...(n.given ?? []), n.family].filter(Boolean).join(" ");
  if (qual && /^(MD|DO)$/i.test(qual)) return `Dr. ${core}`;
  return qual ? `${core}, ${qual}` : core;
}

/** ICD-10-CM chapter → our coarse category. */
export function conditionCategory(icd: string | undefined, name: string): ConditionCategory {
  const c = (icd ?? "").toUpperCase();
  if (c.startsWith("E11") || c.startsWith("E10") || /diabet/i.test(name)) return "diabetes";
  if (c.startsWith("I10") || c.startsWith("I11") || c.startsWith("I12") || c.startsWith("I13") || /hypertens/i.test(name)) return "hypertension";
  if (/^I\d/.test(c) || c.startsWith("E78") || /heart|cardi|atrial|lipid/i.test(name)) return "cardiovascular";
  if (c.startsWith("F") || c.startsWith("G47") || /depress|anxiety|insomnia/i.test(name)) return "mental-health";
  return "other";
}

const NOTE_TYPES: Record<string, DocumentType> = {
  "34117-2": "visit-summary",
  "51847-2": "visit-summary",
  "34765-3": "dietitian-note",
  "34748-9": "behavioral-health-note",
  "11488-4": "visit-summary",
  "11506-3": "visit-summary",
  "18842-5": "discharge-summary",
  "57133-1": "prescription",
  "11502-2": "lab-report",
};

function careTeamRole(roleText: string): { role: CareTeamRole; specialty: string; isPrimary?: boolean } {
  const r = roleText.toLowerCase();
  if (/primary care/.test(r)) return { role: "primary-care", specialty: "Primary care", isPrimary: true };
  if (/pharmac/.test(r)) return { role: "pharmacist", specialty: roleText };
  if (/dietitian|nutrition/.test(r)) return { role: "dietitian", specialty: "Nutrition" };
  if (/psychiatr/.test(r)) return { role: "psychiatrist", specialty: "Psychiatry" };
  if (/psycholog|therap/.test(r)) return { role: "psychologist", specialty: "Psychology" };
  if (/nurse|educator/.test(r)) return { role: "nurse", specialty: roleText };
  const specialty = roleText.replace(/ologist$/i, "ology").replace(/ist$/i, "y");
  return { role: "specialist", specialty };
}

/* ---- The mapper ----------------------------------------------------------- */

export function mapBundle(bundle: FhirBundle, opts: MapOptions): MappedPassport {
  const out: MappedPassport = {
    conditions: [], medications: [], allergies: [], labs: [], labPanels: [], vitals: [], socialHistory: [], assessments: [],
    encounters: [], documents: [], appointments: [], immunizations: [], procedures: [], careTeam: [], carePlans: [], warnings: [],
  };
  const entries = bundle.entry ?? [];
  const resources = entries.map((e) => e.resource) as FhirResource[];
  // Transaction bundles (including Synthea's) frequently use urn:uuid fullUrls
  // everywhere instead of relative ResourceType/id references. Index both forms.
  const byRef = new Map<string, FhirResource>();
  for (const entry of entries) {
    const resource = entry.resource as FhirResource;
    if (resource.id) byRef.set(`${resource.resourceType}/${resource.id}`, resource);
    if (entry.fullUrl) byRef.set(entry.fullUrl, resource);
  }
  const resolve = (ref?: Reference) => (ref?.reference ? byRef.get(ref.reference) : undefined);
  const referenceKey = (ref?: Reference) => {
    const resource = resolve(ref);
    return resource?.id ? `${resource.resourceType}/${resource.id}` : ref?.reference;
  };
  const practitioner = (ref?: Reference) => {
    const resource = resolve(ref);
    return resource?.resourceType === "Practitioner" ? resource : undefined;
  };
  const nameOf = (ref?: Reference) => practitionerName(practitioner(ref), ref?.display);
  const src = (r: FhirResource): DataSource => ({ kind: "ehr", label: opts.sourceLabel, importedAt: opts.importedAt, verified: false, refId: `${r.resourceType}/${r.id}` });
  const id = (r: FhirResource) => `ehr-${r.id}`;
  const pid = opts.patientId;

  // Notes are looked up by encounter so visit summaries can carry them. Prefer
  // DocumentReference, but accept DiagnosticReport.presentedForm (Synthea emits
  // the same clinical note in both shapes, and some exports contain only one).
  type EncounterNote = { resource: FhirDocumentReference | FhirDiagnosticReport; attachment?: Attachment };
  const notesByEncounter = new Map<string, EncounterNote>();
  for (const r of resources) {
    if (r.resourceType === "DocumentReference") {
      for (const encounter of r.context?.encounter ?? []) {
        const key = referenceKey(encounter);
        if (key) notesByEncounter.set(key, { resource: r, attachment: r.content[0]?.attachment });
      }
    }
  }
  for (const r of resources) {
    if (r.resourceType === "DiagnosticReport" && r.presentedForm?.length) {
      const key = referenceKey(r.encounter);
      if (key && !notesByEncounter.has(key)) notesByEncounter.set(key, { resource: r, attachment: r.presentedForm[0] });
    }
  }
  // Lab → panel, from DiagnosticReport.result.
  const panelOf = new Map<string, string>();
  for (const r of resources) {
    if (r.resourceType === "DiagnosticReport") {
      for (const result of r.result ?? []) {
        const key = referenceKey(result);
        if (key) panelOf.set(key, id(r));
      }
    }
  }
  const vitalsByTime = new Map<string, VitalSign>();
  const unsupported = new Map<string, number>();

  for (const r of resources) {
    switch (r.resourceType) {
      case "Patient": {
        const p = r as FhirPatient;
        const n = p.name?.[0];
        out.patient = { name: n?.text ?? [...(n?.given ?? []), n?.family].filter(Boolean).join(" "), birthDate: p.birthDate, gender: p.gender };
        break;
      }
      case "Practitioner":
      case "Medication":
        break; // used via references
      case "Condition": {
        const c = r as FhirCondition;
        const icd = coding(c.code, SYSTEMS.icd10)?.code;
        const name = textOf(c.code);
        out.conditions.push({
          id: id(c), name, category: conditionCategory(icd, name), code: icd, snomedCode: coding(c.code, SYSTEMS.snomed)?.code,
          diagnosedOn: dateOnly(c.onsetDateTime ?? c.recordedDate) || undefined,
          clinicalStatus: c.clinicalStatus?.coding?.[0]?.code === "resolved" ? "resolved" : "active", source: src(c),
        });
        break;
      }
      case "MedicationRequest":
      case "MedicationStatement": {
        const m = r as FhirMedicationRequest | FhirMedicationStatement;
        const referencedMedication = resolve(m.medicationReference) as FhirMedication | undefined;
        const medicationConcept = m.medicationCodeableConcept ?? referencedMedication?.code;
        const rx = coding(medicationConcept, SYSTEMS.rxnorm);
        const display = textOf(medicationConcept) || m.medicationReference?.display || "";
        if (!display) {
          const ref = m.medicationReference?.reference;
          out.warnings.push(`Medication ${m.id}${ref ? ` references ${ref}, which could not be resolved` : " has no coded name"} — skipped.`);
          break;
        }
        const drug = (rx?.code && lookupRxcui(rx.code)) || lookupDrug(display) || lookupDrug(medicationNameFromDisplay(display));
        const isStatement = m.resourceType === "MedicationStatement";
        const dosage = isStatement ? m.dosage?.[0] : m.dosageInstruction?.[0];
        const q = dosage?.doseAndRate?.[0]?.doseQuantity;
        const unit = (q?.unit ?? "").replace(/^meq$/i, "mEq");
        const inferredUnit = !unit && /\btablet\b/i.test(display) ? "tablet" : !unit && /\bcapsule\b/i.test(display) ? "capsule" : "";
        const doseUnit = unit || inferredUnit;
        const dose = q?.value !== undefined ? `${q.value}${doseUnit ? ` ${doseUnit}${q.value === 1 || unit ? "" : "s"}` : " dose unit"}` : "";
        const status = m.status === "active" ? "active" : m.status === "on-hold" ? "on-hold" : "stopped";
        out.medications.push({
          id: id(m), name: medicationNameFromDisplay(display), genericName: drug?.generic ?? medicationNameFromDisplay(display).toLowerCase(),
          class: drug?.class ?? "other", rxNormCode: drug?.rxcui ?? rx?.code, dose,
          frequency: frequencyText(dosage), startDate: dateOnly(isStatement ? m.effectivePeriod?.start ?? m.dateAsserted : m.authoredOn), indication: m.reasonCode?.[0]?.text,
          prescriber: (isStatement ? m.informationSource?.display : nameOf(m.requester)) || undefined,
          stoppedOn: isStatement && status === "stopped" ? dateOnly(m.effectivePeriod?.end) || undefined : undefined,
          status, source: { ...src(m), originalText: display },
        });
        break;
      }
      case "AllergyIntolerance": {
        const a = r as FhirAllergyIntolerance;
        const substance = textOf(a.code);
        const category = a.category?.[0] === "medication" ? "medication" : a.category?.[0] === "food" ? "food" : a.category?.[0] === "environment" ? "environment" : "other";
        const sev = a.reaction?.[0]?.severity ?? (a.criticality === "high" ? "severe" : "moderate");
        out.allergies.push({
          id: id(a), patientId: pid, substance, category, type: a.type,
          matches: category === "medication" ? allergyMatches(substance) : undefined,
          reaction: a.reaction?.[0]?.manifestation?.map(textOf).join(", ") || a.reaction?.[0]?.description,
          severity: sev, recordedOn: dateOnly(a.recordedDate) || undefined, code: a.code?.coding?.[0]?.code, source: src(a),
        });
        break;
      }
      case "Observation": {
        const o = r as FhirObservation;
        const cat = o.category?.flatMap((c) => c.coding ?? []).map((c) => c.code) ?? [];
        const loinc = coding(o.code, SYSTEMS.loinc)?.code;
        if (cat.includes("laboratory")) {
          const concept = loinc ? lookupLab(loinc) : undefined;
          const value = o.valueQuantity?.value;
          if (value === undefined) { out.warnings.push(`Lab ${textOf(o.code)} has no numeric value — skipped.`); break; }
          const rr = o.referenceRange?.[0];
          const range = { low: rr?.low?.value ?? concept?.range.low, high: rr?.high?.value ?? concept?.range.high };
          out.labs.push({
            id: id(o), patientId: pid, name: concept?.name ?? textOf(o.code), loincCode: loinc, panelId: panelOf.get(`Observation/${o.id}`),
            value, unit: concept?.unit ?? (o.valueQuantity?.unit ?? "").replace(/[{}]/g, ""), date: dateOnly(o.effectiveDateTime),
            referenceRange: range, status: interpretLab(value, range, concept?.borderlineMargin), source: src(o),
          });
        } else if (cat.includes("vital-signs")) {
          const t = localDateTime(o.effectiveDateTime);
          const v = vitalsByTime.get(t) ?? { id: `ehr-vitals-${t}`, patientId: pid, timestamp: t, bpSetting: "clinic" as const, source: src(o) };
          if (loinc === "85354-9") {
            v.systolic = o.component?.find((c) => coding(c.code, SYSTEMS.loinc)?.code === "8480-6")?.valueQuantity?.value;
            v.diastolic = o.component?.find((c) => coding(c.code, SYSTEMS.loinc)?.code === "8462-4")?.valueQuantity?.value;
          } else if (loinc === "8867-4") v.heartRate = o.valueQuantity?.value;
          else if (loinc === "29463-7") v.weightKg = o.valueQuantity?.unit === "[lb_av]" ? Math.round((o.valueQuantity.value ?? 0) * 4.536) / 10 : o.valueQuantity?.value;
          else if (loinc === "40443-4") v.restingHeartRate = o.valueQuantity?.value;
          else { out.warnings.push(`Vital sign ${textOf(o.code)} (${loinc}) not mapped.`); break; }
          vitalsByTime.set(t, v);
        } else if (cat.includes("social-history")) {
          const category = loinc === "72166-2" ? "tobacco" : loinc === "11331-6" ? "alcohol" : loinc === "68516-4" ? "physical-activity" : "other";
          out.socialHistory.push({ id: id(o), patientId: pid, category, value: o.valueString ?? textOf(o.valueCodeableConcept), date: dateOnly(o.effectiveDateTime), code: loinc, source: src(o) });
        } else if (loinc === "44261-6" || loinc === "70274-6") {
          const instrument = loinc === "44261-6" ? "PHQ-9" : "GAD-7";
          const score = o.valueQuantity?.value ?? 0;
          out.assessments.push({ id: id(o), patientId: pid, instrument, date: dateOnly(o.effectiveDateTime), score, severity: severityBand(instrument, score), administeredBy: "clinician", source: src(o) });
        } else out.warnings.push(`Observation ${textOf(o.code)} (${cat.join(",") || "no category"}) not mapped.`);
        break;
      }
      case "DiagnosticReport": {
        const d = r as FhirDiagnosticReport;
        const attachment = d.presentedForm?.find((a) => (a.contentType ?? "text/plain").startsWith("text/"));
        const encounterKey = referenceKey(d.encounter);
        const preferredNote = !encounterKey || notesByEncounter.get(encounterKey)?.resource === d;
        if (attachment && preferredNote) {
          const loinc = coding(d.code, SYSTEMS.loinc)?.code;
          out.documents.push({
            id: id(d), patientId: pid, title: attachment.title ?? (textOf(d.code) || "Clinical note"), type: (loinc && NOTE_TYPES[loinc]) || "other",
            date: dateOnly(d.effectiveDateTime ?? d.effectivePeriod?.start ?? d.issued),
            author: d.resultsInterpreter?.[0] ? nameOf(d.resultsInterpreter[0]) : d.performer?.[0]?.display,
            text: attachment.data ? decodeBase64Utf8(attachment.data) : undefined, source: src(d),
          });
        }
        // A note-shaped DiagnosticReport has no results. Do not invent an empty
        // lab panel for it; reports with results retain the existing behavior.
        if (d.result?.length) {
          out.labPanels.push({
            id: id(d), patientId: pid, name: textOf(d.code), code: coding(d.code, SYSTEMS.loinc)?.code, date: dateOnly(d.effectiveDateTime ?? d.effectivePeriod?.start),
            orderedBy: d.resultsInterpreter?.[0] ? nameOf(d.resultsInterpreter[0]) : undefined, performer: d.performer?.[0]?.display, source: src(d),
          });
        } else if (!attachment) {
          out.warnings.push(`DiagnosticReport/${d.id} has neither results nor a readable presented form — skipped.`);
        }
        break;
      }
      case "Encounter": {
        const e = r as FhirEncounter;
        const specialty = e.serviceType?.text ?? textOf(e.type?.[0]) ?? "Visit";
        const typeText = textOf(e.type?.[0]).toLowerCase();
        const type: EncounterType = e.class?.code === "VR" ? "telehealth" : /psychotherapy|therapy/.test(typeText) ? "therapy" : e.class?.code === "EMER" ? "emergency" : e.class?.code === "IMP" ? "hospital" : "office";
        const note = notesByEncounter.get(`Encounter/${e.id}`);
        const noteText = note?.attachment?.data && (note.attachment.contentType ?? "text/plain").startsWith("text/") ? decodeBase64Utf8(note.attachment.data) : undefined;
        out.encounters.push({
          id: id(e), patientId: pid, date: dateOnly(e.period?.start), type, clinician: nameOf(e.participant?.[0]?.individual), specialty,
          organization: e.serviceProvider?.display, reason: e.reasonCode?.[0]?.text ?? textOf(e.type?.[0]),
          summary: noteText ? noteText.split("\n").slice(1).join(" ").trim() : e.reasonCode?.[0]?.text ?? "",
          documentId: note ? id(note.resource) : undefined, source: src(e),
        });
        break;
      }
      case "DocumentReference": {
        const d = r as FhirDocumentReference;
        const att = d.content[0]?.attachment;
        const loinc = coding(d.type, SYSTEMS.loinc)?.code;
        out.documents.push({
          id: id(d), patientId: pid, title: d.description ?? att?.title ?? textOf(d.type), type: (loinc && NOTE_TYPES[loinc]) || "other",
          date: dateOnly(d.date), author: d.author?.[0] ? nameOf(d.author[0]) : undefined, organization: d.custodian?.display,
          text: att?.data && (att.contentType ?? "text/plain").startsWith("text/") ? decodeBase64Utf8(att.data) : undefined, source: src(d),
        });
        break;
      }
      case "Appointment": {
        const a = r as FhirAppointment;
        const actors = (a.participant ?? []).map((p) => p.actor).filter(Boolean) as Reference[];
        const prac = actors.find((x) => resolve(x)?.resourceType === "Practitioner" || x.reference?.startsWith("Practitioner/"));
        // Display-only actors: the location — or, with no Practitioner reference, the clinician then the location.
        const displayOnly = actors.filter((x) => !x.reference);
        const clinician = prac ? nameOf(prac) : displayOnly.shift()?.display ?? "";
        const location = displayOnly[0];
        const status: Appointment["status"] = a.status === "fulfilled" || a.status === "arrived" || a.status === "checked-in" ? "fulfilled" : a.status === "cancelled" ? "cancelled" : a.status === "noshow" ? "noshow" : "booked";
        out.appointments.push({
          id: id(a), patientId: pid, start: localDateTime(a.start), status, clinician, specialty: textOf(a.specialty?.[0]) || textOf(a.serviceType?.[0]) || "General",
          location: location?.display, reason: a.reasonCode?.[0]?.text ?? a.description ?? "", source: src(a),
        });
        break;
      }
      case "Immunization": {
        const i = r as FhirImmunization;
        const p = i.protocolApplied?.[0];
        out.immunizations.push({
          id: id(i), patientId: pid, vaccine: textOf(i.vaccineCode), date: dateOnly(i.occurrenceDateTime), cvxCode: coding(i.vaccineCode, SYSTEMS.cvx)?.code,
          doseNote: p?.doseNumberPositiveInt ? `Dose ${p.doseNumberPositiveInt}${p.seriesDosesPositiveInt ? ` of ${p.seriesDosesPositiveInt}` : ""}` : undefined,
          performer: i.performer?.[0]?.actor?.display, source: src(i),
        });
        break;
      }
      case "Procedure": {
        const p = r as FhirProcedure;
        out.procedures.push({
          id: id(p), patientId: pid, name: textOf(p.code), date: dateOnly(p.performedDateTime ?? p.performedPeriod?.start), code: coding(p.code, SYSTEMS.snomed)?.code,
          performer: p.performer?.[0]?.actor ? nameOf(p.performer[0].actor) : undefined, outcome: textOf(p.outcome) || undefined, source: src(p),
        });
        break;
      }
      case "CareTeam": {
        const ct = r as FhirCareTeam;
        for (const [k, part] of (ct.participant ?? []).entries()) {
          const role = careTeamRole(textOf(part.role?.[0]));
          const prac = practitioner(part.member);
          out.careTeam.push({
            id: `${id(ct)}-${k}`, patientId: pid, name: nameOf(part.member), ...role, organization: part.onBehalfOf?.display ?? ct.managingOrganization?.[0]?.display,
            phone: prac?.telecom?.find((t) => t.system === "phone")?.value, email: prac?.telecom?.find((t) => t.system === "email")?.value, source: src(ct),
          });
        }
        break;
      }
      case "CarePlan": {
        const cp = r as FhirCarePlan;
        const categoryText = (cp.category ?? []).map(textOf).filter(Boolean);
        const cat = categoryText.join(" ").toLowerCase();
        const category: CarePlan["category"] = /medic/.test(cat) ? "medication" : /monitor/.test(cat) ? "monitoring" : /nutri|diet/.test(cat) ? "nutrition" : /mental|behav/.test(cat) ? "mental-health" : /follow/.test(cat) ? "follow-up" : "lifestyle";
        out.carePlans.push({
          id: id(cp), patientId: pid, title: cp.title ?? categoryText.find((text) => !/^assess-plan$/i.test(text)) ?? "Care plan", category, author: nameOf(cp.author), date: dateOnly(cp.created ?? cp.period?.start),
          instructions: (cp.activity ?? []).map((a) => a.detail?.description ?? textOf(a.detail?.code)).filter((x): x is string => !!x), status: cp.status === "completed" ? "completed" : "active", source: src(cp),
        });
        break;
      }
      default: {
        const unknown = r as { resourceType: string; id?: string };
        unsupported.set(unknown.resourceType, (unsupported.get(unknown.resourceType) ?? 0) + 1);
      }
    }
  }
  for (const [resourceType, count] of unsupported) {
    out.warnings.push(`${count} ${resourceType} resource${count === 1 ? " is" : "s are"} not part of the Passport yet — skipped.`);
  }
  out.vitals = [...vitalsByTime.values()];
  return out;
}
