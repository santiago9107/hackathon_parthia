import type { DataSource, Medication, PatientRecord, VitalSign } from "../types";
import { SYSTEMS, type Coding, type FhirBundle, type FhirResource } from "../fhir/types";

/**
 * Passport → FHIR R4 Bundle (type "collection").
 *
 * Uses standard codes wherever the Passport has them (RxNorm, ICD-10-CM,
 * SNOMED CT, LOINC, CVX). Medications are exported as MedicationStatement —
 * what the patient reports taking — not as prescriptions. Each resource
 * carries its Passport provenance in meta.source and a source-kind tag, so a
 * clinician can tell a hospital record from a patient entry or a scan.
 *
 * Only confirmed data is exported: the record passed in is the merged
 * Passport, which never contains unreviewed imports.
 */

export const EXPORT_SECTIONS = [
  "conditions",
  "medications",
  "allergies",
  "labs",
  "vitals",
  "screenings",
  "immunizations",
  "procedures",
  "appointments",
  "careTeam",
  "carePlans",
] as const;
export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export const EXPORT_SECTION_LABELS: Record<ExportSection, string> = {
  conditions: "Conditions",
  medications: "Medications (current and past)",
  allergies: "Allergies",
  labs: "Lab results",
  vitals: "Vital signs",
  screenings: "Screenings (PHQ-9, GAD-7)",
  immunizations: "Immunizations",
  procedures: "Procedures",
  appointments: "Appointments",
  careTeam: "Care team",
  carePlans: "Care plans",
};

export const SOURCE_KIND_SYSTEM = "https://parthiahealth.com/fhir/source-kind";
export const PARTHIA_TAG_SYSTEM = "https://parthiahealth.com/fhir/tags";

export interface ExportOptions {
  now: Date;
  sections?: readonly ExportSection[];
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9.-]/g, "-").slice(0, 64);
const cc = (text: string, ...codings: (Coding | false | undefined)[]) => {
  const c = codings.filter((x): x is Coding => !!x);
  return c.length ? { coding: c, text } : { text };
};
const qty = (value: number, unit: string, code = unit) => ({ value, unit, system: SYSTEMS.ucum, code });
const obsCategory = (code: string, display: string) => [{ coding: [{ system: SYSTEMS.obsCategory, code, display }] }];

function meta(source: DataSource) {
  return { source: source.label, tag: [{ system: SOURCE_KIND_SYSTEM, code: source.kind }] };
}

/** "25 mg" → 25 / "mg"; anything else stays free text. */
function parseDose(dose: string): { value: number; unit: string } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([A-Za-zµ%]+(?:\/[A-Za-z]+)?)\s*$/.exec(dose);
  return m ? { value: Number(m[1]), unit: m[2] } : null;
}

const TIMES: Record<string, number> = { "once daily": 1, "twice daily": 2, "three times daily": 3, "four times daily": 4 };

function dosageOf(m: Medication) {
  const d = parseDose(m.dose);
  const perDay = TIMES[m.frequency];
  return [
    {
      text: m.frequency,
      ...(perDay ? { timing: { repeat: { frequency: perDay, period: 1, periodUnit: "d" as const } } } : {}),
      ...(/as needed/i.test(m.frequency) ? { asNeededBoolean: true } : {}),
      ...(d ? { doseAndRate: [{ doseQuantity: { value: d.value, unit: d.unit } }] } : {}),
    },
  ];
}

