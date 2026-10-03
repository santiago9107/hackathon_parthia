/**
 * KB rules R01-R20 (R21/R22 are the urgent pathway, see urgent.ts).
 *
 * Every numeric value comes from overrides.json (clinical-lead decisions) or
 * the exported KB. Each rule returns an outcome for the audit log and zero or
 * more findings. Missing required data is registered, never assumed normal.
 */
import type { Severity } from "../knowledge/index";
import { cardsForRule, ruleElements, ruleParams } from "../knowledge/index";
import { inAnyGroup, lastStartOrChange, lastStop, sortedEvents } from "../knowledge/drugs";
import type { Evidence, Finding, RuleEvaluation, ThresholdUse } from "../model/bundle";
import type { CarePlanTarget, Lab, Medication } from "../model/snapshot";
import type { Ctx, Validity } from "./context";
import { addMissing, evidence, latestValid, recordThreshold, ref, ruleUsable } from "./context";
import type { Phenotype } from "./phenotype";
import { fill, fmt, listText } from "./text";
import { DAY_MS, HOUR_MS, dayKey, round, toMs } from "../util/dates";
import domains from "../../config/domains.json";

export interface RuleResult {
  evaluation: RuleEvaluation;
  findings: Finding[];
}

type Outcome = { outcome: RuleEvaluation["outcome"]; detail: string; findings?: Finding[] };
type Impl = (ctx: Ctx, phenotype: Phenotype | null) => Outcome;

/* ---- helpers ------------------------------------------------------------ */

const medsIn = (ctx: Ctx, groups: string[]) => ctx.activeMeds.filter((m) => inAnyGroup(ctx.k, m, groups));

function medEvidence(ctx: Ctx, m: Medication): Evidence {
  const at = lastStartOrChange(m, ctx.asOf);
  return evidence(ctx, {
    element_id: "D005",
    item_id: m.id,
    label: [m.name, m.dose, m.frequency, m.otc ? "(OTC)" : null].filter(Boolean).join(" "),
    value: null,
    unit: null,
    date: at !== null ? dayKey(at) : dayKey(sortedEvents(m)[0]!.date),
    source: m.provenance.source,
  });
}

function labEvidence(ctx: Ctx, l: Lab): Evidence {
  return evidence(ctx, { element_id: l.element_id, item_id: l.id, label: l.analyte, value: l.value, unit: l.unit, date: dayKey(l.date), source: l.provenance.source });
}

const labs = (ctx: Ctx, analyte: Lab["analyte"]) => ctx.p.labs.filter((l) => l.analyte === analyte);

function validLab(ctx: Ctx, ruleId: string, element: string, analyte: Lab["analyte"]): Lab | null {
  const v = latestValid(ctx, element, labs(ctx, analyte), (l) => l.date);
  if (v.ok) return v.item;
  missing(ctx, element, ruleId, v);
  return null;
}

function missing<T>(ctx: Ctx, element: string, ruleId: string, v: Extract<Validity<T>, { ok: false }>) {
  const last = v.last as unknown;
  let ev: Evidence | null = null;
  if (last && typeof last === "object" && "analyte" in (last as object)) ev = labEvidence(ctx, last as Lab);
  addMissing(ctx, element, ruleId, v as Extract<Validity<unknown>, { ok: false }>, ev);
}

function hasHf(ctx: Ctx, ruleId: string): boolean {
  const hf = ctx.p.conditions.find((c) => c.key === "heart_failure" && c.active);
  if (hf) return true;
  addMissing(ctx, "D001", ruleId, { reason: "no_data", detail: "No confirmed, active heart failure diagnosis (D001).", last: null, lastAt: null });
  return false;
}

function carePlan(ctx: Ctx, target: CarePlanTarget["target"]): CarePlanTarget | null {
  const items = ctx.p.carePlan.filter((t) => t.target === target && toMs(t.set_on) <= ctx.asOf).sort((a, b) => toMs(b.set_on) - toMs(a.set_on));
  return items[0] ?? null;
}

function defaultThreshold(ctx: Ctx, t: Omit<ThresholdUse, "source" | "low" | "high"> & { low?: number | null; high?: number | null }): ThresholdUse {
  return recordThreshold(ctx, { low: null, high: null, ...t, source: "default" });
}

function cmp(op: string, a: number, b: number): boolean {
  if (op === ">=") return a >= b;
  if (op === ">") return a > b;
  if (op === "<=") return a <= b;
  if (op === "<") return a < b;
  throw new Error(`Unknown operator ${op}`);
}

/* ---- finding builder ---------------------------------------------------- */

interface FireArgs {
  key?: string;
  severity?: Severity;
  summary: string;
  values: Record<string, string>;
  evidence: Evidence[];
  thresholds: ThresholdUse[];
  decisions?: string[];
}

