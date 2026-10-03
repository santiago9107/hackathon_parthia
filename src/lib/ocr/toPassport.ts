import type { DataSource, HealthDocument, LabPanel, LabResult, Medication, MedicationEvent, PatientId, PatientRecord } from "../types";
import { newId } from "../passport/ops";
import { normDose } from "../passport/importPlan";
import { interpretLab, lookupLab } from "../terminology/labs";
import { lookupDrug } from "../terminology/medications";
import type { Extraction } from "./extract";

/**
 * Editable review rows for a scanned document, and conversion of the rows the
 * patient confirmed into Passport items with "document-scan" provenance.
 */

export interface MedRow {
  key: string;
  include: boolean;
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  indication: string;
  confidence: number;
  line: string;
  issues: string[];
  alreadyInPassport: boolean;
}

export interface LabRow {
  key: string;
  include: boolean;
  name: string;
  value: string;
  unit: string;
  low: string;
  high: string;
  confidence: number;
  line: string;
  issues: string[];
  alreadyInPassport: boolean;
}

export interface ScanDetails {
  type: Extraction["documentType"];
  date: string;
  prescriber: string;
  organization: string;
  title: string;
  /** Panel heading on a lab report, e.g. "Basic Metabolic Panel". */
  panelName?: string;
  saveDocument: boolean;
}

export const SCAN_LABELS: Record<Extraction["documentType"], string> = {
  prescription: "Scanned prescription",
  "lab-report": "Scanned lab report",
  "visit-summary": "Scanned visit summary",
  other: "Scanned document",
};

export function defaultTitle(x: Extraction): string {
  const what = { prescription: "Prescription", "lab-report": x.panelName ?? "Lab report", "visit-summary": "Visit summary", other: "Document" }[x.documentType];
  return x.organization ? `${what} — ${x.organization}` : what;
}

export function rowsFromExtraction(x: Extraction, record: PatientRecord): { meds: MedRow[]; labs: LabRow[] } {
  const meds = x.medications.map((m, i) => {
    const already = record.patient.medications.some((p) => p.genericName === m.drug?.generic && normDose(p.dose) === normDose(`${m.dose ?? ""}${m.unit ?? ""}`));
    return {
      key: `med-${i}`, include: !already && m.confidence >= 0.6, name: m.name, dose: m.dose ?? "", unit: m.unit ?? m.drug?.units[0] ?? "mg",
      frequency: m.frequency ?? "", indication: m.indication ?? "", confidence: m.confidence, line: m.line, issues: m.issues, alreadyInPassport: already,
    };
  });
  const labs = x.labs.map((l, i) => {
    const already = record.patient.labs.some((p) => p.loincCode === l.concept?.loinc && p.date === x.date && p.value === l.value);
    return {
      key: `lab-${i}`, include: !already && l.confidence >= 0.6, name: l.name, value: String(l.value), unit: l.unit,
      low: l.range.low !== undefined ? String(l.range.low) : "", high: l.range.high !== undefined ? String(l.range.high) : "",
      confidence: l.confidence, line: l.line, issues: l.issues, alreadyInPassport: already,
    };
  });
  return { meds, labs };
}

export interface ScanItems {
  medications: Medication[];
  medicationHistory: MedicationEvent[];
  labs: LabResult[];
  labPanels: LabPanel[];
  documents: HealthDocument[];
}

export function buildScanItems(
  details: ScanDetails,
  meds: MedRow[],
  labs: LabRow[],
  ctx: { patientId: PatientId; text: string; textConfidence: number; imageDataUrl?: string; now?: Date },
): ScanItems {
  const now = ctx.now ?? new Date();
  const docId = newId("doc-scan");
  const label = SCAN_LABELS[details.type];
  const source = (confidence: number, line?: string): DataSource => ({
    kind: "document-scan", label, importedAt: now.toISOString(), verified: true, confidence: Math.round(confidence * 100) / 100, originalText: line, refId: docId,
  });
  const prescriber = details.prescriber ? `${details.prescriber}${details.organization ? `, ${details.organization}` : ""}` : details.organization || undefined;

  const medications: Medication[] = [];
  const medicationHistory: MedicationEvent[] = [];
  for (const r of meds.filter((m) => m.include && m.name.trim())) {
    const drug = lookupDrug(r.name);
    const med: Medication = {
      id: newId("m-scan"), name: r.name.trim(), genericName: drug?.generic ?? r.name.trim().toLowerCase(), class: drug?.class ?? "other", rxNormCode: drug?.rxcui,
      dose: `${r.dose} ${r.unit}`.trim(), frequency: r.frequency.trim() || "as directed", startDate: details.date, indication: r.indication.trim() || undefined,
      prescriber, status: "active", source: source(r.confidence, r.line),
    };
    medications.push(med);
    medicationHistory.push({
      id: newId("e-scan"), patientId: ctx.patientId, date: details.date, medicationName: med.name, type: "started",
      detail: `${med.name} ${med.dose} ${med.frequency} — from a ${label.toLowerCase()}${prescriber ? ` (${prescriber})` : ""}.`, source: source(r.confidence, r.line),
    });
  }

  const labRows = labs.filter((l) => l.include && l.name.trim() && Number.isFinite(Number(l.value)));
  const labPanels: LabPanel[] = [];
  const labResults: LabResult[] = [];
  if (labRows.length) {
    const panelId = newId("lp-scan");
    labPanels.push({ id: panelId, patientId: ctx.patientId, name: details.panelName || "Lab report (scanned)", date: details.date, orderedBy: details.prescriber || undefined, performer: details.organization || undefined, source: source(ctx.textConfidence) });
    for (const r of labRows) {
      const concept = lookupLab(r.name);
      const range = { low: r.low ? Number(r.low) : undefined, high: r.high ? Number(r.high) : undefined };
      const value = Number(r.value);
      labResults.push({
        id: newId("l-scan"), patientId: ctx.patientId, name: concept?.name ?? r.name.trim(), loincCode: concept?.loinc, panelId, value, unit: r.unit, date: details.date,
        referenceRange: range, status: interpretLab(value, range, concept?.borderlineMargin), source: source(r.confidence, r.line),
      });
    }
  }

  const documents: HealthDocument[] = details.saveDocument
    ? [{ id: docId, patientId: ctx.patientId, title: details.title, type: details.type, date: details.date, author: details.prescriber || undefined, organization: details.organization || undefined, text: ctx.text, imageDataUrl: ctx.imageDataUrl, source: source(ctx.textConfidence) }]
    : [];

  return { medications, medicationHistory, labs: labResults, labPanels, documents };
}
