"use client";

import { useState } from "react";
import { Card } from "@/components/PageHeader";
import { Sparkline } from "@/components/charts/Sparkline";
import { fmtDate, fmtDateTime } from "@/components/passport/PassportChrome";
import type { VitalSign } from "@/lib/types";

/**
 * Preview of a batch of device / wearable readings before they join the
 * Passport. The patient confirms them all, saves them for later review, or
 * discards them.
 */
export function ReadingsPreview({
  readings,
  duplicates,
  onConfirm,
  onLater,
  onDiscard,
}: {
  readings: VitalSign[];
  duplicates: number;
  onConfirm: () => Promise<void>;
  onLater: () => Promise<void>;
  onDiscard: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const sorted = [...readings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const series = (f: keyof VitalSign) => sorted.filter((v) => typeof v[f] === "number").map((v) => ({ x: v.timestamp, y: v[f] as number }));
  const bp = sorted.filter((v) => v.systolic !== undefined);
  const charts = [
    { label: "Resting heart rate", unit: "bpm", data: series("restingHeartRate"), range: { low: 50, high: 90 } },
    { label: "Steps", unit: "/day", data: series("steps") },
    { label: "Sleep", unit: "h", data: series("sleepHours"), range: { low: 7, high: 9 } },
    { label: "Systolic blood pressure", unit: "mmHg", data: bp.map((v) => ({ x: v.timestamp, y: v.systolic! })), range: { low: 90, high: 130 } },
  ].filter((c) => c.data.length > 0);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-serif text-xl font-semibold text-navy">Ready to add</h3>
      {readings.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Nothing new — {duplicates > 0 ? `all ${duplicates} readings are already in your Passport.` : "no readings in this period."}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            <strong className="text-ink">{readings.length} readings</strong> from {fmtDate(sorted[0].timestamp)} to {fmtDate(sorted[sorted.length - 1].timestamp)}
            {duplicates > 0 ? ` · ${duplicates} already in your Passport were skipped` : ""}.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {charts.map((c) => {
              const vals = c.data.map((d) => d.y);
              const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
              return (
                <li key={c.label} className="rounded-xl border border-line p-3">
                  <p className="text-sm font-semibold text-ink">{c.label}</p>
                  <p className="text-xs text-ink-muted">avg {c.unit === "h" ? avg.toFixed(1) : Math.round(avg).toLocaleString("en-US")} {c.unit} · range {Math.min(...vals).toLocaleString("en-US")}–{Math.max(...vals).toLocaleString("en-US")} · {vals.length} values</p>
                  <div className="mt-2"><Sparkline width={260} height={44} values={c.data} range={c.range} label={`${c.label}: ${vals.length} values, average ${Math.round(avg)}`} /></div>
                </li>
              );
            })}
          </ul>
          {bp.length > 0 && (
            <details className="mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-700">Blood pressure readings ({bp.length})</summary>
              <ul className="mt-1 grid gap-x-6 text-sm sm:grid-cols-2">
                {bp.map((v) => (
                  <li key={v.id} className="flex justify-between border-b border-line py-1.5">
                    <span className="text-ink-muted">{fmtDateTime(v.timestamp)}</span>
                    <span className={`font-semibold ${v.systolic! < 90 || v.diastolic! < 60 ? "text-[#7a5812]" : v.systolic! >= 140 ? "text-attention" : "text-ink"}`}>
                      {v.systolic}/{v.diastolic}{v.heartRate ? ` · ${v.heartRate} bpm` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run(onConfirm)} className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">Confirm and add {readings.length} readings</button>
            <button type="button" disabled={busy} onClick={() => run(onLater)} className="min-h-12 rounded-full px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50 disabled:opacity-50">Save for review later</button>
            <button type="button" disabled={busy} onClick={onDiscard} className="min-h-12 rounded-full px-5 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-cream-dark disabled:opacity-50">Discard</button>
          </div>
        </>
      )}
    </Card>
  );
}