function fire(ctx: Ctx, ruleId: string, a: FireArgs): Finding {
  const { k } = ctx;
  const rule = k.rules.get(ruleId)!;
  const params = ruleParams<{ threshold_id?: string; groups?: string[]; decision?: string }>(k, ruleId);
  const textOverride = (k.overrides.text_overrides as Record<string, { clinician_note?: string; decision?: string; ambiguity?: string }>)[ruleId];
  const cards = cardsForRule(k, ruleId);
  const thresholdIds = [...new Set([...rule.threshold_ids, ...(params.threshold_id ? [params.threshold_id] : []), ...a.thresholds.map((t) => t.threshold_id).filter((x): x is string => !!x)])].sort();
  const decisions = [...new Set([...(params.decision ? [params.decision] : []), ...(a.decisions ?? []), ...(textOverride?.decision ? [textOverride.decision] : [])])].sort();
  const elementIds = [...new Set([...ruleElements(k, ruleId), ...a.evidence.map((e) => e.element_id)])].sort();
  const knowledge = [
    ref(ctx, "rule", ruleId),
    ...thresholdIds.map((t) => ref(ctx, "threshold", t)),
    ...cards.map((c) => ref(ctx, "card", c.card_id)),
    ...elementIds.map((e) => ref(ctx, "element", e)),
    ...decisions.map((d) => ref(ctx, "decision", d)),
    ref(ctx, "override", "rule_elements"),
    ...(JSON.stringify(params).includes("groups") ? [ref(ctx, "override", "drug_groups")] : []),
    ...(textOverride ? [ref(ctx, "override", `text_overrides.${ruleId}`)] : []),
  ];
  const domainId = (domains.rule_domain_overrides as Record<string, string>)[ruleId] ?? (domains.kb_domain_map as Record<string, string | null>)[rule.kb_domain];
  if (!domainId) throw new Error(`No module domain for ${ruleId} (${rule.kb_domain})`);
  const triggeredAt = a.evidence.map((e) => e.date).sort().at(-1) ?? dayKey(ctx.asOf);
  return {
    finding_id: a.key ? `${ruleId}:${a.key}` : ruleId,
    rule_id: ruleId,
    title: rule.name,
    category: rule.category,
    severity: a.severity ?? rule.severity,
    base_severity: rule.severity,
    domain: domainId as Finding["domain"],
    kb_domain: rule.kb_domain,
    summary: a.summary,
    patient_question: fill(rule.patient_question, a.values),
    clinician_note: textOverride?.clinician_note ?? rule.clinician_note ?? "",
    evidence: a.evidence,
    element_ids: elementIds,
    rule_ids: [ruleId],
    source_ids: [...new Set([...rule.source_ids, ...cards.flatMap((c) => c.source_ids)])].sort(),
    threshold_ids: thresholdIds,
    card_ids: cards.map((c) => c.card_id),
    decision_ids: decisions,
    thresholds_used: a.thresholds,
    knowledge,
    triggered_at: triggeredAt,
    priority: null,
  };
}

/* ---- rule implementations ---------------------------------------------- */

/** "Drug X active in a patient with HF" rules: R01, R05, R10. */
function drugInHf(ruleId: string, what: string): Impl {
  return (ctx) => {
    const prm = ruleParams<{ groups: string[] }>(ctx.k, ruleId);
    const meds = medsIn(ctx, prm.groups);
    if (!meds.length) return { outcome: "not_applicable", detail: `No active ${what}.` };
    if (!hasHf(ctx, ruleId)) return { outcome: "missing_data", detail: "Heart failure diagnosis (D001) not confirmed." };
    return {
      outcome: "fired",
      detail: `${meds.length} active ${what}.`,
      findings: meds.map((m) =>
        fire(ctx, ruleId, {
          key: m.id,
          summary: `${m.name} (${what}${m.otc ? ", over the counter" : ""}) is on the confirmed medicine list of a patient with heart failure.`,
          values: { drug: m.name },
          evidence: [medEvidence(ctx, m)],
          thresholds: [],
        }),
      ),
    };
  };
}

const R02: Impl = (ctx) => {
  const prm = ruleParams<{ groups: string[]; element: string; threshold_id: string; op: string; value: number; unit: string; decision: string }>(ctx.k, "R02");
  const mras = medsIn(ctx, prm.groups);
  if (!mras.length) return { outcome: "not_applicable", detail: "No active MRA." };
  const k = validLab(ctx, "R02", prm.element, "potassium");
  if (!k) return { outcome: "missing_data", detail: "No valid potassium (D007)." };
  const t = defaultThreshold(ctx, { threshold_id: prm.threshold_id, element_id: prm.element, parameter: "potassium on MRA (alert high)", op: prm.op as ThresholdUse["op"], value: prm.value, unit: prm.unit, reference: `T01 Alert HIGH; ${prm.decision}` });
  if (!cmp(prm.op, k.value, prm.value)) return { outcome: "not_fired", detail: `Potassium ${fmt(k.value, k.unit)} below ${prm.value}.` };
  const mra = mras[0]!;
  return {
    outcome: "fired",
    detail: `Potassium ${fmt(k.value, k.unit)} with ${mra.name}.`,
    findings: [fire(ctx, "R02", {
      summary: `Potassium was ${fmt(k.value, k.unit)} on ${dayKey(k.date)} while ${listText(mras.map((m) => m.name))} (MRA) is active; the alert level is ${prm.value} ${prm.unit} or higher.`,
      values: { value: fmt(k.value, k.unit), MRA: mra.name },
      evidence: [labEvidence(ctx, k), ...mras.map((m) => medEvidence(ctx, m))],
      thresholds: [t],
    })],
  };
};

