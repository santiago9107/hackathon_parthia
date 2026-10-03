import type { Allergy, PatientRecord } from "../types";
import { lookupDrug } from "../terminology/medications";
import { COLLECTION_LABELS, type CollectionName, type CollectionTypes } from "./collections";
import { recordItems } from "./items";

/**
 * Plan an import: compare incoming items with what's already in the Passport
 * and drop exact duplicates, so re-importing (or importing a record that
 * overlaps the Passport) doesn't create copies. Items that are the same thing
 * with DIFFERENT details (e.g. a medication at another dose) are kept — those
 * are conflicts for the patient to reconcile, not duplicates.
 */

export type ImportBatch = Partial<{ [C in CollectionName]: CollectionTypes[C][] }>;

export interface ImportPlan {
  batch: ImportBatch;
  duplicates: Partial<Record<CollectionName, number>>;
  newCounts: Partial<Record<CollectionName, number>>;
}

/** "Dr. Amara Nwosu" / "Amara Nwosu, MD" → "amara nwosu" */
export function normPerson(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^dr\.?\s+/, "")
    .replace(/,.*$/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normDose(d: string): string {
  return d.toLowerCase().replace(/\s+/g, "");
}

/** Core schedule words, so "twice daily with meals" == "twice daily". */
export function normFrequency(f: string): string {
  const s = f.toLowerCase();
  const m = s.match(/(once|twice|three times|four times) (daily|weekly)|at bedtime|every \d+ hours/);
  return (m?.[0] ?? s).trim() + (/as needed|prn/.test(s) ? " prn" : "");
}

const STOP = new Set(["and", "or", "the", "a", "of", "allergy", "to", "media"]);
function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[()/,]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));
}

export function sameAllergy(a: Pick<Allergy, "substance">, b: Pick<Allergy, "substance">): boolean {
  const da = lookupDrug(a.substance)?.generic;
  const db = lookupDrug(b.substance)?.generic;
  if (da && db) return da === db;
  const ta = tokens(a.substance);
  for (const t of tokens(b.substance)) if (ta.has(t)) return true;
  return false;
}

/** Identity key per collection (items with equal keys are duplicates). */
function key(c: CollectionName, item: CollectionTypes[CollectionName]): string | null {
  const i = item as unknown as Record<string, unknown>;
  switch (c) {
    case "conditions": return String((i.code as string | undefined)?.toUpperCase() ?? (i.name as string).toLowerCase());
    case "medications": return `${i.genericName}|${normDose(i.dose as string)}|${normFrequency(i.frequency as string)}`;
    case "labs": return `${i.loincCode ?? (i.name as string).toLowerCase()}|${i.date}|${i.value}`;
    case "labPanels": return `${i.code ?? (i.name as string).toLowerCase()}|${i.date}`;
    case "vitals": return `${(i.timestamp as string).slice(0, 16)}|${i.systolic ?? ""}|${i.heartRate ?? ""}|${i.steps ?? ""}|${i.sleepHours ?? ""}|${i.restingHeartRate ?? ""}`;
    case "socialHistory": return `${i.category}|${i.date}`;
    case "assessments": return `${i.instrument}|${i.date}|${i.score}`;
    case "encounters": return `${i.date}|${normPerson(i.clinician as string)}`;
    case "documents": return `${i.date}|${i.type}|${normPerson(i.author as string)}`;
    case "appointments": return `${(i.start as string).slice(0, 16)}|${normPerson(i.clinician as string)}`;
    case "immunizations": return `${i.cvxCode ?? (i.vaccine as string).toLowerCase()}|${i.date}`;
    case "procedures": return `${i.code ?? (i.name as string).toLowerCase()}|${i.date}`;
    case "careTeam": return normPerson(i.name as string);
    case "carePlans": return (i.title as string).toLowerCase();
    case "medicationHistory": return `${i.date}|${(i.medicationName as string).toLowerCase()}|${i.type}`;
    case "symptoms":
    case "moods":
    case "nutrition": return `${i.timestamp}`;
    default: return null; // allergies use a predicate; singletons are never deduplicated
  }
}

export function planImport(incoming: ImportBatch, record: PatientRecord): ImportPlan {
  const existing = recordItems(record);
  const keys = new Map<CollectionName, Set<string>>();
  for (const { collection, item } of existing) {
    const k = key(collection, item as CollectionTypes[CollectionName]);
    if (k === null) continue;
    if (!keys.has(collection)) keys.set(collection, new Set());
    keys.get(collection)!.add(k);
  }

  // Panels that already exist: map incoming panel ids → existing panel ids so new results link up.
  const panelRemap = new Map<string, string>();
  for (const p of incoming.labPanels ?? []) {
    const k = key("labPanels", p);
    const match = record.labPanels.find((x) => key("labPanels", x) === k);
    if (match) panelRemap.set(p.id, match.id);
  }

  const batch: ImportBatch = {};
  const duplicates: Partial<Record<CollectionName, number>> = {};
  const newCounts: Partial<Record<CollectionName, number>> = {};
  for (const [c, items] of Object.entries(incoming) as [CollectionName, CollectionTypes[CollectionName][]][]) {
    if (!items?.length) continue;
    const seen = keys.get(c) ?? new Set<string>();
    const kept: CollectionTypes[CollectionName][] = [];
    for (const raw of items) {
      let item = raw;
      if (c === "labs") {
        const lab = raw as CollectionTypes["labs"];
        if (lab.panelId && panelRemap.has(lab.panelId)) item = { ...lab, panelId: panelRemap.get(lab.panelId) } as CollectionTypes[CollectionName];
      }
      const dup =
        c === "allergies"
          ? record.allergies.some((a) => sameAllergy(a, item as Allergy))
          : (() => {
              const k = key(c, item);
              if (k === null) return false;
              if (seen.has(k)) return true;
              seen.add(k); // also de-duplicate within the incoming batch
              return false;
            })();
      if (dup) duplicates[c] = (duplicates[c] ?? 0) + 1;
      else kept.push(item);
    }
    if (kept.length) {
      (batch as Record<string, unknown>)[c] = kept;
      newCounts[c] = kept.length;
    }
  }
  return { batch, duplicates, newCounts };
}

export function countItems(counts: Partial<Record<CollectionName, number>>): number {
  return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
}

export function describeBatch(counts: Partial<Record<CollectionName, number>>): string[] {
  return Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([c, n]) => `${n} ${n === 1 ? COLLECTION_LABELS[c as CollectionName].one : COLLECTION_LABELS[c as CollectionName].many}`);
}
