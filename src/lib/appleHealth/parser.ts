import type { DataSource, PatientId, VitalSign } from "../types";

/**
 * STREAMING APPLE HEALTH PARSER
 *
 * Reads export.xml as a text stream and scans for <Record …> elements
 * chunk by chunk, so memory stays flat even for multi-gigabyte exports.
 * Only the types Parthia uses are kept, and they're aggregated per day:
 *
 *   HKQuantityTypeIdentifierHeartRate            → daily mean heart rate
 *   HKQuantityTypeIdentifierRestingHeartRate     → resting heart rate
 *   HKQuantityTypeIdentifierBloodPressureSystolic/Diastolic → each reading
 *   HKQuantityTypeIdentifierStepCount            → daily steps
 *   HKCategoryTypeIdentifierSleepAnalysis        → hours asleep per night
 *   HKQuantityTypeIdentifierBodyMass             → weight
 *
 * The Health app can hold the same data from several devices (iPhone and
 * Watch both count steps); for steps and sleep we keep the busiest source per
 * day rather than adding them up, which is close to what the Health app shows.
 */

export interface AppleHealthOptions {
  patientId: PatientId;
  /** Keep records on or after this date (YYYY-MM-DD). */
  since: string;
  /** Keep records on or before this date (YYYY-MM-DD). */
  until?: string;
  sourceLabel?: string;
  importedAt?: string;
  onProgress?: (bytesRead: number) => void;
}

export interface AppleHealthCounts {
  recordsSeen: number;
  recordsInRange: number;
  heartRate: number;
  restingHeartRate: number;
  bloodPressure: number;
  steps: number;
  sleep: number;
  bodyMass: number;
}

export interface AppleHealthResult {
  vitals: VitalSign[];
  counts: AppleHealthCounts;
  firstDate?: string;
  lastDate?: string;
  exportDate?: string;
  sources: string[];
}

const T = {
  hr: "HKQuantityTypeIdentifierHeartRate",
  rhr: "HKQuantityTypeIdentifierRestingHeartRate",
  sys: "HKQuantityTypeIdentifierBloodPressureSystolic",
  dia: "HKQuantityTypeIdentifierBloodPressureDiastolic",
  steps: "HKQuantityTypeIdentifierStepCount",
  mass: "HKQuantityTypeIdentifierBodyMass",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
} as const;
const WANTED = new Set<string>(Object.values(T));
const ASLEEP = /HKCategoryValueSleepAnalysisAsleep/; // Asleep, AsleepCore, AsleepDeep, AsleepREM, AsleepUnspecified

