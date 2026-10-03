import type { PatientRecord, RiskCategory, RiskFlag } from "../../types";

export interface RuleContext {
  /** The moment the evaluation is running "as of". */
  now: Date;
}

export interface RuleDefinition {
  id: string;
  category: RiskCategory;
  name: string;
  /** Plain-language description shown in the "how this works" panel. */
  description: string;
  evaluate: (record: PatientRecord, ctx: RuleContext) => RiskFlag[];
}

/* ---- Small shared helpers ------------------------------------------------ */

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Entries from the last `days` calendar days, counting today as day 1
 * (so "last 14 days" is today plus the 13 days before it).
 */
export function withinLastDays<T extends { timestamp: string }>(items: T[], days: number, now: Date): T[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const cutoff = start.getTime();
  return items.filter((i) => new Date(i.timestamp).getTime() >= cutoff);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function makeFlag(
  partial: Omit<RiskFlag, "id" | "detectedAt">,
  ctx: RuleContext,
): RiskFlag {
  return {
    ...partial,
    id: `${partial.ruleId}:${partial.patientId}:${partial.medications.join("+")}`,
    detectedAt: ctx.now.toISOString(),
  };
}
