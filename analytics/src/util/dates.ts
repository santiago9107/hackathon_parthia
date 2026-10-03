/** Deterministic date helpers. All arithmetic is UTC; calendar dates are UTC midnight. */

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

export function toMs(iso: string): number {
  const ms = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${iso}`);
  return ms;
}

export function dayKey(isoOrMs: string | number): string {
  const ms = typeof isoOrMs === "number" ? isoOrMs : toMs(isoOrMs);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar subtraction for "N months" windows (e.g. 12 months before 2026-10-03 is 2025-10-03). */
export function minusMonths(ms: number, months: number): number {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
}

export function daysBetween(fromMs: number, toMsValue: number): number {
  return (toMsValue - fromMs) / DAY_MS;
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
