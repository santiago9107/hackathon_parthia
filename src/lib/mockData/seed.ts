import type { DataSource, Sourced } from "../types";
import { REFERENCE_DATE } from "./reference";

/**
 * Provenance for the bundled synthetic personas. Seed items count as
 * confirmed (they are the demo's starting point) and are labelled
 * "Sample data" everywhere in the UI.
 */
export const SEED_SOURCE: DataSource = Object.freeze({
  kind: "seed",
  label: "Sample data",
  importedAt: `${REFERENCE_DATE}T00:00:00`,
  verified: true,
}) as DataSource;

/** A seed item as written in the data files: everything except provenance. */
export type Unsourced<T extends Sourced> = Omit<T, "source">;

export function seeded<T extends Sourced>(item: Unsourced<T>): T {
  return { ...item, source: SEED_SOURCE } as T;
}

export function seededAll<T extends Sourced>(items: Unsourced<T>[]): T[] {
  return items.map((i) => seeded<T>(i));
}