const R03: Impl = (ctx) => {
  const prm = ruleParams<{ groups: string[]; element: string; threshold_id: string; op: string; value: number; unit: string }>(ctx.k, "R03");
  const mras = medsIn(ctx, prm.groups);
  if (!mras.length) return { outcome: "not_applicable", detail: "No active MRA." };
  const e = validLab(ctx, "R03", prm.element, "egfr");
  if (!e) return { outcome: "missing_data", detail: "No valid eGFR (D009)." };
  const t = defaultThreshold(ctx, { threshold_id: prm.threshold_id, element_id: prm.element, parameter: "eGFR on MRA (alert low)", op: prm.op as ThresholdUse["op"], value: prm.value, unit: prm.unit, reference: "T03 Alert LOW; DEC-01" });
  if (!cmp(prm.op, e.value, prm.value)) return { outcome: "not_fired", detail: `eGFR ${fmt(e.value, e.unit)} above ${prm.value}.` };
  const mra = mras[0]!;
  return {
    outcome: "fired",
    detail: `eGFR ${fmt(e.value, e.unit)} with ${mra.name}.`,
    findings: [fire(ctx, "R03", {
      summary: `eGFR was ${fmt(e.value, e.unit)} on ${dayKey(e.date)} while ${mra.name} (MRA) is active; the alert level is ${prm.value} or lower.`,
      values: { MRA: mra.name },
      evidence: [labEvidence(ctx, e), ...mras.map((m) => medEvidence(ctx, m))],
      thresholds: [t],
    })],
  };
};

const R04: Impl = (ctx, phenotype) => {
  const prm = ruleParams<{ groups: string[]; severity_by_phenotype: Record<string, Severity | null>; decision: string }>(ctx.k, "R04");
  const meds = medsIn(ctx, prm.groups);
  if (!meds.length) return { outcome: "not_applicable", detail: "No active diltiazem or verapamil." };
  if (!phenotype) {
    addMissing(ctx, "D002", "R04", { reason: "no_data", detail: "No confirmed LVEF, so the HF phenotype (D003) is unknown.", last: null, lastAt: null });
    return { outcome: "missing_data", detail: "Phenotype unknown." };
  }
  const sev = prm.severity_by_phenotype[phenotype];
  if (!sev) return { outcome: "not_fired", detail: `${phenotype}: not flagged (${prm.decision}).` };
  return {
    outcome: "fired",
    detail: `${phenotype} with ${meds.map((m) => m.name).join(", ")}.`,
    findings: meds.map((m) => fire(ctx, "R04", {
      key: m.id,
      severity: sev,
      summary: `${m.name} (non-dihydropyridine calcium channel blocker) is active and the calculated phenotype (D003) is ${phenotype}.`,
      values: { drug: m.name },
      evidence: [medEvidence(ctx, m)],
      thresholds: [],
    })),
  };
};

const R06: Impl = (ctx) => {
  const prm = ruleParams<{ groups_a: string[]; groups_b: string[]; washout_hours: number }>(ctx.k, "R06");
  const arnis = medsIn(ctx, prm.groups_a);
  if (!arnis.length) return { outcome: "not_applicable", detail: "No active ARNI." };
  const out: Finding[] = [];
  for (const arni of arnis) {
    const arniStart = lastStartOrChange(arni, ctx.asOf)!;
    for (const ace of ctx.p.medications.filter((m) => inAnyGroup(ctx.k, m, prm.groups_b))) {
      const activeNow = ctx.activeMeds.includes(ace);
      const stop = lastStop(ace, ctx.asOf);
      const gapH = stop !== null ? (arniStart - stop) / HOUR_MS : null;
      const tooClose = !activeNow && gapH !== null && gapH >= 0 && gapH < prm.washout_hours;
      if (!activeNow && !tooClose) continue;
      out.push(fire(ctx, "R06", {
        key: `${arni.id}+${ace.id}`,
        summary: activeNow
          ? `${arni.name} (ARNI) and ${ace.name} (ACE inhibitor) are both on the confirmed active medicine list.`
          : `${ace.name} (ACE inhibitor) ended ${round(gapH!, 0)} h before ${arni.name} (ARNI) began; the KB washout is ${prm.washout_hours} h.`,
        values: { ARNI: arni.name, "ACE inhibitor": ace.name },
        evidence: [medEvidence(ctx, arni), medEvidence(ctx, ace)],
        thresholds: [defaultThreshold(ctx, { threshold_id: null, element_id: "D005", parameter: "ARNI / ACE inhibitor washout", op: ">=", value: prm.washout_hours, unit: "h", reference: "R06 Threshold values" })],
      }));
    }
  }
  return out.length ? { outcome: "fired", detail: `${out.length} ARNI + ACE inhibitor overlap(s).`, findings: out } : { outcome: "not_fired", detail: "No ACE inhibitor overlap." };
};

