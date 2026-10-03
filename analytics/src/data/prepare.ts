/**
 * Data hygiene before any analysis (Dictionary guide rules 1, 2 and 5).
 *
 * - Only elements defined in the data dictionary are used, and each item's
 *   Element ID must match what it is (a potassium result must be D007).
 * - Only confirmed, reconciled items are used. Others go to needs_review.
 * - Units are normalised to the dictionary unit, using only the conversions
 *   in overrides.json (DEC-11). Unconvertible units go to needs_review.
 */
import type { Knowledge } from "../knowledge/index";
import type {
  AdherenceReport,
  Analyte,
  CarePlanTarget,
  ClinicalEvent,
  Condition,
  DietLog,
  Lab,
  Medication,
  MoodScreening,
  PatientSnapshot,
  Provenance,
  SymptomCheckin,
  Vital,
} from "../model/snapshot";
import type { NeedsReviewItem } from "../model/bundle";
import { round } from "../util/dates";

/** Which Element ID each kind of item must carry. Element IDs are defined in the data dictionary. */
export const ANALYTE_ELEMENT: Record<Analyte, string> = {
  lvef: "D002",
  potassium: "D007",
  sodium: "D008",
  creatinine: "D009",
  egfr: "D009",
  bnp: "D010",
  ntprobnp: "D010",
  magnesium: "D018",
  inr: "D019",
  hba1c: "D020",
};
export const VITAL_ELEMENT = { weight: "D011", blood_pressure: "D012", heart_rate: "D013" } as const;
export const CARE_PLAN_ELEMENT: Record<CarePlanTarget["target"], string> = {
  dry_weight: "D011",
  weight_gain_1d_limit: "D011",
  weight_gain_7d_limit: "D011",
  bp_goal: "D012",
  egfr_baseline: "D009",
  bnp_baseline: "D010",
  inr_range: "D019",
  resting_hr_range: "D013",
  fluid_limit: "D015",
};

export interface Prepared {
  snapshot: PatientSnapshot;
  conditions: Condition[];
  medications: Medication[];
  labs: Lab[];
  vitals: Vital[];
  symptoms: SymptomCheckin[];
  dietLogs: DietLog[];
  mood: MoodScreening[];
  adherence: AdherenceReport[];
  events: ClinicalEvent[];
  carePlan: CarePlanTarget[];
  needsReview: NeedsReviewItem[];
  /**
   * Items held back from analysis only because they are unconfirmed, pending
   * or conflicting (DEC-18). Normalised like analysed items so the urgent
   * pathway can still check them: safety over strictness.
   */
  held: {
    labs: Lab[];
    vitals: Vital[];
    symptoms: SymptomCheckin[];
    mood: MoodScreening[];
    status: Map<string, HeldStatus>;
  };
  warnings: string[];
  /** Item id -> unit conversion applied, for evidence. */
  conversions: Map<string, string>;
}

export type HeldStatus = "unconfirmed" | "pending_reconciliation" | "conflict";

type Units = Knowledge["overrides"]["units"];

function canonicalUnit(units: Units, unit: string): string {
  const u = unit.trim();
  for (const [canon, aliases] of Object.entries(units.aliases)) {
    if (canon === "$comment") continue;
    if (canon === u || (aliases as string[]).some((a) => a.toLowerCase() === u.toLowerCase())) return canon;
  }
  return u;
}

/** Convert a value to the dictionary unit for `quantity`. Returns null when no listed conversion exists. */
export function normalizeUnit(
  k: Knowledge,
  quantity: string,
  value: number,
  unit: string,
): { value: number; unit: string; converted: string | null } | null {
  const units = k.overrides.units;
  const target = (units.canonical as Record<string, string>)[quantity];
  if (!target) return null;
  const from = canonicalUnit(units, unit);
  if (from === target) return { value, unit: target, converted: null };
  const conv = units.conversions.find((c) => c.quantity === quantity && c.from === from && c.to === target);
  if (!conv) return null;
  const out = "factor" in conv && conv.factor !== undefined ? value * conv.factor : value / (conv as { divisor: number }).divisor;
  return { value: round(out, 3), unit: target, converted: `${value} ${unit} -> ${round(out, 3)} ${target} (${units.decision})` };
}