function vitalObservations(v: VitalSign): FhirResource[] {
  const out: FhirResource[] = [];
  const base = { status: "final", category: obsCategory("vital-signs", "Vital Signs"), effectiveDateTime: v.timestamp, meta: meta(v.source) };
  const id = slug(v.id);
  if (v.systolic !== undefined && v.diastolic !== undefined) {
    out.push({
      resourceType: "Observation", id: `${id}-bp`, ...base,
      code: cc("Blood pressure panel", { system: SYSTEMS.loinc, code: "85354-9", display: "Blood pressure panel with all children optional" }),
      component: [
        { code: cc("Systolic blood pressure", { system: SYSTEMS.loinc, code: "8480-6" }), valueQuantity: qty(v.systolic, "mm[Hg]") },
        { code: cc("Diastolic blood pressure", { system: SYSTEMS.loinc, code: "8462-4" }), valueQuantity: qty(v.diastolic, "mm[Hg]") },
      ],
    });
  }
  if (v.heartRate !== undefined)
    out.push({ resourceType: "Observation", id: `${id}-hr`, ...base, code: cc("Heart rate", { system: SYSTEMS.loinc, code: "8867-4" }), valueQuantity: qty(v.heartRate, "/min") });
  if (v.restingHeartRate !== undefined)
    out.push({ resourceType: "Observation", id: `${id}-rhr`, ...base, code: cc("Resting heart rate", { system: SYSTEMS.loinc, code: "40443-4" }), valueQuantity: qty(v.restingHeartRate, "/min") });
  if (v.weightKg !== undefined)
    out.push({ resourceType: "Observation", id: `${id}-wt`, ...base, code: cc("Body weight", { system: SYSTEMS.loinc, code: "29463-7" }), valueQuantity: qty(v.weightKg, "kg") });
  return out;
}

