import type { ActivityEntry, PatientId, SourceKind } from "../types";
import { COLLECTION_LABELS, type CollectionName, type CollectionTypes, type SourceConnection } from "./collections";
import { addResolution, appendActivity, describeCounts, newId, removeItem, setStatus, upsertConnection, upsertItems } from "./ops";
import type { ReconIssue, ResolutionOption } from "../reconcile";
import { passportStore, type PassportStore } from "./store";

/**
 * High-level Passport actions used by the UI. Every change is recorded in
 * the patient's activity log.
 */

/** Items the patient entered themselves: saved as confirmed straight away. */
export async function addEntries<C extends CollectionName>(
  patientId: PatientId,
  collection: C,
  items: CollectionTypes[C][],
  summary?: string,
  store: PassportStore = passportStore,
): Promise<void> {
  await store.update(patientId, (p, at) => {
    const next = upsertItems(p, collection, items, "confirmed", at);
    const label = items.length === 1 ? COLLECTION_LABELS[collection].one : `${items.length} ${COLLECTION_LABELS[collection].many}`;
    return appendActivity(next, "add", summary ?? `Added ${label}`, at, items[0]?.source.kind);
  });
}

/** Edit an existing item (seed or local). The edit is confirmed immediately. */
export async function editEntry<C extends CollectionName>(
  patientId: PatientId,
  collection: C,
  item: CollectionTypes[C],
  summary?: string,
  store: PassportStore = passportStore,
): Promise<void> {
  await store.update(patientId, (p, at) =>
    appendActivity(upsertItems(p, collection, [item], "confirmed", at), "edit", summary ?? `Edited ${COLLECTION_LABELS[collection].one}`, at, item.source.kind),
  );
}

/** Imported items wait for review ("pending") and are not used in analysis until confirmed. */
export async function importForReview(
  patientId: PatientId,
  batch: Partial<{ [C in CollectionName]: CollectionTypes[C][] }>,
  sourceKind: SourceKind,
  sourceName: string,
  store: PassportStore = passportStore,
): Promise<void> {
  await store.update(patientId, (p, at) => {
    let next = p;
    const counts: Partial<Record<CollectionName, number>> = {};
    for (const [collection, items] of Object.entries(batch) as [CollectionName, CollectionTypes[CollectionName][]][]) {
      if (!items?.length) continue;
      next = upsertItems(next, collection, items, "pending", at);
      counts[collection] = items.length;
    }
    return appendActivity(next, "import", `Imported from ${sourceName} for review: ${describeCounts(counts)}`, at, sourceKind);
  });
}

/**
 * Several collections the patient has just reviewed and confirmed on one
 * screen (e.g. rows from a scanned document) — one change, one log entry.
 */
export async function addReviewedBatch(
  patientId: PatientId,
  batch: Partial<{ [C in CollectionName]: CollectionTypes[C][] }>,
  summary: string,
  sourceKind: SourceKind,
  store: PassportStore = passportStore,
): Promise<void> {
  await store.update(patientId, (p, at) => {
    let next = p;
    for (const [collection, items] of Object.entries(batch) as [CollectionName, CollectionTypes[CollectionName][]][]) {
      if (items?.length) next = upsertItems(next, collection, items, "confirmed", at);
    }
    return appendActivity(next, "import", summary, at, sourceKind);
  });
}

export async function confirmEntry(patientId: PatientId, collection: CollectionName, id: string, store: PassportStore = passportStore): Promise<void> {
  await store.update(patientId, (p, at) => {
    const e = p.entries.find((x) => x.collection === collection && x.item.id === id);
    if (!e) return p;
    return appendActivity(setStatus(p, collection, id, "confirmed", at), "confirm", `Confirmed ${COLLECTION_LABELS[collection].one}: ${describeItem(e.item)}`, at, e.item.source.kind);
  });
}

export async function discardEntry(patientId: PatientId, collection: CollectionName, id: string, store: PassportStore = passportStore): Promise<void> {
  await store.update(patientId, (p, at) => {
    const e = p.entries.find((x) => x.collection === collection && x.item.id === id);
    if (!e) return p;
    return appendActivity(setStatus(p, collection, id, "discarded", at), "discard", `Discarded ${COLLECTION_LABELS[collection].one}: ${describeItem(e.item)}`, at, e.item.source.kind);
  });
}