const R07: Impl = (ctx) => {
  const prm = ruleParams<{ groups: string[]; diet_tag: string; escalate_to: Severity; escalate_if_groups: string[]; escalate_potassium_gte: number; escalate_potassium_rise_gte: number; rise_lookback_days: number; decision: string }>(ctx.k, "R07");
  const meds = medsIn(ctx, prm.groups);
  if (!meds.length) return { outcome: "not_applicable", detail: "No active RAAS inhibitor or MRA." };
  const v = latestValid(ctx, "D015", ctx.p.dietLogs, (d) => d.date);
  if (!v.ok) { missing(ctx, "D015", "R07", v); return { outcome: "missing_data", detail: "No valid diet log (D015)." }; }
  const from = ctx.asOf - ctx.k.dictionary.get("D015")!.validity!.amount * DAY_MS;
  const hits = ctx.p.dietLogs.filter((d) => d.tags.includes(prm.diet_tag) && toMs(d.date) >= from && toMs(d.date) <= ctx.asOf).sort((a, b) => a.date.localeCompare(b.date));
  if (!hits.length) return { outcome: "not_fired", detail: "No potassium salt substitute logged in the D015 window." };
  const days = new Set(hits.map((h) => dayKey(h.date))).size;

  // DEC-05 escalation
  let severity: Severity | undefined;
  const thresholds: ThresholdUse[] = [];
  const ev: Evidence[] = hits.map((h) => evidence(ctx, { element_id: "D015", item_id: h.id, label: "potassium salt substitute", value: null, unit: null, date: dayKey(h.date), source: h.provenance.source }));
  ev.push(...meds.map((m) => medEvidence(ctx, m)));
  let why = "";
  const mraActive = medsIn(ctx, prm.escalate_if_groups).length > 0;
  if (mraActive) {
    const kv = latestValid(ctx, "D007", labs(ctx, "potassium"), (l) => l.date);
    if (!kv.ok) missing(ctx, "D007", "R07", kv);
    else {
      const k = kv.item;
      ev.push(labEvidence(ctx, k));
      thresholds.push(defaultThreshold(ctx, { threshold_id: "T01", element_id: "D007", parameter: "R07 escalation: potassium on MRA", op: ">=", value: prm.escalate_potassium_gte, unit: "mEq/L", reference: prm.decision }));
      thresholds.push(defaultThreshold(ctx, { threshold_id: "T01", element_id: "D007", parameter: "R07 escalation: potassium rise vs previous result", op: ">=", value: prm.escalate_potassium_rise_gte, unit: "mEq/L", reference: `${prm.decision}; previous result within ${prm.rise_lookback_days} days` }));
      const prev = labs(ctx, "potassium")
        .filter((l) => toMs(l.date) < toMs(k.date) && toMs(l.date) >= toMs(k.date) - prm.rise_lookback_days * DAY_MS)
        .sort((a, b) => toMs(b.date) - toMs(a.date))[0];
      const rise = prev ? round(k.value - prev.value, 2) : null;
      if (prev) ev.push(labEvidence(ctx, prev));
      if (k.value >= prm.escalate_potassium_gte) why = `potassium ${fmt(k.value, k.unit)} is at or above ${prm.escalate_potassium_gte}`;
      else if (rise !== null && rise >= prm.escalate_potassium_rise_gte) why = `potassium rose ${rise} mEq/L since ${dayKey(prev!.date)}`;
      if (why) severity = prm.escalate_to;
    }
  }
  return {
    outcome: "fired",
    detail: `Salt substitute on ${days} day(s)${severity ? `; escalated (${why})` : ""}.`,
    findings: [fire(ctx, "R07", {
      severity,
      summary: `Potassium salt substitute logged on ${days} day(s) between ${dayKey(hits[0]!.date)} and ${dayKey(hits.at(-1)!.date)} while ${listText(meds.map((m) => m.name))} ${meds.length > 1 ? "are" : "is"} active${severity ? `; severity raised to ${severity} because an MRA is active and ${why} (${prm.decision})` : ""}.`,
      values: {},
      evidence: ev,
      thresholds,
      decisions: severity ? [prm.decision] : [],
    })],
  };
};

