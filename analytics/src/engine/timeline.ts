/**
 * 6.1 Unified timeline: one chronological list of everything in the snapshot
 * (including unconfirmed items, flagged used_in_analysis=false), plus daily
 * aggregated series built from analysed (confirmed, reconciled) data only.
 */
import type { Finding, HolisticAnalysisBundle, TimelineEvent, UrgentItem } from "../model/bundle";
import { DAILY_SERIES } from "../model/bundle";
import type { Ctx } from "./context";
import { sortedEvents } from "../knowledge/drugs";
import { dayKey, round, toMs } from "../util/dates";
import analysisConfig from "../../config/analysis.json";

type Sev = Finding["severity"];
const RANK: Record<Sev, number> = { urgent: 4, high: 3, moderate: 2, low: 1 };

export function buildTimeline(ctx: Ctx, findings: Finding[], urgent: UrgentItem[]): HolisticAnalysisBundle["timeline"] {
  const s = ctx.p.snapshot;
  // Item id -> highest severity / rule ids that cited it as evidence.
  const flagged = new Map<string, { severity: Sev; rules: Set<string> }>();
  const mark = (itemId: string, sev: Sev, rules: string[]) => {
    const cur = flagged.get(itemId) ?? { severity: sev, rules: new Set<string>() };
    if (RANK[sev] > RANK[cur.severity]) cur.severity = sev;
    rules.forEach((r) => cur.rules.add(r));
    flagged.set(itemId, cur);
  };
  for (const f of findings) for (const e of f.evidence) mark(e.item_id, f.severity, f.rule_ids);
  for (const u of urgent) for (const e of u.evidence) mark(e.item_id, "urgent", u.rule_ids);

  const used = new Set<string>([
    ...ctx.p.medications, ...ctx.p.labs, ...ctx.p.vitals, ...ctx.p.symptoms, ...ctx.p.dietLogs,
    ...ctx.p.mood, ...ctx.p.adherence, ...ctx.p.events, ...ctx.p.carePlan,
  ].map((x) => x.id));
  const analysed = new Map<string, { value?: number; unit?: string; systolic?: number; diastolic?: number }>(
    [...ctx.p.labs, ...ctx.p.vitals].map((x) => [x.id, x]),
  );

  const events: TimelineEvent[] = [];
  const push = (e: Omit<TimelineEvent, "severity" | "rule_ids" | "used_in_analysis"> & { item_id: string }) => {
    if (toMs(e.at) > ctx.asOf) return;
    const f = flagged.get(e.item_id);
    const { item_id, ...rest } = e;
    events.push({ ...rest, used_in_analysis: used.has(item_id), severity: f?.severity ?? null, rule_ids: f ? [...f.rules].sort() : [] });
  };

  for (const m of s.medications) {
    for (const [i, ev] of sortedEvents(m).entries()) {
      push({ item_id: m.id, event_id: `${m.id}#${i}`, at: ev.date, category: ev.type === "start" ? "medication_start" : ev.type === "change" ? "medication_change" : "medication_stop",
        element_id: m.element_id, label: `${m.name}${ev.detail ? `: ${ev.detail}` : ""}`, value: null, unit: null, source: m.provenance.source, confirmed: m.provenance.confirmed });
    }
  }
  for (const l of s.labs) {
    const n = analysed.get(l.id);
    push({ item_id: l.id, event_id: l.id, at: l.date, category: "lab", element_id: l.element_id, label: l.analyte, value: n?.value ?? l.value, unit: n?.unit ?? l.unit, source: l.provenance.source, confirmed: l.provenance.confirmed });
  }
  for (const v of s.vitals) {
    const n = analysed.get(v.id);
    if (v.kind === "blood_pressure") {
      push({ item_id: v.id, event_id: v.id, at: v.datetime, category: "blood_pressure", element_id: v.element_id, label: "blood pressure", value: `${n?.systolic ?? v.systolic}/${n?.diastolic ?? v.diastolic}`, unit: "mmHg", source: v.provenance.source, confirmed: v.provenance.confirmed });
    } else {
      push({ item_id: v.id, event_id: v.id, at: v.datetime, category: v.kind === "weight" ? "weight" : "heart_rate", element_id: v.element_id, label: v.kind === "weight" ? "body weight" : "resting heart rate", value: n?.value ?? v.value ?? null, unit: n?.unit ?? v.unit, source: v.provenance.source, confirmed: v.provenance.confirmed });
    }
  }
  for (const c of s.symptoms) {
    push({ item_id: c.id, event_id: c.id, at: c.datetime, category: "symptom", element_id: c.element_id, label: c.reported.length ? c.reported.join(", ") : "symptom check: none reported", value: null, unit: null, source: c.provenance.source, confirmed: c.provenance.confirmed });
  }
  for (const d of s.diet_logs) {
    push({ item_id: d.id, event_id: d.id, at: d.date, category: "diet", element_id: d.element_id, label: d.tags.length ? d.tags.join(", ") : "meal log: no risk tags", value: d.tags.length, unit: "risk tags", source: d.provenance.source, confirmed: d.provenance.confirmed });
  }
  for (const m of s.mood) {
    push({ item_id: m.id, event_id: m.id, at: m.date, category: "mood", element_id: m.element_id, label: m.instrument, value: m.score, unit: "points", source: m.provenance.source, confirmed: m.provenance.confirmed });
  }
  const medName = new Map(s.medications.map((m) => [m.id, m.name]));
  for (const a of s.adherence) {
    for (const x of a.missed) {
      push({ item_id: `${a.id}:${x.medication_id}@${x.date}`, event_id: `${a.id}:${x.medication_id}@${x.date}`, at: x.date, category: "missed_dose", element_id: a.element_id,
        label: `missed ${medName.get(x.medication_id) ?? x.medication_id} (${x.note ?? x.reason})`, value: 1, unit: "doses", source: a.provenance.source, confirmed: a.provenance.confirmed });
    }
  }
  // Missed-dose evidence uses composite ids; mark them used when their report is used.
  for (const e of events) if (e.category === "missed_dose") e.used_in_analysis = used.has(e.event_id.split(":")[0]!);
  for (const e of s.events) {
    const cat = e.type === "er_visit" ? "er_visit" : e.type === "fall" ? "fall" : "hospital_admission";
    push({ item_id: e.id, event_id: e.id, at: e.start, category: cat, element_id: e.element_id, label: `${e.type.replace("_", " ")}${e.reason ? `: ${e.reason}` : ""}`, value: null, unit: null, source: e.provenance.source, confirmed: e.provenance.confirmed });
    if (e.type === "hospitalization" && e.end) {
      push({ item_id: e.id, event_id: `${e.id}#discharge`, at: e.end, category: "hospital_discharge", element_id: e.element_id, label: "hospital discharge", value: null, unit: null, source: e.provenance.source, confirmed: e.provenance.confirmed });
    }
  }
  for (const t of s.care_plan) {
    push({ item_id: t.id, event_id: t.id, at: t.set_on, category: "care_plan", element_id: t.element_id, label: `care-plan ${t.target.replace(/_/g, " ")}`, value: t.value ?? (t.systolic !== undefined ? `${t.systolic}/${t.diastolic}` : null), unit: t.unit, source: t.provenance.source, confirmed: t.provenance.confirmed });
  }
  events.sort((a, b) => toMs(a.at) - toMs(b.at) || a.event_id.localeCompare(b.event_id));
  return { events, daily_series: dailySeries(ctx) };
}

