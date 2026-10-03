import type { DataSource, PatientRecord, SourceKind } from "../types";

/**
 * One chronological view of everything in the Passport: visits, labs,
 * medication changes, appointments, screenings, device readings, documents,
 * immunizations and procedures. Daily logs (meals, mood, symptoms) are
 * collapsed into one row per day so they don't drown out the rest.
 */
export type TimelineCategory =
  | "visit"
  | "lab"
  | "medication"
  | "appointment"
  | "screening"
  | "reading"
  | "document"
  | "immunization"
  | "procedure"
  | "daily-log";

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  visit: "Visits",
  lab: "Labs",
  medication: "Medication changes",
  appointment: "Appointments",
  screening: "Screenings",
  reading: "Readings",
  document: "Documents",
  immunization: "Immunizations",
  procedure: "Procedures",
  "daily-log": "Daily logs",
};

export interface TimelineEvent {
  id: string;
  /** ISO date or date-time; used for sorting and grouping. */
  when: string;
  category: TimelineCategory;
  title: string;
  detail?: string;
  /** Provenance of the underlying item(s). A day of logs may mix sources. */
  sources: DataSource[];
  /** Where to see more, if anywhere. */
  href?: string;
  upcoming?: boolean;
}

function readingTitle(v: PatientRecord["patient"]["vitals"][number]): string {
  const parts: string[] = [];
  if (v.systolic) parts.push(`BP ${v.systolic}/${v.diastolic}`);
  if (v.heartRate) parts.push(`HR ${v.heartRate}`);
  if (v.restingHeartRate) parts.push(`resting HR ${v.restingHeartRate}`);
  if (v.weightKg) parts.push(`${v.weightKg} kg`);
  if (v.steps !== undefined) parts.push(`${v.steps.toLocaleString("en-US")} steps`);
  if (v.sleepHours !== undefined) parts.push(`${v.sleepHours} h sleep`);
  return parts.join(" · ") || "Reading";
}

export function buildTimeline(record: PatientRecord, now: Date): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const nowIso = now.toISOString().slice(0, 19);
  const { patient } = record;

  for (const e of record.encounters) {
    events.push({ id: e.id, when: e.date, category: "visit", title: `${e.specialty} visit — ${e.clinician}`, detail: e.reason, sources: [e.source], href: "/passport/appointments/" });
  }
  for (const a of record.appointments) {
    // Past appointments are represented by their visit summary when there is one.
    if (a.status === "fulfilled" && a.encounterId) continue;
    events.push({
      id: a.id, when: a.start, category: "appointment",
      title: `${a.status === "booked" ? "Upcoming" : a.status === "cancelled" ? "Cancelled" : "Appointment"}: ${a.specialty} — ${a.clinician}`,
      detail: a.reason, sources: [a.source], href: "/passport/appointments/", upcoming: a.start > nowIso,
    });
  }
  const panels = new Map(record.labPanels.map((p) => [p.id, p]));
  const byPanel = new Map<string, typeof patient.labs>();
  for (const l of patient.labs) {
    const k = l.panelId ?? `${l.date}:${l.name}`;
    byPanel.set(k, [...(byPanel.get(k) ?? []), l]);
  }
  for (const [k, labs] of byPanel) {
    const p = panels.get(k);
    events.push({
      id: `tl-${k}`, when: p?.date ?? labs[0].date, category: "lab", title: p?.name ?? labs[0].name,
      detail: labs.map((l) => `${l.name} ${l.value}${l.unit ? ` ${l.unit}` : ""}${l.status !== "normal" ? ` (${l.status})` : ""}`).join(" · "),
      sources: [p?.source ?? labs[0].source], href: "/passport/clinical/",
    });
  }
  for (const m of patient.medicationHistory) {
    events.push({ id: m.id, when: m.date, category: "medication", title: `${m.medicationName} ${m.type.replace("-", " ")}`, detail: m.detail, sources: [m.source], href: "/passport/medications/" });
  }
  for (const a of record.assessments) {
    events.push({ id: a.id, when: a.date, category: "screening", title: `${a.instrument}: ${a.score} (${a.severity})`, detail: a.administeredBy === "self" ? "Self-completed screening" : "Completed with a clinician", sources: [a.source], href: "/passport/mental-health/" });
  }
  for (const v of patient.vitals) {
    events.push({ id: v.id, when: v.timestamp, category: "reading", title: readingTitle(v), detail: v.bpSetting ? `Measured: ${v.bpSetting.replace("-", " ")}` : undefined, sources: [v.source], href: "/passport/clinical/" });
  }
  for (const d of record.documents) {
    events.push({ id: d.id, when: d.date, category: "document", title: d.title, detail: d.author, sources: [d.source], href: "/passport/documents/" });
  }
  for (const i of record.immunizations) {
    events.push({ id: i.id, when: i.date, category: "immunization", title: i.vaccine, detail: i.doseNote ?? i.performer, sources: [i.source], href: "/passport/clinical/" });
  }
  for (const p of record.procedures) {
    events.push({ id: p.id, when: p.date, category: "procedure", title: p.name, detail: p.outcome, sources: [p.source], href: "/passport/clinical/" });
  }

  // Daily logs: one row per day.
  const days = new Map<string, { meals: number; moods: number[]; symptoms: string[]; sources: Map<SourceKind, DataSource> }>();
  const day = (ts: string) => {
    const k = ts.slice(0, 10);
    if (!days.has(k)) days.set(k, { meals: 0, moods: [], symptoms: [], sources: new Map() });
    return days.get(k)!;
  };
  for (const n of record.nutrition) {
    const d = day(n.timestamp);
    d.meals++;
    d.sources.set(n.source.kind, n.source);
  }
  for (const m of record.moods) {
    const d = day(m.timestamp);
    d.moods.push(m.score);
    d.sources.set(m.source.kind, m.source);
  }
  for (const s of record.symptoms) {
    const d = day(s.timestamp);
    d.symptoms.push(s.symptom);
    d.sources.set(s.source.kind, s.source);
  }
  for (const [date, d] of days) {
    const parts: string[] = [];
    if (d.meals) parts.push(`${d.meals} meal${d.meals === 1 ? "" : "s"}`);
    if (d.moods.length) parts.push(`mood ${d.moods[d.moods.length - 1]}/5`);
    if (d.symptoms.length) parts.push(`${d.symptoms.length} symptom${d.symptoms.length === 1 ? "" : "s"}`);
    events.push({
      id: `tl-day-${date}`, when: `${date}T23:59:00`, category: "daily-log", title: `Daily log: ${parts.join(", ")}`,
      detail: d.symptoms.length ? [...new Set(d.symptoms)].join(", ") : undefined, sources: [...d.sources.values()], href: "/trends/",
    });
  }

  return events.sort((a, b) => b.when.localeCompare(a.when) || a.title.localeCompare(b.title));
}

export interface TimelineFilter {
  categories?: TimelineCategory[];
  sourceKinds?: SourceKind[];
}

export function filterTimeline(events: TimelineEvent[], f: TimelineFilter): TimelineEvent[] {
  return events.filter(
    (e) =>
      (!f.categories?.length || f.categories.includes(e.category)) &&
      (!f.sourceKinds?.length || e.sources.some((s) => f.sourceKinds!.includes(s.kind))),
  );
}
