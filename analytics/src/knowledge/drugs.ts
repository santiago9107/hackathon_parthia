import type { Knowledge } from "./index";
import type { Medication } from "../model/snapshot";
import { toMs } from "../util/dates";

/** True when the medicine contains every ingredient of at least one member of the group. */
export function inGroup(k: Knowledge, med: Medication, group: string): boolean {
  const members = k.drugGroups.get(group);
  if (!members) throw new Error(`Unknown drug group: ${group}`);
  const ing = new Set(med.ingredients.map((i) => i.toLowerCase()));
  return members.some((m) => m.every((x) => ing.has(x)));
}

export function inAnyGroup(k: Knowledge, med: Medication, groups: string[]): boolean {
  return groups.some((g) => inGroup(k, med, g));
}

export function sortedEvents(med: Medication) {
  return [...med.events].sort((a, b) => toMs(a.date) - toMs(b.date));
}

/** Active at time t: the latest event on or before t is a start or change. */
export function isActive(med: Medication, t: number): boolean {
  const past = sortedEvents(med).filter((e) => toMs(e.date) <= t);
  const last = past[past.length - 1];
  return !!last && last.type !== "stop";
}

/** Date of the most recent start or change event on or before t (ms), or null. */
export function lastStartOrChange(med: Medication, t: number): number | null {
  const past = sortedEvents(med).filter((e) => e.type !== "stop" && toMs(e.date) <= t);
  const last = past[past.length - 1];
  return last ? toMs(last.date) : null;
}

/** Most recent stop event on or before t (ms), or null. */
export function lastStop(med: Medication, t: number): number | null {
  const past = sortedEvents(med).filter((e) => e.type === "stop" && toMs(e.date) <= t);
  const last = past[past.length - 1];
  return last ? toMs(last.date) : null;
}