export function toFhirBundle(record: PatientRecord, { now, sections = EXPORT_SECTIONS }: ExportOptions): FhirBundle {
  const { patient } = record;
  const want = new Set(sections);
  const subject = { reference: `Patient/${slug(patient.id)}`, display: patient.name };
  const [given, ...rest] = patient.name.split(" ");
  const resources: FhirResource[] = [
    {
      resourceType: "Patient",
      id: slug(patient.id),
      name: [{ use: "usual", text: patient.name, given: [given], family: rest.join(" ") || undefined }],
      gender: patient.sex === "other" ? "other" : patient.sex,
    },
  ];

  if (want.has("conditions"))
    for (const c of patient.conditions)
      resources.push({
        resourceType: "Condition", id: slug(c.id), meta: meta(c.source),
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: c.clinicalStatus ?? "active" }] },
        code: cc(c.name, c.code ? { system: SYSTEMS.icd10, code: c.code } : undefined, c.snomedCode ? { system: SYSTEMS.snomed, code: c.snomedCode } : undefined),
        onsetDateTime: c.diagnosedOn,
      });

  if (want.has("medications"))
    for (const m of [...patient.medications, ...record.pastMedications]) {
      const status = m.status === "stopped" ? "stopped" : m.status === "on-hold" ? "on-hold" : "active";
      resources.push({
        resourceType: "MedicationStatement", id: slug(m.id), meta: meta(m.source), status,
        medicationCodeableConcept: cc(`${m.name} ${m.dose}`.trim(), m.rxNormCode ? { system: SYSTEMS.rxnorm, code: m.rxNormCode } : undefined),
        subject,
        effectivePeriod: { start: m.startDate || undefined, end: m.stoppedOn },
        dateAsserted: now.toISOString(),
        informationSource: m.prescriber ? { display: m.prescriber } : undefined,
        reasonCode: m.indication ? [{ text: m.indication }] : undefined,
        dosage: dosageOf(m),
      });
    }

  if (want.has("allergies"))
    for (const a of record.allergies)
      resources.push({
        resourceType: "AllergyIntolerance", id: slug(a.id), meta: meta(a.source), type: a.type,
        category: [a.category === "other" ? "biologic" : a.category],
        criticality: a.severity === "severe" ? "high" : "low",
        code: cc(a.substance, a.code ? { system: a.category === "medication" ? SYSTEMS.rxnorm : SYSTEMS.snomed, code: a.code } : undefined),
        recordedDate: a.recordedOn,
        reaction: [{ severity: a.severity, ...(a.reaction ? { manifestation: [{ text: a.reaction }] } : {}) }],
      });

  if (want.has("labs"))
    for (const l of patient.labs)
      resources.push({
        resourceType: "Observation", id: slug(l.id), meta: meta(l.source), status: "final",
        category: obsCategory("laboratory", "Laboratory"),
        code: cc(l.name, l.loincCode ? { system: SYSTEMS.loinc, code: l.loincCode } : undefined),
        effectiveDateTime: l.date,
        valueQuantity: { value: l.value, unit: l.unit },
        referenceRange: [{ low: l.referenceRange.low !== undefined ? { value: l.referenceRange.low } : undefined, high: l.referenceRange.high !== undefined ? { value: l.referenceRange.high } : undefined }],
        interpretation: l.status === "normal" ? undefined : [{ text: l.status }],
      });

  if (want.has("vitals")) for (const v of patient.vitals) resources.push(...vitalObservations(v));

  if (want.has("screenings"))
    for (const a of record.assessments)
      resources.push({
        resourceType: "Observation", id: slug(a.id), meta: meta(a.source), status: "final",
        category: obsCategory("survey", "Survey"),
        code: cc(`${a.instrument} total score`, { system: SYSTEMS.loinc, code: a.instrument === "PHQ-9" ? "44261-6" : "70274-6" }),
        effectiveDateTime: a.date,
        valueQuantity: { value: a.score, unit: "{score}" },
        interpretation: [{ text: `${a.severity} (screening, not a diagnosis)` }],
      });

  if (want.has("immunizations"))
    for (const i of record.immunizations)
      resources.push({
        resourceType: "Immunization", id: slug(i.id), meta: meta(i.source), status: "completed",
        vaccineCode: cc(i.vaccine, i.cvxCode ? { system: SYSTEMS.cvx, code: i.cvxCode } : undefined),
        occurrenceDateTime: i.date,
        performer: i.performer ? [{ actor: { display: i.performer } }] : undefined,
      });

  if (want.has("procedures"))
    for (const p of record.procedures)
      resources.push({
        resourceType: "Procedure", id: slug(p.id), meta: meta(p.source), status: "completed",
        code: cc(p.name, p.code ? { system: SYSTEMS.snomed, code: p.code } : undefined),
        performedDateTime: p.date,
        performer: p.performer ? [{ actor: { display: p.performer } }] : undefined,
        outcome: p.outcome ? { text: p.outcome } : undefined,
      });

  if (want.has("appointments"))
    for (const a of record.appointments)
      resources.push({
        resourceType: "Appointment", id: slug(a.id), meta: meta(a.source), status: a.status,
        specialty: [{ text: a.specialty }], reasonCode: [{ text: a.reason }], start: a.start,
        participant: [{ actor: { display: a.clinician } }, ...(a.location ? [{ actor: { display: a.location } }] : []), { actor: subject }],
        description: a.patientNotes,
      });

  if (want.has("careTeam") && record.careTeam.length)
    resources.push({
      resourceType: "CareTeam", id: `careteam-${slug(patient.id)}`, status: "active",
      participant: record.careTeam.map((c) => ({ role: [{ text: c.specialty ?? c.role }], member: { display: c.name }, onBehalfOf: c.organization ? { display: c.organization } : undefined })),
    });

  if (want.has("carePlans"))
    for (const p of record.carePlans)
      resources.push({
        resourceType: "CarePlan", id: slug(p.id), meta: meta(p.source), status: p.status, intent: "plan", title: p.title,
        category: [{ text: p.category }], author: { display: p.author }, created: p.date,
        activity: p.instructions.map((d) => ({ detail: { description: d, status: "in-progress" } })),
      });

  return {
    resourceType: "Bundle",
    id: `parthia-passport-${slug(patient.id)}-${now.getTime()}`,
    type: "collection",
    timestamp: now.toISOString(),
    meta: {
      tag: [
        { system: PARTHIA_TAG_SYSTEM, code: "patient-passport", display: "Parthia Patient Passport export" },
        { system: PARTHIA_TAG_SYSTEM, code: "synthetic", display: "Prototype — synthetic sample data" },
      ],
    },
    entry: resources.map((r) => ({ fullUrl: `urn:uuid:${r.resourceType}-${r.id}`, resource: r })),
  };
}

/** Counts per resource type, for previews and activity summaries. */
export function bundleCounts(bundle: FhirBundle): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of bundle.entry ?? []) out[e.resource.resourceType] = (out[e.resource.resourceType] ?? 0) + 1;
  return out;
}
