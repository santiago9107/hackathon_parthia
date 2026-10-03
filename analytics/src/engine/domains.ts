/**
 * 6.2 Holistic domain profile: 8 domains, each with its own status and trend.
 * Domains are NEVER combined into one score.
 *
 * Status: worst severity of findings/urgent items in the domain mapped by
 * config (Urgent/High -> attention, Moderate -> watch); otherwise
 * "insufficient_data" when a required element is missing or stale; otherwise
 * "good". Trend: recent window vs previous window (config/domains.json).
 */
import type { DomainId, DomainProfile, Finding, HolisticAnalysisBundle, MissingData, UrgentItem } from "../model/bundle";
import type { Ctx, Validity } from "./context";
import { addMissing, latestValid } from "./context";
import { listText } from "./text";
import { DAY_MS, round, toMs } from "../util/dates";
import domainsConfig from "../../config/domains.json";

type Trend = DomainProfile["trend"];
interface TrendCfg {
  metric: string;
  worse: "up" | "down" | "mixed";
  stable_tolerance?: number;
  stable_tolerance_potassium?: number;
  stable_tolerance_egfr?: number;
  min_points_each: number;
  recent_days?: number;
  previous_days?: number;
}
interface DomainCfg {
  id: DomainId;
  label: string;
  required_elements: string[];
  trend: TrendCfg | null;
  always_insufficient?: string;
}

const SEV_RANK = { urgent: 4, high: 3, moderate: 2, low: 1 } as const;

/** Is there a valid (confirmed, within window) value for a required element? */
function requiredValidity(ctx: Ctx, el: string): Validity<unknown> {
  const p = ctx.p;
  switch (el) {
    case "D005":
      return ctx.activeMeds.length
        ? { ok: true, item: ctx.activeMeds[0], at: ctx.asOf }
        : { ok: false, reason: "no_data", detail: "No confirmed active medicines on the list.", last: null, lastAt: null };
    case "D006": return latestValid(ctx, el, p.adherence, (a) => a.period_end);
    case "D007": return latestValid(ctx, el, p.labs.filter((l) => l.analyte === "potassium"), (l) => l.date);
    case "D009": return latestValid(ctx, el, p.labs.filter((l) => l.analyte === "egfr" || l.analyte === "creatinine"), (l) => l.date);
    case "D011": return latestValid(ctx, el, p.vitals.filter((v) => v.kind === "weight"), (v) => v.datetime);
    case "D012": return latestValid(ctx, el, p.vitals.filter((v) => v.kind === "blood_pressure"), (v) => v.datetime);
    case "D013": return latestValid(ctx, el, p.vitals.filter((v) => v.kind === "heart_rate"), (v) => v.datetime);
    case "D014": return latestValid(ctx, el, p.symptoms, (s) => s.datetime);
    case "D015": return latestValid(ctx, el, p.dietLogs, (d) => d.date);
    case "D016": return latestValid(ctx, el, p.mood, (m) => m.date);
    default: throw new Error(`No requirement check for ${el}`);
  }
}

/* ---- trend -------------------------------------------------------------- */

interface Point { at: number; value: number }

