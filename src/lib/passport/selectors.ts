import type { LabResult, VitalSign } from "../types";

/**
 * Small, pure helpers for reading a Passport. Lab and vital histories hold
 * many results per test, so "the INR" means the most recent INR.
 */

/** Stable key for "the same test" across sources: LOINC when present, else name. */
export function labKey(lab: Pick<LabResult, "loincCode" | "name">): string {
  return lab.loincCode ?? lab.name.toLowerCase();
}

/** Every result for one test, oldest first. */
export function labHistory(labs: LabResult[], nameOrLoinc: string): LabResult[] {
  const key = nameOrLoinc.toLowerCase();
  return labs
    .filter((l) => l.loincCode === nameOrLoinc || l.name.toLowerCase() === key)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The most recent result for one test. */
export function latestLab(labs: LabResult[], nameOrLoinc: string): LabResult | undefined {
  const h = labHistory(labs, nameOrLoinc);
  return h[h.length - 1];
}

/** The most recent result of every test, newest first. */
export function latestLabs(labs: LabResult[]): LabResult[] {
  const latest = new Map<string, LabResult>();
  for (const l of labs) {
    const k = labKey(l);
    const prev = latest.get(k);
    if (!prev || l.date > prev.date) latest.set(k, l);
  }
  return [...latest.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Most recent vital sign that has a given measurement, e.g. "systolic". */
export function latestVital(vitals: VitalSign[], field: keyof VitalSign = "systolic"): VitalSign | undefined {
  return [...vitals]
    .filter((v) => v[field] !== undefined)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}