const R08: Impl = (ctx) => {
  const prm = ruleParams<{ element: string; threshold_id: string; one_day_gain_kg: number; seven_day_gain_kg: number; decision: string }>(ctx.k, "R08");
  const weights = ctx.p.vitals.filter((v) => v.kind === "weight" && v.value !== undefined && toMs(v.datetime) <= ctx.asOf);
  const v = latestValid(ctx, prm.element, weights, (w) => w.datetime);
  if (!v.ok) { missing(ctx, prm.element, "R08", v); return { outcome: "missing_data", detail: "No valid weight (D011)." }; }
  // Morning weight: first reading of each day.
  const daily = new Map<string, (typeof weights)[number]>();
  for (const w of [...weights].sort((a, b) => toMs(a.datetime) - toMs(b.datetime))) if (!daily.has(dayKey(w.datetime))) daily.set(dayKey(w.datetime), w);
  const lastDay = dayKey(v.at);
  const last = daily.get(lastDay)!;
  const dayMs = toMs(lastDay);
  const prevDay = daily.get(dayKey(dayMs - DAY_MS));
  const window = [...Array(7).keys()].map((i) => daily.get(dayKey(dayMs - (i + 1) * DAY_MS))).filter((x): x is NonNullable<typeof x> => !!x);
  const low = window.reduce<(typeof window)[number] | null>((m, w) => (m === null || w.value! < m.value! ? w : m), null);

  const cp1 = carePlan(ctx, "weight_gain_1d_limit");
  const cp7 = carePlan(ctx, "weight_gain_7d_limit");
  const lim1 = recordThreshold(ctx, cp1?.value !== undefined && cp1
    ? { threshold_id: prm.threshold_id, element_id: "D011", parameter: "1-day weight gain", op: ">=", value: cp1.value, low: null, high: null, unit: "kg", source: "care_plan", reference: `care plan ${cp1.id} (${dayKey(cp1.set_on)})` }
    : { threshold_id: prm.threshold_id, element_id: "D011", parameter: "1-day weight gain", op: ">=", value: prm.one_day_gain_kg, low: null, high: null, unit: "kg", source: "default", reference: `T05 Alert HIGH; ${prm.decision}` });
  const lim7 = recordThreshold(ctx, cp7?.value !== undefined && cp7
    ? { threshold_id: prm.threshold_id, element_id: "D011", parameter: "7-day weight gain from lowest value", op: ">=", value: cp7.value, low: null, high: null, unit: "kg", source: "care_plan", reference: `care plan ${cp7.id} (${dayKey(cp7.set_on)})` }
    : { threshold_id: prm.threshold_id, element_id: "D011", parameter: "7-day weight gain from lowest value", op: ">=", value: prm.seven_day_gain_kg, low: null, high: null, unit: "kg", source: "default", reference: `T05 Alert HIGH; ${prm.decision}` });

  const gain1 = prevDay ? round(last.value! - prevDay.value!, 2) : null;
  const gain7 = low ? round(last.value! - low.value!, 2) : null;
  const hit1 = gain1 !== null && gain1 >= lim1.value!;
  const hit7 = gain7 !== null && gain7 >= lim7.value!;
  if (gain1 === null && gain7 === null) {
    addMissing(ctx, "D011", "R08", { reason: "no_data", detail: "Only one recent weight; no earlier daily weight to compare with.", last: null, lastAt: null });
    return { outcome: "missing_data", detail: "Not enough daily weights to compare." };
  }
  if (!hit1 && !hit7) return { outcome: "not_fired", detail: `1-day gain ${gain1 ?? "n/a"} kg, 7-day gain ${gain7 ?? "n/a"} kg.` };

  const ref = hit7 ? low! : prevDay!;
  const gain = hit7 ? gain7! : gain1!;
  const days = Math.round((dayMs - toMs(dayKey(ref.datetime))) / DAY_MS);
  const ev: Evidence[] = [ref, last].map((w) => evidence(ctx, { element_id: "D011", item_id: w.id, label: "body weight", value: w.value!, unit: w.unit, date: dayKey(w.datetime), source: w.provenance.source }));
  const dry = carePlan(ctx, "dry_weight");
  if (dry?.value !== undefined) ev.push(evidence(ctx, { element_id: "D011", item_id: dry.id, label: "care-plan dry weight", value: dry.value, unit: dry.unit, date: dayKey(dry.set_on), source: "care_plan" }));
  return {
    outcome: "fired",
    detail: `Gain ${gain} kg over ${days} day(s).`,
    findings: [fire(ctx, "R08", {
      summary: `Weight rose ${fmt(gain, "kg")} in ${days} day${days === 1 ? "" : "s"} (${fmt(ref.value!, "kg")} on ${dayKey(ref.datetime)} to ${fmt(last.value!, "kg")} on ${lastDay})${dry?.value !== undefined ? `; care-plan dry weight is ${fmt(dry.value, "kg")}` : ""}.`,
      values: { amount: fmt(gain, "kg"), days: `${days} day${days === 1 ? "" : "s"}` },
      evidence: ev,
      thresholds: [hit7 ? lim7 : lim1],
    })],
  };
};

const R09: Impl = (ctx) => {
  const prm = ruleParams<{ groups: string[]; min_drugs: number; systolic_lt: number; min_low_readings: number; window_days: number; symptom: string; threshold_id: string; decision: string }>(ctx.k, "R09");
  const meds = medsIn(ctx, prm.groups);
  if (meds.length < prm.min_drugs) return { outcome: "not_applicable", detail: `${meds.length} BP-lowering medicine(s).` };
  const from = ctx.asOf - prm.window_days * DAY_MS;
  const bp = ctx.p.vitals.filter((v) => v.kind === "blood_pressure" && toMs(v.datetime) >= from && toMs(v.datetime) <= ctx.asOf);
  if (!bp.length) { addMissing(ctx, "D012", "R09", { reason: "no_data", detail: `No home blood pressure in the last ${prm.window_days} days.`, last: null, lastAt: null }); return { outcome: "missing_data", detail: "No recent BP." }; }
  const t = defaultThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D012", parameter: "low systolic (R09)", op: "<", value: prm.systolic_lt, unit: "mmHg", reference: `R09; ${prm.decision}` });
  const lows = bp.filter((v) => v.systolic! < prm.systolic_lt);
  if (lows.length < prm.min_low_readings) return { outcome: "not_fired", detail: `${lows.length} low systolic reading(s).` };
  const sv = latestValid(ctx, "D014", ctx.p.symptoms, (s) => s.datetime);
  if (!sv.ok) { missing(ctx, "D014", "R09", sv); return { outcome: "missing_data", detail: "No valid symptom check-in." }; }
  const symFrom = ctx.asOf - ctx.k.dictionary.get("D014")!.validity!.amount * DAY_MS;
  const dizzy = ctx.p.symptoms.filter((s) => s.reported.includes(prm.symptom) && toMs(s.datetime) >= symFrom && toMs(s.datetime) <= ctx.asOf);
  if (!dizzy.length) return { outcome: "not_fired", detail: "Low readings without dizziness." };
  return {
    outcome: "fired",
    detail: `${lows.length} low readings with dizziness.`,
    findings: [fire(ctx, "R09", {
      summary: `${lows.length} systolic readings below ${prm.systolic_lt} mmHg in the last ${prm.window_days} days, dizziness reported, and ${meds.length} blood-pressure-lowering medicines active.`,
      values: {},
      evidence: [
        ...lows.map((v) => evidence(ctx, { element_id: "D012", item_id: v.id, label: "blood pressure", value: `${v.systolic}/${v.diastolic}`, unit: "mmHg", date: v.datetime, source: v.provenance.source })),
        ...dizzy.map((s) => evidence(ctx, { element_id: "D014", item_id: s.id, label: "dizziness", value: null, unit: null, date: s.datetime, source: s.provenance.source })),
        ...meds.map((m) => medEvidence(ctx, m)),
      ],
      thresholds: [t],
    })],
  };
};