function windows(ctx: Ctx, cfg: TrendCfg) {
  const recentDays = cfg.recent_days ?? domainsConfig.trend.recent_days;
  const previousDays = cfg.previous_days ?? domainsConfig.trend.previous_days;
  const recentFrom = ctx.asOf - recentDays * DAY_MS;
  const previousFrom = recentFrom - previousDays * DAY_MS;
  return { recentDays, previousDays, inRecent: (t: number) => t > recentFrom && t <= ctx.asOf, inPrevious: (t: number) => t > previousFrom && t <= recentFrom };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Compare two windows of a metric. `worse` is the direction that means worse. */
function compare(points: Point[], ctx: Ctx, cfg: TrendCfg, tolerance: number, worse: "up" | "down", label: string, unit: string): { trend: Trend; detail: string } {
  const w = windows(ctx, cfg);
  const recent = points.filter((p) => w.inRecent(p.at)).map((p) => p.value);
  const prev = points.filter((p) => w.inPrevious(p.at)).map((p) => p.value);
  if (recent.length < cfg.min_points_each || prev.length < cfg.min_points_each) {
    return { trend: "unknown", detail: `${label}: not enough data to compare the last ${w.recentDays} days with the previous ${w.previousDays} (${recent.length} and ${prev.length} values; ${cfg.min_points_each} needed in each).` };
  }
  const r = mean(recent);
  const p = mean(prev);
  const diff = r - p;
  const trend: Trend = Math.abs(diff) <= tolerance ? "stable" : (diff > 0) === (worse === "up") ? "worsening" : "improving";
  return { trend, detail: `${label}: average ${round(r, 2)}${unit} in the last ${w.recentDays} days vs ${round(p, 2)}${unit} in the previous ${w.previousDays} (stable within ${tolerance}${unit}; ${worse === "up" ? "higher" : "lower"} is worse) -> ${trend}.` };
}

function combine(parts: { trend: Trend; detail: string }[]): { trend: Trend; detail: string } {
  const known = parts.filter((p) => p.trend !== "unknown");
  const trend: Trend = !known.length ? "unknown" : known.some((p) => p.trend === "worsening") ? "worsening" : known.some((p) => p.trend === "improving") ? "improving" : "stable";
  return { trend, detail: parts.map((p) => p.detail).join(" ") };
}

function domainTrend(ctx: Ctx, cfg: TrendCfg | null, timeline: HolisticAnalysisBundle["timeline"]): { trend: Trend; detail: string } {
  if (!cfg) return { trend: "unknown", detail: "No time series is defined for this domain." };
  const series = timeline.daily_series;
  const pts = (xs: { date: string; value: number }[]) => xs.map((x) => ({ at: toMs(x.date), value: x.value }));
  switch (cfg.metric) {
    case "weight_kg":
      return compare(pts(series.weight_kg), ctx, cfg, cfg.stable_tolerance!, "up", "Weight", " kg");
    case "phq9_score":
      return compare(pts(series.phq9_score), ctx, cfg, cfg.stable_tolerance!, "up", "PHQ-9", " points");
    case "diet_risk_tags_per_log":
      return compare(ctx.p.dietLogs.map((d) => ({ at: toMs(d.date), value: d.tags.length })), ctx, cfg, cfg.stable_tolerance!, "up", "Diet risk tags per log", "");
    case "missed_doses_per_day": {
      // Each weekly check-in is one point: missed doses per day covered.
      const points = ctx.p.adherence.map((a) => ({ at: toMs(a.period_end), value: a.missed.length / a.period_days }));
      return compare(points, ctx, cfg, cfg.stable_tolerance!, "up", "Missed doses per day", "");
    }
    case "out_of_range_share": {
      // Unambiguous alert limits only: systolic below the R09 limit, HR below R17 or above R18.
      // The R16 high-BP limit is left out until AMB-01 is decided.
      const r = ctx.k.overrides.rules;
      const points = ctx.p.vitals
        .filter((v) => v.kind === "blood_pressure" || v.kind === "heart_rate")
        .map((v) => ({
          at: toMs(v.datetime),
          value: v.kind === "blood_pressure" ? Number(v.systolic! < r.R09.systolic_lt) : Number(v.value! < r.R17.hr_lt || v.value! > r.R18.hr_gt),
        }));
      return compare(points, ctx, cfg, cfg.stable_tolerance!, "up", "Share of BP/HR readings outside alert limits", "");
    }
    case "labs": {
      // Potassium: distance outside the lab-reported reference range (threshold priority 2). eGFR: lower is worse.
      const kPoints = ctx.p.labs
        .filter((l) => l.analyte === "potassium" && l.reference_range?.low !== undefined && l.reference_range?.high !== undefined)
        .map((l) => ({ at: toMs(l.date), value: Math.max(0, l.value - l.reference_range!.high!, l.reference_range!.low! - l.value) }));
      const ePoints = ctx.p.labs.filter((l) => l.analyte === "egfr").map((l) => ({ at: toMs(l.date), value: l.value }));
      return combine([
        compare(kPoints, ctx, cfg, cfg.stable_tolerance_potassium!, "up", "Potassium distance outside the lab's range", " mEq/L"),
        compare(ePoints, ctx, cfg, cfg.stable_tolerance_egfr!, "down", "eGFR", ""),
      ]);
    }
    default:
      throw new Error(`Unknown trend metric ${cfg.metric}`);
  }
}

/* ---- profile ------------------------------------------------------------ */

export function buildDomainProfile(ctx: Ctx, findings: Finding[], urgent: UrgentItem[], timeline: HolisticAnalysisBundle["timeline"]): DomainProfile[] {
  const statusBySeverity = domainsConfig.status_by_severity as Record<Finding["severity"], DomainProfile["status"]>;
  return (domainsConfig.domains as DomainCfg[]).map((d) => {
    const fs = findings.filter((f) => f.domain === d.id);
    const us = urgent.filter((u) => u.domain === d.id);
    const missing: MissingData[] = [];
    for (const el of d.required_elements) {
      const v = requiredValidity(ctx, el);
      if (v.ok) continue;
      addMissing(ctx, el, "", v);
      const m = ctx.missing.get(el)!;
      if (!m.needed_by_domains.includes(d.id)) m.needed_by_domains.push(d.id);
      m.needed_by_domains.sort();
      missing.push(m);
    }
    const missingNames = missing.map((m) => m.element_name.toLowerCase());
    const sevs: Finding["severity"][] = [...fs.map((f) => f.severity), ...us.map(() => "urgent" as const)];
    const worst = sevs.sort((a, b) => SEV_RANK[b] - SEV_RANK[a])[0];

    let status: DomainProfile["status"];
    let reason: string;
    if (d.always_insufficient) {
      status = "insufficient_data";
      reason = `Not assessed yet: ${d.always_insufficient}`;
    } else if (worst) {
      status = statusBySeverity[worst];
      const items = [...us.map((u) => `${u.title} (urgent)`), ...fs.map((f) => `${f.title} (${f.severity})`)];
      reason = `${items.length} item${items.length > 1 ? "s" : ""} to discuss with the care team: ${listText(items)}.`;
      if (missing.length) reason += ` Some data is also missing or out of date: ${listText(missingNames)}.`;
    } else if (missing.length) {
      status = "insufficient_data";
      reason = `Not enough recent data to assess: ${listText(missingNames)} ${missing.length > 1 ? "are" : "is"} missing or out of date.`;
    } else {
      status = "good";
      reason = "No findings from the rules checked in this domain, and the required data is current.";
    }
    const trend = d.always_insufficient ? { trend: "unknown" as Trend, detail: d.always_insufficient } : domainTrend(ctx, d.trend, timeline);
    return {
      domain: d.id,
      label: d.label,
      status,
      trend: trend.trend,
      reason,
      trend_detail: trend.detail,
      finding_ids: fs.map((f) => f.finding_id),
      urgent_ids: us.map((u) => u.urgent_id),
      missing_element_ids: missing.map((m) => m.element_id),
      element_ids: [...new Set([...d.required_elements, ...fs.flatMap((f) => f.element_ids), ...us.flatMap((u) => u.element_ids)])].sort(),
      rule_ids: [...new Set([...fs.flatMap((f) => f.rule_ids), ...us.flatMap((u) => u.rule_ids)])].sort(),
    };
  });
}
