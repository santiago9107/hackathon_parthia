/**
 * RED FLAGS FIRST (Dictionary guide rule 9; rules R21, R22; DEC-06, DEC-07).
 *
 * Runs on prepared data before, and independently of, every other analysis.
 * DEC-17: it runs in EVERY knowledge mode, even while its KB rows are Draft;
 * such items are marked "Draft – pending clinical approval".
 * DEC-18: items held back from analysis (unconfirmed imports, pending or
 * conflicting) are still checked here. If urgent, the message is shown AND
 * the item stays in needs_review. Safety over strictness.
 */
import type { RuleEvaluation, ThresholdUse, UrgentItem } from "../model/bundle";
import type { Ctx } from "./context";
import { evidence, latestValid, recordThreshold, ref, validFrom } from "./context";
import { fmt, listText } from "./text";
import { DAY_MS, HOUR_MS, dayKey, toMs } from "../util/dates";
import messages from "../../config/messages.json";
import analysisConfig from "../../config/analysis.json";
import domains from "../../config/domains.json";
import type { Lab } from "../model/snapshot";
import type { HeldStatus } from "../data/prepare";

type DataStatus = UrgentItem["data_status"];
const DATA_RANK: Record<DataStatus, number> = { confirmed: 0, unconfirmed: 1, pending_reconciliation: 2, conflict: 3 };
const DRAFT_LABEL = "Draft – pending clinical approval";

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
  const { k } = ctx;
  const r21 = k.overrides.rules.R21;
  const r22 = k.overrides.rules.R22;
  const held = ctx.p.held;
  const dataStatus = (...ids: string[]): DataStatus =>
    ids.map((id) => (held.status.get(id) as HeldStatus | undefined) ?? "confirmed").sort((a, b) => DATA_RANK[b] - DATA_RANK[a])[0] ?? "confirmed";

  /** Approved only when every rule and threshold behind the item is Approved. */
  const approval = (ruleIds: string[], thresholdIds: string[]) => {
    const statuses = [...ruleIds.map((r) => k.rules.get(r)!.review_status), ...thresholdIds.map((t) => k.thresholds.get(t)!.review_status)];
    const approved = statuses.every((s) => s === "approved");
    return { approval_status: approved ? ("approved" as const) : ("draft_pending_clinical_approval" as const), approval_label: approved ? "Approved" : DRAFT_LABEL };
  };
  const anyDraft = () => urgent.some((u) => u.approval_status !== "approved");

  // Analysed + held items; the urgent pathway never ignores a possible red flag.
  const checkins = [...ctx.p.symptoms, ...held.symptoms].filter((s) => toMs(s.datetime) <= ctx.asOf);
  const vitals = [...ctx.p.vitals, ...held.vitals];
  const mood = [...ctx.p.mood, ...held.mood];

  /* ---- R21: red-flag symptoms and urgent vitals ---- */
  {
    const before = urgent.length;
    const rule = k.rules.get("R21")!;
    const symFrom = ctx.asOf - k.dictionary.get("D014")!.validity!.amount * DAY_MS;
    const item = (id: string, pathway: UrgentItem["pathway"], title: string, ev: UrgentItem["evidence"], thresholds: ThresholdUse[], elements: string[], at: string): UrgentItem => {
      const tIds = [...new Set(thresholds.map((t) => t.threshold_id!))].sort();
      return {
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
        threshold_ids: tIds,
        card_ids: [],
        decision_ids: [r21.decision, "DEC-16", "DEC-17", "DEC-18"].sort(),
        thresholds_used: thresholds,
        knowledge: [ref(ctx, "rule", "R21"), ...tIds.map((t) => ref(ctx, "threshold", t)), ...elements.map((e) => ref(ctx, "element", e)), ref(ctx, "decision", r21.decision), ref(ctx, "override", "messages.R21")],
        triggered_at: at,
        domain: domainFor(pathway),
        ...approval(["R21"], tIds),
        data_status: dataStatus(...ev.map((e) => e.item_id)),
      };
    };
    const symptomEvidence = (s: (typeof checkins)[number], codes: string[]) =>
      evidence(ctx, { element_id: "D014", item_id: s.id, label: codes.map((x) => SYMPTOM_LABEL[x] ?? x).join(", "), value: null, unit: null, date: s.datetime, source: s.provenance.source });

    // Red-flag symptoms on their own (valid D014 = within 1 day).
    const t09 = recordThreshold(ctx, { threshold_id: "T09", element_id: "D014", parameter: "red-flag symptom", op: "range", value: null, low: null, high: null, unit: "n/a", source: "default", reference: `T09 URGENT; ${r21.decision}` });
    for (const s of checkins.filter((c) => toMs(c.datetime) >= symFrom)) {
      const flags = s.reported.filter((x) => r21.red_flag_symptoms_alone.includes(x));
      if (!flags.length) continue;
      urgent.push(item(`R21:symptom:${s.id}`, "red_flag_symptom", `Red-flag symptom reported: ${listText(flags.map((f) => SYMPTOM_LABEL[f] ?? f))}`, [symptomEvidence(s, flags)], [t09], ["D014"], s.datetime));
    }

    // Urgent BP/HR readings (recent only; AMB-05).
    const lookback = ctx.asOf - analysisConfig.urgent.vital_lookback_hours * HOUR_MS;
    const recent = vitals.filter((v) => toMs(v.datetime) >= lookback && toMs(v.datetime) <= ctx.asOf).sort((a, b) => a.id.localeCompare(b.id));
    const symptomNear = (at: number) =>
      checkins.filter((c) => Math.abs(toMs(c.datetime) - at) <= r21.symptom_window_hours * HOUR_MS && c.reported.some((x) => r21.qualifying_symptoms.includes(x)));
    const tLowBp = recordThreshold(ctx, { threshold_id: "T06", element_id: "D012", parameter: "urgent systolic with symptoms", op: "<", value: r21.systolic_lt_with_symptoms, low: null, high: null, unit: "mmHg", source: "default", reference: `T06 URGENT; ${r21.decision}` });
    const htn = r21.severe_hypertension;
    const tHtn = recordThreshold(ctx, { threshold_id: "T06", element_id: "D012", parameter: `urgent BP: systolic >= ${htn.systolic_gte} or diastolic >= ${htn.diastolic_gte}`, op: ">=", value: htn.systolic_gte, low: null, high: htn.diastolic_gte, unit: "mmHg", source: "default", reference: `T06 URGENT; ${htn.decision}` });
    const tHr = recordThreshold(ctx, { threshold_id: "T07", element_id: "D013", parameter: "urgent resting HR with symptoms", op: "range", value: null, low: r21.hr_lt_with_symptoms, high: r21.hr_gt_with_symptoms, unit: "beats/min", source: "default", reference: `T07 URGENT; ${r21.decision}` });

    for (const v of recent) {
      const at = toMs(v.datetime);
      if (v.kind === "blood_pressure") {
        const bpEv = evidence(ctx, { element_id: "D012", item_id: v.id, label: "blood pressure", value: `${v.systolic}/${v.diastolic}`, unit: "mmHg", date: v.datetime, source: v.provenance.source });
        if (v.systolic! >= htn.systolic_gte || v.diastolic! >= htn.diastolic_gte) {
          urgent.push(item(`R21:bp-high:${v.id}`, "urgent_vital", `Very high blood pressure: ${v.systolic}/${v.diastolic} mmHg`, [bpEv], [tHtn], ["D012"], v.datetime));
        }
        if (v.systolic! < r21.systolic_lt_with_symptoms) {
          const near = symptomNear(at);
          if (near.length) urgent.push(item(`R21:bp-low:${v.id}`, "urgent_vital", `Very low blood pressure (${v.systolic}/${v.diastolic} mmHg) with symptoms`,
            [bpEv, ...near.map((s) => symptomEvidence(s, s.reported.filter((x) => r21.qualifying_symptoms.includes(x))))], [tLowBp], ["D012", "D014"], v.datetime));
        }
      } else if (v.kind === "heart_rate" && (v.value! < r21.hr_lt_with_symptoms || v.value! > r21.hr_gt_with_symptoms)) {
        const near = symptomNear(at);
        if (near.length) urgent.push(item(`R21:hr:${v.id}`, "urgent_vital", `Resting heart rate ${v.value} beats/min with symptoms`,
          [evidence(ctx, { element_id: "D013", item_id: v.id, label: "resting heart rate", value: v.value!, unit: v.unit, date: v.datetime, source: v.provenance.source }),
            ...near.map((s) => symptomEvidence(s, s.reported.filter((x) => r21.qualifying_symptoms.includes(x))))], [tHr], ["D013", "D014"], v.datetime));
      }
    }
    evaluations.push({ rule_id: "R21", outcome: urgent.length > before ? "fired" : "not_fired", detail: `${urgent.length - before} urgent item(s). Runs in every mode (DEC-17).`, review_status: rule.review_status });
  }

  /* ---- R22: PHQ-9 item 9 ---- */
  {
    const rule = k.rules.get("R22")!;
    const from = ctx.asOf - k.dictionary.get("D016")!.validity!.amount * DAY_MS;
    // Any PHQ-9 within the D016 window with item 9 > 0 (not only the latest; AMB-10).
    const hits = mood.filter((m) => m.instrument === "PHQ-9" && (m.item9 ?? 0) > r22.item9_gt && toMs(m.date) >= from && toMs(m.date) <= ctx.asOf).sort((a, b) => a.id.localeCompare(b.id));
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
        decision_ids: ["DEC-16", "DEC-17", "DEC-18"],
        thresholds_used: [t],
        knowledge: [ref(ctx, "rule", "R22"), ref(ctx, "threshold", r22.threshold_id), ref(ctx, "element", "D016"), ref(ctx, "override", "messages.R22")],
        triggered_at: dayKey(m.date),
        domain: domainFor("self_harm"),
        ...approval(["R22"], [r22.threshold_id]),
        data_status: dataStatus(m.id),
      });
    }
    evaluations.push({ rule_id: "R22", outcome: hits.length ? "fired" : "not_fired", detail: `${hits.length} PHQ-9 with item 9 > 0 in the D016 window. Runs in every mode (DEC-17).`, review_status: rule.review_status });
  }

  /* ---- Urgent labs (DEC-06) ---- */
  const ul = k.overrides.urgent_labs;
  for (const c of ul.checks) {
    const t = recordThreshold(ctx, { threshold_id: c.threshold_id, element_id: c.element, parameter: `urgent ${c.analyte}`, op: c.op as ThresholdUse["op"], value: c.value, low: null, high: null, unit: c.unit, source: "default", reference: `${c.threshold_id} URGENT; ${ul.decision}` });
    const hit = (l: Lab) => (c.op === ">=" ? l.value >= c.value : c.op === ">" ? l.value > c.value : l.value < c.value);
    const candidates: Lab[] = [];
    // Latest valid analysed result.
    const v = latestValid(ctx, c.element, ctx.p.labs.filter((l) => l.analyte === c.analyte), (l: Lab) => l.date);
    if (v.ok && hit(v.item)) candidates.push(v.item);
    // Held results (unconfirmed / pending / conflict) inside the validity window and not older than the latest analysed result.
    const from = validFrom(ctx, c.element) ?? -Infinity;
    const newestAnalysed = v.ok ? v.at : -Infinity;
    for (const l of held.labs.filter((x) => x.analyte === c.analyte)) {
      const at = toMs(l.date);
      if (at <= ctx.asOf && at >= from && at >= newestAnalysed && hit(l)) candidates.push(l);
    }
    for (const l of candidates) {
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
        source_ids: k.thresholds.get(c.threshold_id)!.source_ids,
        threshold_ids: [c.threshold_id],
        card_ids: [],
        decision_ids: [ul.decision, "DEC-17", "DEC-18", "DEC-19"],
        thresholds_used: [t],
        knowledge: [ref(ctx, "threshold", c.threshold_id), ref(ctx, "element", c.element), ref(ctx, "decision", ul.decision), ref(ctx, "override", "messages.urgent_lab")],
        triggered_at: dayKey(l.date),
        domain: domainFor("urgent_lab"),
        ...approval([], [c.threshold_id]),
        data_status: dataStatus(l.id),
      });
    }
  }

  if (anyDraft()) {
    ctx.warnings.push(`Urgent items are based on knowledge that is ${DRAFT_LABEL} (R21/R22/urgent-lab thresholds). The urgent pathway runs in every mode (DEC-17).`);
  }
  if (urgent.some((u) => u.data_status !== "confirmed")) {
    ctx.warnings.push("Some urgent items come from unconfirmed, pending or conflicting data; they are shown as urgent and also listed in needs_review (DEC-18).");
  }
  const order = analysisConfig.urgent.pathway_order;
  urgent.sort((a, b) => order.indexOf(a.pathway) - order.indexOf(b.pathway) || b.triggered_at.localeCompare(a.triggered_at) || a.urgent_id.localeCompare(b.urgent_id));
  return { urgent, evaluations };
}