/** Lab-below/above-threshold rules: R11, R12, R14. */
function labRule(ruleId: string, analyte: Lab["analyte"], label: string, needsDrugs: boolean): Impl {
  return (ctx) => {
    const prm = ruleParams<{ groups?: string[]; element: string; threshold_id?: string; op: string; value: number; unit: string; escalate_to?: Severity; escalate_if_groups?: string[] }>(ctx.k, ruleId);
    const meds = prm.groups ? medsIn(ctx, prm.groups) : [];
    if (needsDrugs && !meds.length) return { outcome: "not_applicable", detail: "No relevant active medicine." };
    const l = validLab(ctx, ruleId, prm.element, analyte);
    if (!l) return { outcome: "missing_data", detail: `No valid ${label}.` };
    const t = defaultThreshold(ctx, { threshold_id: prm.threshold_id ?? null, element_id: prm.element, parameter: `${label} (${ruleId})`, op: prm.op as ThresholdUse["op"], value: prm.value, unit: prm.unit, reference: prm.threshold_id ? `${prm.threshold_id} via ${ruleId}` : `${ruleId} Threshold values` });
    if (!cmp(prm.op, l.value, prm.value)) return { outcome: "not_fired", detail: `${label} ${fmt(l.value, l.unit)}.` };
    const escalate = prm.escalate_if_groups && medsIn(ctx, prm.escalate_if_groups).length > 0;
    return {
      outcome: "fired",
      detail: `${label} ${fmt(l.value, l.unit)}${escalate ? "; escalated" : ""}.`,
      findings: [fire(ctx, ruleId, {
        severity: escalate ? prm.escalate_to : undefined,
        summary: `${label[0]!.toUpperCase()}${label.slice(1)} was ${fmt(l.value, l.unit)} on ${dayKey(l.date)} (alert level ${prm.op} ${prm.value} ${prm.unit})${meds.length ? ` with ${listText(meds.map((m) => m.name))} active` : ""}${escalate ? "; severity raised because digoxin is active (KB comment)" : ""}.`,
        values: { value: fmt(l.value, l.unit) },
        evidence: [labEvidence(ctx, l), ...meds.map((m) => medEvidence(ctx, m))],
        thresholds: [t],
      })],
    };
  };
}

const R13: Impl = (ctx) => {
  const prm = ruleParams<{ element: string; threshold_id: string; drop_fraction_gte: number }>(ctx.k, "R13");
  const e = validLab(ctx, "R13", prm.element, "egfr");
  if (!e) return { outcome: "missing_data", detail: "No valid eGFR." };
  const base = carePlan(ctx, "egfr_baseline");
  if (base?.value === undefined || !base) {
    addMissing(ctx, "D009", "R13", { reason: "baseline_not_set", detail: "No clinician-set eGFR baseline in the care plan (T03: baseline set by clinician).", last: null, lastAt: null });
    return { outcome: "missing_data", detail: "No eGFR baseline." };
  }
  const t = recordThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D009", parameter: "eGFR drop from baseline", op: ">=", value: prm.drop_fraction_gte * 100, low: null, high: null, unit: "%", source: "default", reference: "T03 / R13 (baseline from care plan)" });
  recordThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D009", parameter: "eGFR baseline", op: "range", value: base.value, low: null, high: null, unit: base.unit, source: "care_plan", reference: `care plan ${base.id} (${dayKey(base.set_on)})` });
  const drop = (base.value - e.value) / base.value;
  if (drop < prm.drop_fraction_gte) return { outcome: "not_fired", detail: `eGFR ${round(drop * 100, 1)}% below baseline.` };
  return {
    outcome: "fired",
    detail: `eGFR ${round(drop * 100, 1)}% below baseline.`,
    findings: [fire(ctx, "R13", {
      summary: `eGFR was ${fmt(e.value, e.unit)} on ${dayKey(e.date)}, ${round(drop * 100, 1)}% below the care-plan baseline of ${fmt(base.value, base.unit)}.`,
      values: {},
      evidence: [labEvidence(ctx, e), evidence(ctx, { element_id: "D009", item_id: base.id, label: "care-plan eGFR baseline", value: base.value, unit: base.unit, date: dayKey(base.set_on), source: "care_plan" })],
      thresholds: [t],
    })],
  };
};

