import type { ActivityEntry, ISODateTime, SourceKind } from "../types";
import {
  COLLECTION_LABELS,
  type CollectionName,
  type CollectionTypes,
  type LocalEntry,
  type LocalPassport,
  type ReviewStatus,
  type SourceConnection,
} from "./collections";

/**
 * Pure operations on a LocalPassport. Each returns a NEW passport (never
 * mutates), so the store can swap snapshots and React sees a change.
 */

let counter = 0;
/** Short unique id for locally created items. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function findIndex(p: LocalPassport, collection: CollectionName, id: string): number {
  return p.entries.findIndex((e) => e.collection === collection && e.item.id === id);
}

/**
 * Add or replace items. `status: "pending"` for imports awaiting review,
 * "confirmed" for things the patient entered. Confirmed items are marked
 * verified in their provenance; pending ones are not.
 */
export function upsertItems<C extends CollectionName>(
  p: LocalPassport,
  collection: C,
  items: CollectionTypes[C][],
  status: ReviewStatus,
  at: ISODateTime,
): LocalPassport {
  const entries = [...p.entries];
  for (const raw of items) {
    const item = { ...raw, source: { ...raw.source, verified: status === "confirmed" } } as CollectionTypes[C];
    const entry: LocalEntry = { collection, item, status, updatedAt: at };
    const i = entries.findIndex((e) => e.collection === collection && e.item.id === item.id);
    if (i >= 0) {
      // Never let a re-import bring back something the patient discarded.
      if (entries[i].status === "discarded" && status === "pending") continue;
      entries[i] = entry;
    } else entries.push(entry);
  }
  return { ...p, entries };
}

export function setStatus(p: LocalPassport, collection: CollectionName, id: string, status: ReviewStatus, at: ISODateTime): LocalPassport {
  const i = findIndex(p, collection, id);
  if (i < 0) return p;
  const e = p.entries[i];
  const entries = [...p.entries];
  entries[i] = { ...e, status, updatedAt: at, item: { ...e.item, source: { ...e.item.source, verified: status === "confirmed" } } };
  return { ...p, entries };
}

/** Remove an item from the Passport (works for seed items too: records a tombstone). */
export function removeItem<C extends CollectionName>(p: LocalPassport, collection: C, item: CollectionTypes[C], at: ISODateTime): LocalPassport {
  const i = findIndex(p, collection, item.id);
  const entries = [...p.entries];
  const tomb: LocalEntry = { collection, item, status: "confirmed", updatedAt: at, removed: true };
  if (i >= 0) entries[i] = tomb;
  else entries.push(tomb);
  return { ...p, entries };
}

export function pendingEntries(p: LocalPassport | undefined): LocalEntry[] {
  return p ? p.entries.filter((e) => e.status === "pending" && !e.removed) : [];
}

export function appendActivity(
  p: LocalPassport,
  action: ActivityEntry["action"],
  summary: string,
  at: ISODateTime,
  sourceKind?: SourceKind,
): LocalPassport {
  const entry: ActivityEntry = { id: newId("act"), patientId: p.patientId, at, action, summary, sourceKind };
  return { ...p, activity: [entry, ...p.activity] };
}

export function upsertConnection(p: LocalPassport, connection: SourceConnection): LocalPassport {
  const others = p.connections.filter((c) => c.id !== connection.id);
  return { ...p, connections: [...others, connection] };
}

/** "3 medications, 1 allergy" — used in activity summaries. */
export function describeCounts(counts: Partial<Record<CollectionName, number>>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([c, n]) => `${n} ${n === 1 ? COLLECTION_LABELS[c as CollectionName].one : COLLECTION_LABELS[c as CollectionName].many}`);
  return parts.length ? parts.join(", ") : "nothing";
}