export function prepare(k: Knowledge, snapshot: PatientSnapshot): Prepared {
  const p: Prepared = {
    snapshot,
    conditions: [],
    medications: [],
    labs: [],
    vitals: [],
    symptoms: [],
    dietLogs: [],
    mood: [],
    adherence: [],
    events: [],
    carePlan: [],
    needsReview: [],
    held: { labs: [], vitals: [], symptoms: [], mood: [], status: new Map() },
    warnings: [],
    conversions: new Map(),
  };
  const vocab = k.overrides.vocabularies;

  /**
   * Common gate: element defined + expected, confirmed, reconciled.
   * Returns "ok" (analyse), "held" (failed only confirmation or reconciliation;
   * still checked by the urgent pathway) or "rejected".
   * DEC-18: patient-entered items are confirmed by the patient on entry;
   * confirmation applies to imported data.
   */
  const gate = (kind: string, item: { id: string; element_id: string; provenance: Provenance }, expected: string, label: string, possibleRedFlag = false): "ok" | "held" | "rejected" => {
    const review = (reason: NeedsReviewItem["reason"], detail: string) =>
      p.needsReview.push({ item_id: item.id, kind, element_id: item.element_id, label, reason, detail, source: item.provenance.source, possible_red_flag: possibleRedFlag });
    const hold = (status: HeldStatus, detail: string) => {
      review(status, detail);
      p.held.status.set(item.id, status);
      return "held" as const;
    };
    if (!k.dictionary.has(item.element_id)) {
      review("unknown_element", `${item.element_id} is not in the data dictionary; item not used.`);
      return "rejected";
    }
    if (item.element_id !== expected) {
      review("element_mismatch", `Tagged ${item.element_id} but a ${kind} of this type is ${expected}; item not used.`);
      return "rejected";
    }
    if (item.provenance.reconciliation === "conflict") return hold("conflict", item.provenance.note ?? "Sources disagree; resolve on the Review screen.");
    if (item.provenance.reconciliation === "pending") return hold("pending_reconciliation", item.provenance.note ?? "Waiting for reconciliation across sources.");
    if (!item.provenance.confirmed && item.provenance.source !== "patient") return hold("unconfirmed", "Not yet confirmed by the patient; not used in analysis.");
    return "ok";
  };
  const badValue = (kind: string, item: { id: string; element_id: string; provenance: Provenance }, label: string, detail: string, red = false) =>
    p.needsReview.push({ item_id: item.id, kind, element_id: item.element_id, label, reason: "invalid_value", detail, source: item.provenance.source, possible_red_flag: red });

  for (const c of snapshot.conditions) {
    const expected = c.key === "heart_failure" ? "D001" : "D004";
    if (gate("condition", c, expected, c.name) === "ok") p.conditions.push(c);
  }
  for (const m of snapshot.medications) {
    if (gate("medication", m, "D005", m.name) === "ok") p.medications.push(m);
  }
  for (const l of snapshot.labs) {
    const g = gate("lab", l, ANALYTE_ELEMENT[l.analyte], `${l.analyte} ${l.value} ${l.unit}`);
    if (g === "rejected") continue;
    const n = normalizeUnit(k, l.analyte, l.value, l.unit);
    if (!n) {
      p.needsReview.push({ item_id: l.id, kind: "lab", element_id: l.element_id, label: `${l.analyte} ${l.value} ${l.unit}`, reason: "unit_not_convertible", detail: `No dictionary conversion from '${l.unit}' for ${l.analyte}.`, source: l.provenance.source, possible_red_flag: false });
      continue;
    }
    if (n.converted) p.conversions.set(l.id, n.converted);
    // Reference range is converted with the same factor so it stays comparable.
    let rr = l.reference_range;
    if (rr && n.converted) {
      const f = n.value / l.value;
      rr = { low: rr.low !== undefined ? round(rr.low * f, 3) : undefined, high: rr.high !== undefined ? round(rr.high * f, 3) : undefined };
    }
    (g === "ok" ? p.labs : p.held.labs).push({ ...l, value: n.value, unit: n.unit, reference_range: rr });
  }
  for (const v of snapshot.vitals) {
    const label = v.kind === "blood_pressure" ? `BP ${v.systolic}/${v.diastolic} ${v.unit}` : `${v.kind} ${v.value} ${v.unit}`;
    const g = gate("vital", v, VITAL_ELEMENT[v.kind], label, v.kind !== "weight");
    if (g === "rejected") continue;
    const target = g === "ok" ? p.vitals : p.held.vitals;
    if (v.kind === "blood_pressure") {
      if (v.systolic === undefined || v.diastolic === undefined) { badValue("vital", v, label, "Blood pressure needs systolic and diastolic."); continue; }
      const s = normalizeUnit(k, "systolic", v.systolic, v.unit);
      const d = normalizeUnit(k, "diastolic", v.diastolic, v.unit);
      if (!s || !d) { p.needsReview.push({ item_id: v.id, kind: "vital", element_id: v.element_id, label, reason: "unit_not_convertible", detail: `Unit '${v.unit}'.`, source: v.provenance.source, possible_red_flag: true }); continue; }
      target.push({ ...v, systolic: s.value, diastolic: d.value, unit: s.unit });
    } else {
      if (v.value === undefined) { badValue("vital", v, label, "Missing value."); continue; }
      const n = normalizeUnit(k, v.kind === "weight" ? "weight" : "heart_rate", v.value, v.unit);
      if (!n) { p.needsReview.push({ item_id: v.id, kind: "vital", element_id: v.element_id, label, reason: "unit_not_convertible", detail: `No dictionary conversion from '${v.unit}'.`, source: v.provenance.source, possible_red_flag: v.kind === "heart_rate" }); continue; }
      if (n.converted) p.conversions.set(v.id, n.converted);
      target.push({ ...v, value: n.value, unit: n.unit });
    }
  }
  const qualifying = k.overrides.rules.R21.qualifying_symptoms as string[];
  for (const s of snapshot.symptoms) {
    const red = s.reported.some((x) => qualifying.includes(x));
    const g = gate("symptom", s, "D014", s.reported.join(", ") || "no symptoms", red);
    if (g === "rejected") continue;
    const unknown = s.reported.filter((x) => !vocab.symptoms.includes(x));
    if (unknown.length) { badValue("symptom", s, s.reported.join(", "), `Not in the D014 checklist: ${unknown.join(", ")}.`, red); continue; }
    (g === "ok" ? p.symptoms : p.held.symptoms).push(s);
  }
  for (const d of snapshot.diet_logs) {
    if (gate("diet_log", d, "D015", d.tags.join(", ") || "no risk tags") !== "ok") continue;
    const unknown = d.tags.filter((t) => !vocab.diet_tags.includes(t));
    if (unknown.length) { badValue("diet_log", d, d.tags.join(", "), `Unknown D015 tags: ${unknown.join(", ")}.`); continue; }
    p.dietLogs.push(d);
  }
  for (const m of snapshot.mood) {
    const red = m.instrument === "PHQ-9" && (m.item9 ?? 0) > 0;
    const g = gate("mood", m, "D016", `${m.instrument} ${m.score}`, red);
    if (g === "rejected") continue;
    if (m.instrument === "PHQ-9" && m.item9 === undefined) {
      p.warnings.push(`PHQ-9 ${m.id} has no item 9 answer; the self-harm urgent check (R22) cannot run on it.`);
    }
    (g === "ok" ? p.mood : p.held.mood).push(m);
  }
  const medIds = new Set(snapshot.medications.map((m) => m.id));
  for (const a of snapshot.adherence) {
    if (gate("adherence", a, "D006", `${a.missed.length} missed doses`) !== "ok") continue;
    const bad = a.missed.filter((x) => !vocab.missed_dose_reasons.includes(x.reason) || !medIds.has(x.medication_id));
    if (bad.length) { badValue("adherence", a, `${a.missed.length} missed doses`, "Unknown reason code or medication id in missed doses."); continue; }
    p.adherence.push(a);
  }
  for (const e of snapshot.events) {
    if (gate("event", e, "D017", `${e.type} ${e.start}`) === "ok") p.events.push(e);
  }
  for (const t of snapshot.care_plan) {
    if (gate("care_plan", t, CARE_PLAN_ELEMENT[t.target], t.target) !== "ok") continue;
    if (t.provenance.source !== "care_plan") { badValue("care_plan", t, t.target, "Care-plan targets must come from source 'care_plan' (DEC-13)."); continue; }
    if (t.unit === "lb" && t.value !== undefined) {
      const n = normalizeUnit(k, "weight", t.value, t.unit);
      if (n) { p.conversions.set(t.id, n.converted ?? ""); p.carePlan.push({ ...t, value: n.value, unit: n.unit }); continue; }
    }
    p.carePlan.push(t);
  }
  // Canonical order so output never depends on the order of input items.
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
  for (const key of ["conditions", "medications", "labs", "vitals", "symptoms", "dietLogs", "mood", "adherence", "events", "carePlan"] as const) {
    (p[key] as { id: string }[]).sort(byId);
  }
  for (const key of ["labs", "vitals", "symptoms", "mood"] as const) (p.held[key] as { id: string }[]).sort(byId);
  for (const a of p.adherence) a.missed = [...a.missed].sort((x, y) => x.date.localeCompare(y.date) || x.medication_id.localeCompare(y.medication_id));
  return p;
}
