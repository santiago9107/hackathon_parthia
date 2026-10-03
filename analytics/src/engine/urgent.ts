/**
 * RED FLAGS FIRST (Dictionary guide rule 9; rules R21, R22; DEC-06, DEC-07).
 *
 * Runs on prepared data only, before and independent of every other analysis.
 * `evaluateUrgent` is exported on its own so a screen can call the fast path
 * without running the full analysis.
 */
import type { RuleEvaluation, ThresholdUse, UrgentItem } from "../model/bundle";
import type { Ctx } from "./context";
import { evidence, latestValid, recordThreshold, ref, ruleUsable } from "./context";
import { fmt, listText } from "./text";
import { DAY_MS, HOUR_MS, dayKey, toMs } from "../util/dates";
import messages from "../../config/messages.json";
import analysisConfig from "../../config/analysis.json";
import domains from "../../config/domains.json";
import type { Lab } from "../model/snapshot";
import { usable } from "../knowledge/index";

const domainFor = (pathway: UrgentItem["pathway"]) => (domains.urgent_domain_by_pathway as Record<string, UrgentItem["domain"]>)[pathway]!;

const SYMPTOM_LABEL: Record<string, string> = {
  chest_pain: "chest pain",
  fainting: "fainting",
  severe_breathlessness_at_rest: "severe breathlessness at rest",
  confusion: "confusion",
  dizziness: "dizziness",
};