export async function removeEntry<C extends CollectionName>(patientId: PatientId, collection: C, item: CollectionTypes[C], store: PassportStore = passportStore): Promise<void> {
  await store.update(patientId, (p, at) =>
    appendActivity(removeItem(p, collection, item, at), "edit", `Removed ${COLLECTION_LABELS[collection].one}: ${describeItem(item)}`, at, item.source.kind),
  );
}

export async function recordActivity(
  patientId: PatientId,
  action: ActivityEntry["action"],
  summary: string,
  sourceKind?: SourceKind,
  store: PassportStore = passportStore,
): Promise<void> {
  await store.update(patientId, (p, at) => appendActivity(p, action, summary, at, sourceKind));
}

export async function saveConnection(patientId: PatientId, connection: SourceConnection, store: PassportStore = passportStore): Promise<void> {
  await store.update(patientId, (p) => upsertConnection(p, connection));
}

/** "Reset demo data": forget everything stored on this device. Seed personas remain. */
export async function resetDemoData(patientId?: PatientId, store: PassportStore = passportStore): Promise<void> {
  await store.reset(patientId);
}

/** A short human description of any Passport item, for logs and review lists. */
export function describeItem(item: CollectionTypes[CollectionName]): string {
  const i = item as unknown as Record<string, unknown>;
  const first = (...keys: string[]) => keys.map((k) => i[k]).find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  if ("dose" in i && "frequency" in i) return `${i.name} ${i.dose}`;
  if ("value" in i && "unit" in i) return `${i.name} ${i.value}${i.unit ? ` ${i.unit}` : ""}`;
  if ("instrument" in i) return `${i.instrument} score ${i.score}`;
  if ("systolic" in i && i.systolic) return `BP ${i.systolic}/${i.diastolic}`;
  return first("name", "title", "substance", "vaccine", "reason", "symptom", "description", "dietaryPattern") ?? "item";
}

/**
 * Apply the patient's choice for a reconciliation issue: keep one entry
 * (removing or discarding the others), acknowledge, mark a medicine stopped,
 * or flag it to ask a clinician. One change, one activity-log entry.
 */
export async function resolveReconIssue(
  patientId: PatientId,
  issue: ReconIssue,
  option: ResolutionOption,
  stoppedOn: string,
  store: PassportStore = passportStore,
): Promise<void> {
  await store.update(patientId, (p, at) => {
    let next = p;
    const eff = option.effect;
    if (eff.type === "keep-only") {
      for (const e of issue.medications) {
        if (e.item.id === eff.keepId) {
          if (e.state === "pending") next = setStatus(next, "medications", e.item.id, "confirmed", at);
        } else if (e.state === "pending") next = setStatus(next, "medications", e.item.id, "discarded", at);
        else next = removeItem(next, "medications", e.item, at);
      }
    } else if (eff.type === "acknowledge") {
      for (const e of issue.medications) if (e.state === "pending") next = setStatus(next, "medications", e.item.id, "confirmed", at);
    } else if (eff.type === "mark-stopped") {
      const med = issue.medications.find((e) => e.item.id === eff.medicationId)?.item;
      if (med) {
        const stopped = { ...med, status: "stopped" as const, stoppedOn, source: { ...med.source, kind: "patient-entered" as const, label: `Updated by you (was: ${med.source.label})`, importedAt: at, verified: true } };
        next = upsertItems(next, "medications", [stopped], "confirmed", at);
        next = upsertItems(next, "medicationHistory", [{ id: newId("e-you"), patientId, date: stoppedOn, medicationName: med.name, type: "stopped", detail: `${med.name} stopped (recorded while reconciling your records).`, source: stopped.source }], "confirmed", at);
      }
    }
    next = addResolution(next, { issueId: issue.id, choice: option.id, summary: `${issue.title} — ${option.label}`, at, askClinician: eff.type === "ask-clinician" });
    return appendActivity(next, "edit", `Reconciled: ${issue.title} — ${option.label}`, at, issue.medications[0]?.item.source.kind ?? issue.allergies[0]?.item.source.kind);
  });
}
