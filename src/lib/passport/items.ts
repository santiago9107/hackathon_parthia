import type { DataSource, PatientRecord, SourceKind, Sourced } from "../types";
import { COLLECTION_LABELS, type CollectionName, type LocalPassport, type SourceConnection } from "./collections";

/** Every item in a merged record, tagged with its collection. */
export function recordItems(r: PatientRecord): { collection: CollectionName; item: Sourced }[] {
  const out: { collection: CollectionName; item: Sourced }[] = [];
  const push = (collection: CollectionName, items: Sourced[]) => items.forEach((item) => out.push({ collection, item }));
  push("conditions", r.patient.conditions);
  push("medications", [...r.patient.medications, ...r.pastMedications]);
  push("medicationHistory", r.patient.medicationHistory);
  push("labs", r.patient.labs);
  push("labPanels", r.labPanels);
  push("vitals", r.patient.vitals);
  push("symptoms", r.symptoms);
  push("moods", r.moods);
  push("nutrition", r.nutrition);
  push("allergies", r.allergies);
  push("appointments", r.appointments);
  push("encounters", r.encounters);
  push("immunizations", r.immunizations);
  push("procedures", r.procedures);
  push("careTeam", r.careTeam);
  push("carePlans", r.carePlans);
  push("documents", r.documents);
  push("assessments", r.assessments);
  if (r.nutritionProfile) push("nutritionProfile", [r.nutritionProfile]);
  if (r.emergency) push("emergency", [r.emergency]);
  return out;
}

export interface SourceSummary {
  key: string;
  kind: SourceKind;
  label: string;
  confirmed: number;
  pending: number;
  byCollection: Partial<Record<CollectionName, number>>;
  lastImportAt?: string;
  connection?: SourceConnection;
}

/** Items per source (confirmed in the record + pending in local storage). */
export function summarizeSources(record: PatientRecord, local: LocalPassport | undefined): SourceSummary[] {
  const map = new Map<string, SourceSummary>();
  const get = (s: DataSource) => {
    const key = `${s.kind}:${s.label}`;
    if (!map.has(key)) map.set(key, { key, kind: s.kind, label: s.label, confirmed: 0, pending: 0, byCollection: {} });
    return map.get(key)!;
  };
  for (const { collection, item } of recordItems(record)) {
    const s = get(item.source);
    s.confirmed++;
    s.byCollection[collection] = (s.byCollection[collection] ?? 0) + 1;
    if (item.source.kind !== "seed" && (!s.lastImportAt || item.source.importedAt > s.lastImportAt)) s.lastImportAt = item.source.importedAt;
  }
  for (const e of local?.entries ?? []) {
    if (e.status !== "pending" || e.removed) continue;
    const s = get(e.item.source);
    s.pending++;
    if (!s.lastImportAt || e.item.source.importedAt > s.lastImportAt) s.lastImportAt = e.item.source.importedAt;
  }
  for (const c of local?.connections ?? []) {
    const match = [...map.values()].find((s) => s.kind === c.kind && s.label === c.name);
    if (match) match.connection = c;
    else map.set(`${c.kind}:${c.name}`, { key: `${c.kind}:${c.name}`, kind: c.kind, label: c.name, confirmed: 0, pending: 0, byCollection: {}, connection: c, lastImportAt: c.lastImportAt });
  }
  const order: SourceKind[] = ["ehr", "document-scan", "wearable", "device", "patient-entered", "seed"];
  return [...map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.label.localeCompare(b.label));
}

export function describeCollectionCounts(counts: Partial<Record<CollectionName, number>>): string {
  return Object.entries(counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([c, n]) => `${n} ${n === 1 ? COLLECTION_LABELS[c as CollectionName].one : COLLECTION_LABELS[c as CollectionName].many}`)
    .join(", ");
}