export function evaluateUrgent(ctx: Ctx): { urgent: UrgentItem[]; evaluations: RuleEvaluation[] } {
  const urgent: UrgentItem[] = [];
  const evaluations: RuleEvaluation[] = [];
  const r21 = ctx.k.overrides.rules.R21;
  const r22 = ctx.k.overrides.rules.R22;

  /* ---- R21: red-flag symptoms and urgent vitals ---- */
  const g21 = ruleUsable(ctx, "R21", ["T06", "T07", "T09"]);
  if (!g21.ok) {
    evaluations.push({ rule_id: "R21", outcome: "excluded_by_mode", detail: `URGENT PATHWAY DISABLED in ${ctx.mode} mode: ${g21.why}.`, review_status: ctx.k.rules.get("R21")!.review_status });
    ctx.warnings.push(`Urgent pathway R21 is disabled in ${ctx.mode} mode (${g21.why}). Red-flag symptoms and vitals are NOT being checked.`);
  } else {
    const before = urgent.length;
    const rule = ctx.k.rules.get("R21")!;
    const symFrom = ctx.asOf - ctx.k.dictionary.get("D014")!.validity!.amount * DAY_MS;
    const checkins = ctx.p.symptoms.filter((s) => toMs(s.datetime) <= ctx.asOf);
    const baseItem = (id: string, pathway: UrgentItem["pathway"], title: string, ev: UrgentItem["evidence"], thresholds: ThresholdUse[], elements: string[], at: string): UrgentItem => ({
      urgent_id: id,
      pathway,
      rule_id: "R21",
      title,
      patient_message: messages.R21,
      clinician_note: rule.clinician_note ?? "",
      evidence: ev,
      element_ids: elements,
      rule_ids: ["R21"],
      source_ids: rule.source_ids,
      threshold_ids: [...new Set(thresholds.map((t) => t.threshold_id!))].sort(),
      card_ids: [],
      decision_ids: [r21.decision],
      thresholds_used: thresholds,
      knowledge: [ref(ctx, "rule", "R21"), ...[...new Set(thresholds.map((t) => t.threshold_id!))].map((t) => ref(ctx, "threshold", t)), ...elements.map((e) => ref(ctx, "element", e)), ref(ctx, "decision", r21.decision), ref(ctx, "override", "messages.R21")],
      triggered_at: at,
      domain: domainFor(pathway),
    });

    // Red-flag symptoms on their own (valid D014 = within 1 day).
    const t09 = recordThreshold(ctx, { threshold_id: "T09", element_id: "D014", parameter: "red-flag symptom", op: "range", value: null, low: null, high: null, unit: "n/a", source: "default", reference: `T09 URGENT; ${r21.decision}` });
    for (const s of checkins.filter((c) => toMs(c.datetime) >= symFrom)) {
      const flags = s.reported.filter((x) => r21.red_flag_symptoms_alone.includes(x));
      if (!flags.length) continue;
      urgent.push(baseItem(`R21:symptom:${s.id}`, "red_flag_symptom", `Red-flag symptom reported: ${listText(flags.map((f) => SYMPTOM_LABEL[f] ?? f))}`,
        [evidence(ctx, { element_id: "D014", item_id: s.id, label: flags.map((f) => SYMPTOM_LABEL[f] ?? f).join(", "), value: null, unit: null, date: s.datetime, source: s.provenance.source })],
        [t09], ["D014"], s.datetime));
    }

    // Urgent BP/HR readings (recent only; AMB-05) with or without qualifying symptoms.
    const lookback = ctx.asOf - analysisConfig.urgent.vital_lookback_hours * HOUR_MS;
    const recent = ctx.p.vitals.filter((v) => toMs(v.datetime) >= lookback && toMs(v.datetime) <= ctx.asOf);
    const symptomNear = (at: number) =>
      checkins.filter((c) => Math.abs(toMs(c.datetime) - at) <= r21.symptom_window_hours * HOUR_MS && c.reported.some((x) => r21.qualifying_symptoms.includes(x)));
    const tLowBp = recordThreshold(ctx, { threshold_id: "T06", element_id: "D012", parameter: "urgent systolic with symptoms", op: "<", value: r21.systolic_lt_with_symptoms, low: null, high: null, unit: "mmHg", source: "default", reference: `T06 URGENT; ${r21.decision}` });
    const htn = r21.severe_hypertension;
    const tHtn = recordThreshold(ctx, { threshold_id: "T06", element_id: "D012", parameter: `urgent BP ${htn.systolic_gte}/${htn.diastolic_gte} (${htn.combine}; provisional ${htn.ambiguity})`, op: ">=", value: htn.systolic_gte, low: null, high: htn.diastolic_gte, unit: "mmHg", source: "default", reference: `T06 URGENT; ${htn.ambiguity}` });
    const tHr = recordThreshold(ctx, { threshold_id: "T07", element_id: "D013", parameter: "urgent resting HR with symptoms", op: "range", value: null, low: r21.hr_lt_with_symptoms, high: r21.hr_gt_with_symptoms, unit: "beats/min", source: "default", reference: `T07 URGENT; ${r21.decision}` });

    for (const v of recent) {
      const at = toMs(v.datetime);
      if (v.kind === "blood_pressure") {
        const bpEv = evidence(ctx, { element_id: "D012", item_id: v.id, label: "blood pressure", value: `${v.systolic}/${v.diastolic}`, unit: "mmHg", date: v.datetime, source: v.provenance.source });
        const severe = htn.combine === "or" ? v.systolic! >= htn.systolic_gte || v.diastolic! >= htn.diastolic_gte : v.systolic! >= htn.systolic_gte && v.diastolic! >= htn.diastolic_gte;
        if (severe) {
          urgent.push(baseItem(`R21:bp-high:${v.id}`, "urgent_vital", `Very high blood pressure: ${v.systolic}/${v.diastolic} mmHg`, [bpEv], [tHtn], ["D012"], v.datetime));
        }
        if (v.systolic! < r21.systolic_lt_with_symptoms) {
          const near = symptomNear(at);
          if (near.length) urgent.push(baseItem(`R21:bp-low:${v.id}`, "urgent_vital", `Very low blood pressure (${v.systolic}/${v.diastolic} mmHg) with symptoms`,
            [bpEv, ...near.map((s) => evidence(ctx, { element_id: "D014", item_id: s.id, label: s.reported.filter((x) => r21.qualifying_symptoms.includes(x)).map((x) => SYMPTOM_LABEL[x] ?? x).join(", "), value: null, unit: null, date: s.datetime, source: s.provenance.source }))],
            [tLowBp], ["D012", "D014"], v.datetime));
        }
      } else if (v.kind === "heart_rate") {
        if (v.value! < r21.hr_lt_with_symptoms || v.value! > r21.hr_gt_with_symptoms) {
          const near = symptomNear(at);
          if (near.length) urgent.push(baseItem(`R21:hr:${v.id}`, "urgent_vital", `Resting heart rate ${v.value} beats/min with symptoms`,
            [evidence(ctx, { element_id: "D013", item_id: v.id, label: "resting heart rate", value: v.value!, unit: v.unit, date: v.datetime, source: v.provenance.source }),
              ...near.map((s) => evidence(ctx, { element_id: "D014", item_id: s.id, label: s.reported.filter((x) => r21.qualifying_symptoms.includes(x)).map((x) => SYMPTOM_LABEL[x] ?? x).join(", "), value: null, unit: null, date: s.datetime, source: s.provenance.source }))],
            [tHr], ["D013", "D014"], v.datetime));
        }
      }
    }
    evaluations.push({ rule_id: "R21", outcome: urgent.length > before ? "fired" : "not_fired", detail: `${urgent.length - before} urgent item(s).`, review_status: rule.review_status });
  }

  /* ---- R22: PHQ-9 item 9 ---- */
  const g22 = ruleUsable(ctx, "R22", [r22.threshold_id]);
  if (!g22.ok) {
    evaluations.push({ rule_id: "R22", outcome: "excluded_by_mode", detail: `URGENT PATHWAY DISABLED in ${ctx.mode} mode: ${g22.why}.`, review_status: ctx.k.rules.get("R22")!.review_status });
    ctx.warnings.push(`Urgent pathway R22 is disabled in ${ctx.mode} mode (${g22.why}). PHQ-9 item 9 is NOT being checked.`);
  } else {
    const rule = ctx.k.rules.get("R22")!;
    const from = ctx.asOf - ctx.k.dictionary.get("D016")!.validity!.amount * DAY_MS;
    // Any PHQ-9 within the D016 window with item 9 > 0 (not only the latest; AMB-10).
    const hits = ctx.p.mood.filter((m) => m.instrument === "PHQ-9" && (m.item9 ?? 0) > r22.item9_gt && toMs(m.date) >= from && toMs(m.date) <= ctx.asOf);
    const t = recordThreshold(ctx, { threshold_id: r22.threshold_id, element_id: "D016", parameter: "PHQ-9 item 9", op: ">", value: r22.item9_gt, low: null, high: null, unit: "points", source: "default", reference: "T08 URGENT" });
    for (const m of hits) {
      urgent.push({
        urgent_id: `R22:${m.id}`,
        pathway: "self_harm",
        rule_id: "R22",
        title: "Thoughts of self-harm reported (PHQ-9 item 9)",
        patient_message: messages.R22,
        clinician_note: rule.clinician_note ?? "",
        evidence: [evidence(ctx, { element_id: "D016", item_id: m.id, label: "PHQ-9 item 9", value: m.item9!, unit: "points", date: dayKey(m.date), source: m.provenance.source })],
        element_ids: ["D016"],
        rule_ids: ["R22"],
        source_ids: rule.source_ids,
        threshold_ids: [r22.threshold_id],
        card_ids: [],
        decision_ids: [],
        thresholds_used: [t],
        knowledge: [ref(ctx, "rule", "R22"), ref(ctx, "threshold", r22.threshold_id), ref(ctx, "element", "D016"), ref(ctx, "override", "messages.R22")],
        triggered_at: dayKey(m.date),
        domain: domainFor("self_harm"),
      });
    }
    evaluations.push({ rule_id: "R22", outcome: hits.length ? "fired" : "not_fired", detail: `${hits.length} PHQ-9 with item 9 > 0 in the D016 window.`, review_status: rule.review_status });
  }

  /* ---- Urgent labs (DEC-06) ---- */
  const ul = ctx.k.overrides.urgent_labs;
  for (const c of ul.checks) {
    const tStatus = ctx.k.thresholds.get(c.threshold_id)!.review_status;
    if (!usable(tStatus, ctx.mode)) { ctx.warnings.push(`Urgent lab check ${c.id} disabled in ${ctx.mode} mode (${c.threshold_id} review status is ${tStatus}).`); continue; }
    const v = latestValid(ctx, c.element, ctx.p.labs.filter((l) => l.analyte === c.analyte), (l: Lab) => l.date);
    if (!v.ok) continue; // missing labs are reported by the rules that need them
    const l = v.item;
    const hit = c.op === ">=" ? l.value >= c.value : c.op === ">" ? l.value > c.value : l.value < c.value;
    const t = recordThreshold(ctx, { threshold_id: c.threshold_id, element_id: c.element, parameter: `urgent ${c.analyte}`, op: c.op as ThresholdUse["op"], value: c.value, low: null, high: null, unit: c.unit, source: "default", reference: `${c.threshold_id} URGENT; ${ul.decision}` });
    if (!hit) continue;
    urgent.push({
      urgent_id: `${c.id}:${l.id}`,
      pathway: "urgent_lab",
      rule_id: null,
      title: `Urgent lab value: ${c.analyte} ${fmt(l.value, l.unit)}`,
      patient_message: messages.urgent_lab,
      clinician_note: messages.urgent_lab_clinician,
      evidence: [evidence(ctx, { element_id: c.element, item_id: l.id, label: c.analyte, value: l.value, unit: l.unit, date: dayKey(l.date), source: l.provenance.source })],
      element_ids: [c.element],
      rule_ids: c.related_rules,
      source_ids: ctx.k.thresholds.get(c.threshold_id)!.source_ids,
      threshold_ids: [c.threshold_id],
      card_ids: [],
      decision_ids: [ul.decision],
      thresholds_used: [t],
      knowledge: [ref(ctx, "threshold", c.threshold_id), ref(ctx, "element", c.element), ref(ctx, "decision", ul.decision), ref(ctx, "override", "messages.urgent_lab")],
      triggered_at: dayKey(l.date),
      domain: domainFor("urgent_lab"),
    });
  }

  const order = analysisConfig.urgent.pathway_order;
  urgent.sort((a, b) => order.indexOf(a.pathway) - order.indexOf(b.pathway) || b.triggered_at.localeCompare(a.triggered_at) || a.urgent_id.localeCompare(b.urgent_id));
  return { urgent, evaluations };
}