/** Heart-rate rules R17 (slow, on rate-lowering drug) and R18 (fast or irregular). */
function hrRule(ruleId: "R17" | "R18"): Impl {
  return (ctx) => {
    const prm = ruleParams<{ groups?: string[]; element: string; threshold_id: string; hr_lt?: number; hr_gt?: number }>(ctx.k, ruleId);
    const meds = prm.groups ? medsIn(ctx, prm.groups) : [];
    if (prm.groups && !meds.length) return { outcome: "not_applicable", detail: "No rate-lowering medicine." };
    const hrs = ctx.p.vitals.filter((v) => v.kind === "heart_rate");
    const v = latestValid(ctx, prm.element, hrs, (h) => h.datetime);
    if (!v.ok) { missing(ctx, prm.element, ruleId, v); return { outcome: "missing_data", detail: "No valid resting heart rate." }; }
    const hr = v.item;
    const cp = carePlan(ctx, "resting_hr_range");
    const limit = ruleId === "R17" ? (cp?.low ?? prm.hr_lt!) : (cp?.high ?? prm.hr_gt!);
    const t = recordThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D013", parameter: ruleId === "R17" ? "resting HR alert low" : "resting HR alert high", op: ruleId === "R17" ? "<" : ">", value: limit, low: null, high: null, unit: "beats/min", source: cp && (ruleId === "R17" ? cp.low : cp.high) !== undefined ? "care_plan" : "default", reference: cp ? `care plan ${cp.id}` : "T07" });
    const hit = ruleId === "R17" ? hr.value! < limit : hr.value! > limit || hr.irregular === true;
    if (!hit) return { outcome: "not_fired", detail: `Resting HR ${hr.value} beats/min.` };
    return {
      outcome: "fired",
      detail: `Resting HR ${hr.value} beats/min${hr.irregular ? ", irregular" : ""}.`,
      findings: [fire(ctx, ruleId, {
        summary: `Most recent resting heart rate was ${hr.value} beats/min on ${dayKey(hr.datetime)}${hr.irregular ? " and the device reported an irregular rhythm" : ""}${meds.length ? ` with ${listText(meds.map((m) => m.name))} active` : ""}.`,
        values: {},
        evidence: [evidence(ctx, { element_id: "D013", item_id: hr.id, label: "resting heart rate", value: hr.value!, unit: hr.unit, date: hr.datetime, source: hr.provenance.source }), ...meds.map((m) => medEvidence(ctx, m))],
        thresholds: [t],
      })],
    };
  };
}

const R19: Impl = (ctx) => {
  const prm = ruleParams<{ element: string; threshold_id: string; phq9_gte: number; phq9_rise_gte: number; phq2_gte: number }>(ctx.k, "R19");
  const phq9 = ctx.p.mood.filter((m) => m.instrument === "PHQ-9" && toMs(m.date) <= ctx.asOf).sort((a, b) => toMs(b.date) - toMs(a.date));
  const phq2 = ctx.p.mood.filter((m) => m.instrument === "PHQ-2" && toMs(m.date) <= ctx.asOf).sort((a, b) => toMs(b.date) - toMs(a.date));
  const v9 = latestValid(ctx, "D016", phq9, (m) => m.date);
  const v2 = latestValid(ctx, "D016", phq2, (m) => m.date);
  if (!v9.ok && !v2.ok) { missing(ctx, "D016", "R19", v9); return { outcome: "missing_data", detail: "No valid PHQ-2/PHQ-9." }; }
  const t1 = defaultThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D016", parameter: "PHQ-9 score", op: ">=", value: prm.phq9_gte, unit: "points", reference: "T08 Alert HIGH" });
  const t2 = defaultThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D016", parameter: "PHQ-9 rise vs previous", op: ">=", value: prm.phq9_rise_gte, unit: "points", reference: "T08 Alert HIGH" });
  const reasons: string[] = [];
  const ev: Evidence[] = [];
  const used: ThresholdUse[] = [];
  if (v9.ok) {
    const cur = v9.item;
    const prev = phq9.find((m) => toMs(m.date) < toMs(cur.date));
    ev.push(evidence(ctx, { element_id: "D016", item_id: cur.id, label: "PHQ-9 score", value: cur.score, unit: "points", date: dayKey(cur.date), source: cur.provenance.source }));
    if (cur.score >= prm.phq9_gte) { reasons.push(`PHQ-9 score ${cur.score} on ${dayKey(cur.date)}`); used.push(t1); }
    if (prev && cur.score - prev.score >= prm.phq9_rise_gte) {
      reasons.push(`a rise of ${cur.score - prev.score} points from ${prev.score} on ${dayKey(prev.date)}`);
      ev.push(evidence(ctx, { element_id: "D016", item_id: prev.id, label: "previous PHQ-9 score", value: prev.score, unit: "points", date: dayKey(prev.date), source: prev.provenance.source }));
      used.push(t2);
    }
  }
  if (v2.ok && v2.item.score >= prm.phq2_gte && !phq9.some((m) => toMs(m.date) >= toMs(v2.item.date))) {
    reasons.push(`PHQ-2 score ${v2.item.score} on ${dayKey(v2.item.date)} without a follow-up PHQ-9`);
    ev.push(evidence(ctx, { element_id: "D016", item_id: v2.item.id, label: "PHQ-2 score", value: v2.item.score, unit: "points", date: dayKey(v2.item.date), source: v2.item.provenance.source }));
    used.push(defaultThreshold(ctx, { threshold_id: prm.threshold_id, element_id: "D016", parameter: "PHQ-2 score", op: ">=", value: prm.phq2_gte, unit: "points", reference: "T08 context" }));
  }
  if (!reasons.length) return { outcome: "not_fired", detail: "Screening below alert levels." };
  return {
    outcome: "fired",
    detail: reasons.join("; "),
    findings: [fire(ctx, "R19", { summary: `Depression screening: ${listText(reasons)}.`, values: {}, evidence: ev, thresholds: used })],
  };
};

