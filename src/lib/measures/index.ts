import type { PatientRecord, VitalSign } from "../types";

export interface Measure {
  id: "weight-change-3d" | "weight-change-7d" | "bp-trend-14d" | "hr-trend-14d" | "potassium-trend" | "egfr-trend" | "phq9-change" | "missed-doses-7d";
  label: string;
  value: number | null;
  unit: string;
  window: { from: string; to: string };
  basis: string[];
  status: "ok" | "insufficient-data";
}

const DAY = 86_400_000;
const windowFor = (now: Date, days: number) => ({
  from: new Date(now.getTime() - (days - 1) * DAY).toISOString().slice(0, 10),
  to: now.toISOString().slice(0, 10),
});
function inWindow<T extends { timestamp: string }>(items: T[], now: Date, days: number): T[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime() - (days - 1) * DAY;
  return items.filter((item) => new Date(item.timestamp).getTime() >= from && new Date(item.timestamp).getTime() <= now.getTime());
}
function empty(id: Measure["id"], label: string, unit: string, window: Measure["window"]): Measure {
  return { id, label, value: null, unit, window, basis: [], status: "insufficient-data" };
}
function weightChange(record: PatientRecord, now: Date, days: 3 | 7): Measure {
  const window = windowFor(now, days);
  const readings = inWindow(record.patient.vitals, now, days).filter((v) => v.weightKg !== undefined).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (readings.length < 2 || new Date(readings.at(-1)!.timestamp).getTime() - new Date(readings[0].timestamp).getTime() < 2 * DAY) return empty(`weight-change-${days}d`, `Weight change over ${days} days`, "kg", window);
  return { id: `weight-change-${days}d`, label: `Weight change over ${days} days`, value: Number((readings.at(-1)!.weightKg! - readings[0].weightKg!).toFixed(2)), unit: "kg", window, basis: readings.map((v) => v.id), status: "ok" };
}
function trend(record: PatientRecord, now: Date, kind: "bp" | "hr"): Measure {
  const window = windowFor(now, 14);
  const readings = inWindow(record.patient.vitals, now, 14).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const midpoint = now.getTime() - 7 * DAY;
  const valueOf = (v: VitalSign) => kind === "bp" ? v.systolic : (v.heartRate ?? v.restingHeartRate);
  const before = readings.filter((v) => new Date(v.timestamp).getTime() < midpoint && valueOf(v) !== undefined);
  const after = readings.filter((v) => new Date(v.timestamp).getTime() >= midpoint && valueOf(v) !== undefined);
  const id = kind === "bp" ? "bp-trend-14d" : "hr-trend-14d";
  const label = kind === "bp" ? "Systolic blood-pressure trend over 14 days" : "Heart-rate trend over 14 days";
  const unit = kind === "bp" ? "mmHg" : "bpm";
  if (before.length < 3 || after.length < 3) return empty(id, label, unit, window);
  const mean = (xs: VitalSign[]) => xs.reduce((sum, x) => sum + valueOf(x)!, 0) / xs.length;
  return { id, label, value: Number((mean(after) - mean(before)).toFixed(2)), unit, window, basis: [...before, ...after].map((v) => v.id), status: "ok" };
}
function labTrend(record: PatientRecord, now: Date, name: "Potassium" | "eGFR"): Measure {
  const window = windowFor(now, 365);
  const rows = record.patient.labs.filter((l) => l.name.toLowerCase() === name.toLowerCase() && new Date(l.date).getTime() <= now.getTime()).sort((a, b) => a.date.localeCompare(b.date)).slice(-2);
  const id = name === "Potassium" ? "potassium-trend" : "egfr-trend";
  const unit = name === "Potassium" ? "mmol/L" : "mL/min/1.73m2";
  if (rows.length < 2) return empty(id, `${name} trend`, unit, window);
  return { id, label: `${name} trend`, value: Number((rows[1].value - rows[0].value).toFixed(2)), unit, window: { from: rows[0].date, to: rows[1].date }, basis: rows.map((r) => r.id), status: "ok" };
}
function phq9Change(record: PatientRecord, now: Date): Measure {
  const rows = record.assessments.filter((a) => a.instrument === "PHQ-9" && new Date(a.date).getTime() <= now.getTime()).sort((a, b) => a.date.localeCompare(b.date)).slice(-2);
  const window = windowFor(now, 365);
  if (rows.length < 2) return empty("phq9-change", "PHQ-9 change", "points", window);
  return { id: "phq9-change", label: "PHQ-9 change", value: rows[1].score - rows[0].score, unit: "points", window: { from: rows[0].date, to: rows[1].date }, basis: rows.map((r) => r.id), status: "ok" };
}
export function computeMeasures(record: PatientRecord, now: Date): Measure[] {
  return [weightChange(record, now, 3), weightChange(record, now, 7), trend(record, now, "bp"), trend(record, now, "hr"), labTrend(record, now, "Potassium"), labTrend(record, now, "eGFR"), phq9Change(record, now), empty("missed-doses-7d", "Missed doses over 7 days", "doses", windowFor(now, 7))];
}
