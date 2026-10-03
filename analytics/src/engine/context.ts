/**
 * Shared analysis context: validity windows, missing-data registry,
 * knowledge-row citations and threshold-use log.
 */
import type { Knowledge, KnowledgeMode, ReviewStatus } from "../knowledge/index";
import { usable } from "../knowledge/index";
import { inAnyGroup, isActive, lastStartOrChange } from "../knowledge/drugs";
import type { Prepared } from "../data/prepare";
import type { Evidence, KnowledgeRef, MissingData, ThresholdUse } from "../model/bundle";
import type { Medication } from "../model/snapshot";
import { DAY_MS, dayKey, minusMonths, toMs } from "../util/dates";
import missingQuestions from "../../config/missing_questions.json";

export interface Ctx {
  k: Knowledge;
  mode: KnowledgeMode;
  asOf: number;
  asOfIso: string;
  p: Prepared;
  activeMeds: Medication[];
  missing: Map<string, MissingData>;
  thresholdsUsed: ThresholdUse[];
  knowledgeUsed: Map<string, KnowledgeRef>;
  warnings: string[];
}

export function createCtx(k: Knowledge, mode: KnowledgeMode, asOfIso: string, p: Prepared): Ctx {
  const asOf = toMs(asOfIso);
  return {
    k,
    mode,
    asOf,
    asOfIso,
    p,
    activeMeds: p.medications.filter((m) => isActive(m, asOf)),
    missing: new Map(),
    thresholdsUsed: [],
    knowledgeUsed: new Map(),
    warnings: [...p.warnings],
  };
}

/* ---- knowledge references --------------------------------------------- */

export function ref(ctx: Ctx, kind: KnowledgeRef["kind"], id: string): KnowledgeRef {
  const { k } = ctx;
  let status: KnowledgeRef["review_status"];
  if (kind === "rule") status = k.rules.get(id)!.review_status;
  else if (kind === "threshold") status = k.thresholds.get(id)!.review_status;
  else if (kind === "element") status = k.dictionary.get(id)!.review_status;
  else if (kind === "card") status = k.cards.find((c) => c.card_id === id)!.review_status;
  else if (kind === "decision") status = "clinical_lead_decision";
  else status = "draft_verify";
  const r: KnowledgeRef = { kind, id, review_status: status };
  ctx.knowledgeUsed.set(`${kind}:${id}`, r);
  return r;
}

/** True when the rule and every threshold it relies on may be used in this knowledge mode. */
export function ruleUsable(ctx: Ctx, ruleId: string, thresholdIds: string[]): { ok: boolean; why: string } {
  const rule = ctx.k.rules.get(ruleId)!;
  if (!usable(rule.review_status, ctx.mode)) return { ok: false, why: `${ruleId} review status is ${rule.review_status}` };
  for (const t of thresholdIds) {
    const st = ctx.k.thresholds.get(t)!.review_status;
    if (!usable(st, ctx.mode)) return { ok: false, why: `${t} review status is ${st}` };
  }
  // Drug-group tables and the R01-R10 element map are engineering drafts until approved.
  const draft: ReviewStatus = "draft_verify";
  if (ctx.mode === "clinical" && (ctx.k.overrides.drug_groups.review_status === draft || ctx.k.overrides.rule_elements.review_status === draft)) {
    return { ok: false, why: "drug-group and rule-element tables in overrides.json are draft_verify" };
  }
  return { ok: true, why: "" };
}

export function recordThreshold(ctx: Ctx, t: ThresholdUse): ThresholdUse {
  const key = JSON.stringify(t);
  if (!ctx.thresholdsUsed.some((x) => JSON.stringify(x) === key)) ctx.thresholdsUsed.push(t);
  return t;
}

/* ---- validity ----------------------------------------------------------- */

export type Validity<T> =
  | { ok: true; item: T; at: number }
  | { ok: false; reason: MissingData["reason"]; detail: string; last: T | null; lastAt: number | null };

/** Earliest acceptable timestamp for an element, or null when the dictionary says "until changed". */
export function validFrom(ctx: Ctx, elementId: string): number | null {
  const v = ctx.k.dictionary.get(elementId)!.validity;
  if (!v) return null;
  return v.unit === "days" ? ctx.asOf - v.amount * DAY_MS : minusMonths(ctx.asOf, v.amount);
}