function dailySeries(ctx: Ctx): HolisticAnalysisBundle["timeline"]["daily_series"] {
  const buckets = Object.fromEntries(DAILY_SERIES.map((k) => [k, new Map<string, number[]>()])) as Record<(typeof DAILY_SERIES)[number], Map<string, number[]>>;
  const add = (series: (typeof DAILY_SERIES)[number], at: string, value: number) => {
    if (toMs(at) > ctx.asOf) return;
    const d = dayKey(at);
    const b = buckets[series];
    b.set(d, [...(b.get(d) ?? []), value]);
  };
  const vitals = [...ctx.p.vitals].sort((a, b) => toMs(a.datetime) - toMs(b.datetime));
  for (const v of vitals) {
    if (v.kind === "weight") add("weight_kg", v.datetime, v.value!);
    if (v.kind === "blood_pressure") { add("systolic_mmhg", v.datetime, v.systolic!); add("diastolic_mmhg", v.datetime, v.diastolic!); }
    if (v.kind === "heart_rate") add("heart_rate_bpm", v.datetime, v.value!);
  }
  for (const m of ctx.p.mood) if (m.instrument === "PHQ-9") add("phq9_score", m.date, m.score);
  for (const d of ctx.p.dietLogs) add("diet_risk_tags", d.date, d.tags.length);
  for (const a of ctx.p.adherence) for (const x of a.missed) add("missed_doses", x.date, 1);

  const reduce = (series: (typeof DAILY_SERIES)[number], values: number[]): number => {
    if (series === "weight_kg" && analysisConfig.timeline.weight_daily === "first") return values[0]!;
    if (series === "diet_risk_tags" || series === "missed_doses") return values.reduce((a, b) => a + b, 0);
    return round(values.reduce((a, b) => a + b, 0) / values.length, 1);
  };
  return Object.fromEntries(
    DAILY_SERIES.map((k) => [k, [...buckets[k].entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, value: reduce(k, values), n: values.length }))]),
  ) as HolisticAnalysisBundle["timeline"]["daily_series"];
}