/** "2026-09-10 07:12:00 -0400" → "2026-09-10T07:12:00" (local wall-clock time). */
export function appleLocal(ts: string): string {
  return ts.slice(0, 19).replace(" ", "T");
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

interface Day {
  hrSum: number;
  hrN: number;
  rhr?: number;
  stepsBySource: Map<string, number>;
  sleepBySource: Map<string, number>;
  massKg?: number;
}

/** Scan a text stream of export.xml. */
export async function parseAppleHealth(text: AsyncIterable<string>, opts: AppleHealthOptions): Promise<AppleHealthResult> {
  const days = new Map<string, Day>();
  const bp = new Map<string, { sys?: number; dia?: number; source: string }>();
  const counts: AppleHealthCounts = { recordsSeen: 0, recordsInRange: 0, heartRate: 0, restingHeartRate: 0, bloodPressure: 0, steps: 0, sleep: 0, bodyMass: 0 };
  const sources = new Set<string>();
  let exportDate: string | undefined;
  const day = (d: string) => {
    if (!days.has(d)) days.set(d, { hrSum: 0, hrN: 0, stepsBySource: new Map(), sleepBySource: new Map() });
    return days.get(d)!;
  };
  const inRange = (d: string) => d >= opts.since && (!opts.until || d <= opts.until);

  function handle(tag: string) {
    const a = parseAttrs(tag);
    counts.recordsSeen++;
    if (!WANTED.has(a.type)) return;
    const start = appleLocal(a.startDate ?? "");
    const end = appleLocal(a.endDate ?? a.startDate ?? "");
    const date = (a.type === T.sleep ? end : start).slice(0, 10);
    if (!inRange(date)) return;
    counts.recordsInRange++;
    const src = a.sourceName ?? "Health";
    sources.add(src);
    const v = Number(a.value);
    switch (a.type) {
      case T.hr: { const d = day(date); d.hrSum += v; d.hrN++; counts.heartRate++; break; }
      case T.rhr: { day(date).rhr = v; counts.restingHeartRate++; break; }
      case T.steps: { const d = day(date); d.stepsBySource.set(src, (d.stepsBySource.get(src) ?? 0) + v); counts.steps++; break; }
      case T.mass: { day(date).massKg = a.unit === "lb" ? Math.round(v * 4.5359237) / 10 : v; counts.bodyMass++; break; }
      case T.sleep: {
        if (!ASLEEP.test(a.value ?? "")) break;
        const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
        if (hours > 0 && hours < 16) { const d = day(date); d.sleepBySource.set(src, (d.sleepBySource.get(src) ?? 0) + hours); counts.sleep++; }
        break;
      }
      case T.sys:
      case T.dia: {
        // The same reading appears both inside a BP <Correlation> and on its own; key by time.
        const r = bp.get(start) ?? { source: src };
        if (a.type === T.sys) r.sys = v;
        else r.dia = v;
        bp.set(start, r);
        break;
      }
    }
  }

  let buf = "";
  for await (const chunk of text) {
    buf += chunk;
    if (!exportDate) {
      const m = /<ExportDate value="([^"]+)"/.exec(buf);
      if (m) exportDate = appleLocal(m[1]);
    }
    let i = 0;
    while (true) {
      const s = buf.indexOf("<Record ", i);
      if (s < 0) {
        // Keep only a possible partial "<Record" at the very end.
        buf = buf.slice(Math.max(i, buf.length - 8));
        break;
      }
      const e = buf.indexOf(">", s);
      if (e < 0) {
        buf = buf.slice(s); // incomplete tag — wait for the next chunk
        break;
      }
      handle(buf.slice(s, e + 1));
      i = e + 1;
    }
  }

  const label = opts.sourceLabel ?? "Apple Health";
  const source: DataSource = { kind: "wearable", label, importedAt: opts.importedAt ?? new Date().toISOString(), verified: false };
  const vitals: VitalSign[] = [];
  for (const [date, d] of [...days.entries()].sort()) {
    const steps = d.stepsBySource.size ? Math.round(Math.max(...d.stepsBySource.values())) : undefined;
    const sleepHours = d.sleepBySource.size ? Math.round(Math.max(...d.sleepBySource.values()) * 10) / 10 : undefined;
    const heartRate = d.hrN ? Math.round(d.hrSum / d.hrN) : undefined;
    if (steps === undefined && sleepHours === undefined && heartRate === undefined && d.rhr === undefined && d.massKg === undefined) continue;
    vitals.push({ id: `ah-day-${date}`, patientId: opts.patientId, timestamp: `${date}T23:59:00`, steps, sleepHours, heartRate, restingHeartRate: d.rhr, weightKg: d.massKg, source });
  }
  for (const [ts, r] of [...bp.entries()].sort()) {
    if (r.sys === undefined || r.dia === undefined) continue;
    counts.bloodPressure++;
    vitals.push({ id: `ah-bp-${ts}`, patientId: opts.patientId, timestamp: ts, systolic: r.sys, diastolic: r.dia, bpSetting: "home-cuff", source: { ...source, originalText: `Blood pressure from ${r.source}` } });
  }
  const dates = vitals.map((v) => v.timestamp.slice(0, 10)).sort();
  return { vitals, counts, firstDate: dates[0], lastDate: dates[dates.length - 1], exportDate, sources: [...sources] };
}

/** Turn a byte stream into a text stream, reporting bytes read. */
export async function* decodeWithProgress(stream: ReadableStream<Uint8Array>, onProgress?: (bytes: number) => void): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    onProgress?.(bytes);
    yield decoder.decode(value, { stream: true });
  }
  const rest = decoder.decode();
  if (rest) yield rest;
}
