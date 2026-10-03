/**
 * D003 HF phenotype: the ONLY place it is derived (Dictionary guide rule 8).
 * Cut-offs come from overrides.json (DEC-02, 2022 AHA/ACC/HFSA definitions).
 * D003 is valid "until LVEF changes", so the latest confirmed LVEF is used
 * even when it is older than the D002 window; a stale D002 is still reported
 * as missing by rules that need a current LVEF.
 */
import type { HolisticAnalysisBundle } from "../model/bundle";
import type { Ctx } from "./context";
import { evidence, ref } from "./context";
import { dayKey, toMs } from "../util/dates";

export type Phenotype = NonNullable<HolisticAnalysisBundle["phenotype"]["value"]>;

export function calculatePhenotype(ctx: Ctx): HolisticAnalysisBundle["phenotype"] {
  const ph = ctx.k.overrides.phenotype;
  const lvefs = ctx.p.labs
    .filter((l) => l.analyte === "lvef" && toMs(l.date) <= ctx.asOf)
    .sort((a, b) => toMs(b.date) - toMs(a.date));
  const latest = lvefs[0];
  if (!latest) {
    return { element_id: "D003", value: null, lvef: null, detail: "No confirmed LVEF (D002); phenotype cannot be calculated.", decision_ids: [ph.decision] };
  }
  ref(ctx, "element", "D002");
  ref(ctx, "element", "D003");
  ref(ctx, "decision", ph.decision);
  const v = latest.value;
  const priorReduced = lvefs.slice(1).some((l) => l.value <= ph.hfimpef.prior_max_inclusive);
  let value: Phenotype;
  if (v <= ph.hfref_max_inclusive) value = "HFrEF";
  else if (priorReduced && v > ph.hfimpef.current_min_exclusive) value = "HFimpEF";
  else if (v >= ph.hfpef_min_inclusive) value = "HFpEF";
  else value = "HFmrEF";
  return {
    element_id: "D003",
    value,
    lvef: evidence(ctx, { element_id: "D002", item_id: latest.id, label: "LVEF", value: v, unit: "%", date: dayKey(latest.date), source: latest.provenance.source }),
    detail: `LVEF ${v}% on ${dayKey(latest.date)}${priorReduced ? " (an earlier LVEF was 40% or lower)" : ""} -> ${value} (${ph.decision}).`,
    decision_ids: [ph.decision],
  };
}