/**
 * Latest confirmed item for an element that is still valid for analysis.
 * Applies the dictionary window (rule 3) and the DEC-03 context rule for
 * D007/D009 after an MRA/RAAS start or dose change.
 */
export function latestValid<T>(ctx: Ctx, elementId: string, items: T[], dateOf: (t: T) => string): Validity<T> {
  const dated = items
    .map((item) => ({ item, at: toMs(dateOf(item)) }))
    .filter((x) => x.at <= ctx.asOf)
    .sort((a, b) => b.at - a.at);
  const last = dated[0];
  const dict = ctx.k.dictionary.get(elementId)!;
  if (!last) return { ok: false, reason: "no_data", detail: `No confirmed ${dict.name} on record.`, last: null, lastAt: null };

  const vc = ctx.k.overrides.validity_context;
  if (vc.elements.includes(elementId)) {
    const changeAt = latestRaasChange(ctx);
    if (changeAt !== null) {
      // DEC-03: a result on or before the change date does not count (order within the day is unknown).
      const post = dated.find((x) => x.at > changeAt);
      if (!post) {
        const due = changeAt + vc.post_change_due_days * DAY_MS;
        const overdue = ctx.asOf > due;
        return {
          ok: false,
          reason: overdue ? "post_change_monitoring_overdue" : "post_change_monitoring_due",
          detail: `${dict.name}: no result after the MRA/RAAS medicine change on ${dayKey(changeAt)}; a post-change result is expected by ${dayKey(due)} (DEC-03).`,
          last: last.item,
          lastAt: last.at,
        };
      }
      return withinWindow(ctx, elementId, post.item, post.at);
    }
  }
  return withinWindow(ctx, elementId, last.item, last.at);
}

function withinWindow<T>(ctx: Ctx, elementId: string, item: T, at: number): Validity<T> {
  const from = validFrom(ctx, elementId);
  const dict = ctx.k.dictionary.get(elementId)!;
  if (from !== null && at < from) {
    return {
      ok: false,
      reason: "stale",
      detail: `Latest ${dict.name} is from ${dayKey(at)}, older than its ${dict.validity!.amount}-${dict.validity!.unit.replace(/s$/, "")} validity window (${elementId}); treated as missing.`,
      last: item,
      lastAt: at,
    };
  }
  return { ok: true, item, at };
}

/** Most recent start/change of an MRA, ACE inhibitor, ARB or ARNI that is still active. */
export function latestRaasChange(ctx: Ctx): number | null {
  const groups = ctx.k.overrides.validity_context.trigger_groups;
  let latest: number | null = null;
  for (const m of ctx.activeMeds) {
    if (!inAnyGroup(ctx.k, m, groups)) continue;
    const at = lastStartOrChange(m, ctx.asOf);
    if (at !== null && (latest === null || at > latest)) latest = at;
  }
  return latest;
}

/* ---- missing data ------------------------------------------------------- */

export function addMissing(ctx: Ctx, elementId: string, ruleId: string, v: Extract<Validity<unknown>, { ok: false }> | { reason: MissingData["reason"]; detail: string; last: null; lastAt: null }, lastEvidence: Evidence | null = null): void {
  const dict = ctx.k.dictionary.get(elementId)!;
  const existing = ctx.missing.get(elementId);
  if (existing) {
    if (ruleId && !existing.needed_by_rule_ids.includes(ruleId)) existing.needed_by_rule_ids.push(ruleId);
    existing.needed_by_rule_ids.sort();
    return;
  }
  const byReason = (missingQuestions.by_reason as Record<string, string>)[v.reason];
  const byElement = (missingQuestions.by_element as Record<string, string>)[elementId];
  ctx.missing.set(elementId, {
    element_id: elementId,
    element_name: dict.name,
    reason: v.reason,
    detail: v.detail,
    needed_by_rule_ids: ruleId ? [ruleId] : [],
    needed_by_domains: [],
    last_value: lastEvidence,
    // Guide rule 7: 'Later' elements are never requested from the patient.
    suggested_patient_question: dict.mvp ? (byReason ?? byElement ?? null) : null,
    knowledge: [ref(ctx, "element", elementId)],
  });
}

/* ---- evidence ----------------------------------------------------------- */

export function evidence(ctx: Ctx, e: Omit<Evidence, "conversion">): Evidence {
  return { ...e, conversion: ctx.p.conversions.get(e.item_id) ?? null };
}
