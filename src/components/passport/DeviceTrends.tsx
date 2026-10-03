import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import { SourceBadges } from "@/components/passport/SourceBadge";
import { withinLastDays } from "@/lib/safetyEngine/rules/types";
import type { VitalSign } from "@/lib/types";

/**
 * Resting heart rate, steps, sleep and home blood pressure from wearables
 * and devices over a window, as small trend lines. Used on Clinical and Trends.
 */
export function DeviceTrends({ vitals, now, days }: { vitals: VitalSign[]; now: Date; days: number }) {
  const recent = withinLastDays(vitals, days, now).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const fromDevices = recent.filter((v) => v.source.kind === "wearable" || v.source.kind === "device" || v.bpSetting === "home-cuff");
  const metric = (label: string, unit: string, pick: (v: VitalSign) => number | undefined, range?: { low?: number; high?: number }, decimals = 0) => {
    const pts = fromDevices.map((v) => ({ x: v.timestamp, y: pick(v) })).filter((p): p is { x: string; y: number } => p.y !== undefined);
    if (!pts.length) return null;
    const avg = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { label, unit, pts, range, avg: decimals ? avg.toFixed(decimals) : Math.round(avg).toLocaleString("en-US") };
  };
  const rows = [
    metric("Resting heart rate", "bpm", (v) => v.restingHeartRate, { low: 50, high: 90 }),
    metric("Steps", "a day", (v) => v.steps),
    metric("Sleep", "hours a night", (v) => v.sleepHours, { low: 7, high: 9 }, 1),
    metric("Home blood pressure (top number)", "mmHg", (v) => (v.bpSetting === "home-cuff" ? v.systolic : undefined), { low: 90, high: 130 }),
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) {
    return (
      <p className="text-sm text-ink-muted">
        No wearable or device readings in the last {days} days.{" "}
        <Link href="/passport/add/" className="font-semibold text-brand-700 hover:text-brand-900">Import from Apple Health or a blood pressure monitor →</Link>
      </p>
    );
  }
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label} className="rounded-xl border border-line p-3">
            <p className="text-sm font-semibold text-ink">{r.label}</p>
            <p className="text-xs text-ink-muted">average {r.avg} {r.unit} · {r.pts.length} readings</p>
            <div className="mt-2"><Sparkline width={280} height={44} values={r.pts} range={r.range} label={`${r.label} over the last ${days} days, average ${r.avg} ${r.unit}`} /></div>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">From: <SourceBadges sources={fromDevices.map((v) => v.source)} /></p>
    </div>
  );
}