const R20: Impl = (ctx) => {
  const prm = ruleParams<{ groups: string[]; min_missed: number; window_days: number; decision: string }>(ctx.k, "R20");
  const v = latestValid(ctx, "D006", ctx.p.adherence, (a) => a.period_end);
  if (!v.ok) { missing(ctx, "D006", "R20", v); return { outcome: "missing_data", detail: "No valid adherence check-in." }; }
  const from = ctx.asOf - prm.window_days * DAY_MS;
  const meds = new Map(ctx.p.medications.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const missed = ctx.p.adherence
    .flatMap((a) => a.missed.map((x) => ({ ...x, report: a })))
    .filter((x) => toMs(x.date) > from && toMs(x.date) <= ctx.asOf)
    .filter((x) => { const m = meds.get(x.medication_id); return !!m && inAnyGroup(ctx.k, m, prm.groups); })
    .filter((x) => { const key = `${x.medication_id}@${x.date}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => a.date.localeCompare(b.date));
  const t = defaultThreshold(ctx, { threshold_id: null, element_id: "D006", parameter: "missed HF-medicine doses in window", op: ">=", value: prm.min_missed, unit: "doses", reference: `R20; ${prm.decision}; window ${prm.window_days} days` });
  if (missed.length < prm.min_missed) return { outcome: "not_fired", detail: `${missed.length} missed HF-medicine dose(s).` };
  const labels = ctx.k.overrides.vocabularies.missed_dose_reason_labels as Record<string, string>;
  const counts = new Map<string, number>();
  for (const m of missed) { const r = m.note ?? labels[m.reason] ?? m.reason; counts.set(r, (counts.get(r) ?? 0) + 1); }
  const topReason = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  const names = [...new Set(missed.map((m) => meds.get(m.medication_id)!.name))];
  return {
    outcome: "fired",
    detail: `${missed.length} missed doses.`,
    findings: [fire(ctx, "R20", {
      summary: `${missed.length} missed doses of ${listText(names)} in the last ${prm.window_days} days; main reason reported: ${topReason}.`,
      values: { reason: topReason },
      evidence: [
        ...missed.map((m) => evidence(ctx, { element_id: "D006", item_id: `${m.report.id}:${m.medication_id}@${m.date}`, label: `missed ${meds.get(m.medication_id)!.name} (${labels[m.reason] ?? m.reason})`, value: 1, unit: "doses", date: dayKey(m.date), source: m.report.provenance.source })),
        ...names.map((n) => medEvidence(ctx, [...meds.values()].find((m) => m.name === n)!)),
      ],
      thresholds: [t],
    })],
  };
};

const notEvaluable: Impl = () => ({ outcome: "not_evaluable", detail: "" });

export const RULES: Record<string, Impl> = {
  R01: drugInHf("R01", "NSAID"),
  R02,
  R03,
  R04,
  R05: drugInHf("R05", "thiazolidinedione"),
  R06,
  R07,
  R08,
  R09,
  R10: drugInHf("R10", "DPP-4 inhibitor linked to HF hospitalization"),
  R11: labRule("R11", "potassium", "potassium", true),
  R12: labRule("R12", "sodium", "sodium", false),
  R13,
  R14: labRule("R14", "egfr", "eGFR", true),
  R15: notEvaluable,
  R16: notEvaluable,
  R17: hrRule("R17"),
  R18: hrRule("R18"),
  R19,
  R20,
};

export function evaluateRules(ctx: Ctx, phenotype: Phenotype | null): RuleResult[] {
  const out: RuleResult[] = [];
  for (const ruleId of [...ctx.k.rules.keys()].sort()) {
    const impl = RULES[ruleId];
    if (!impl) continue; // R21/R22: urgent pathway
    const rule = ctx.k.rules.get(ruleId)!;
    const prm = ruleParams<{ not_evaluable?: boolean; reason?: string; threshold_id?: string }>(ctx.k, ruleId);
    const base = { rule_id: ruleId, review_status: rule.review_status };
    if (prm.not_evaluable) {
      out.push({ evaluation: { ...base, outcome: "not_evaluable", detail: prm.reason ?? "Not evaluable." }, findings: [] });
      continue;
    }
    const gate = ruleUsable(ctx, ruleId, [...rule.threshold_ids, ...(prm.threshold_id ? [prm.threshold_id] : [])]);
    if (!gate.ok) {
      out.push({ evaluation: { ...base, outcome: "excluded_by_mode", detail: `Excluded in ${ctx.mode} mode: ${gate.why}.` }, findings: [] });
      continue;
    }
    ref(ctx, "rule", ruleId);
    const r = impl(ctx, phenotype);
    out.push({ evaluation: { ...base, outcome: r.outcome, detail: r.detail }, findings: r.findings ?? [] });
  }
  return out;
}
