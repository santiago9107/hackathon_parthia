"use client";

import { useMemo, useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { PageHeader, Card, Disclaimer } from "@/components/PageHeader";
import { TrendChart, ChartLegend } from "@/components/charts/TrendChart";
import { withinLastDays, mean } from "@/lib/safetyEngine/rules/types";
import { SourceBadges } from "@/components/passport/SourceBadge";
import { DeviceTrends } from "@/components/passport/DeviceTrends";

export default function TrendsPage() {
  const { record, flags, now } = usePatient();
  const [days, setDays] = useState<14 | 35>(35);
  const [show, setShow] = useState({ mood: true, nutrition: true, symptoms: true });

  const symptomsRecent = withinLastDays(record.symptoms, days, now);
  const symptomTable = useMemo(() => {
    const map = new Map<string, { count: number; maxSeverity: number; last: string }>();
    for (const s of symptomsRecent) {
      const cur = map.get(s.symptom) ?? { count: 0, maxSeverity: 0, last: s.timestamp };
      map.set(s.symptom, {
        count: cur.count + 1,
        maxSeverity: Math.max(cur.maxSeverity, s.severity),
        last: s.timestamp > cur.last ? s.timestamp : cur.last,
      });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [symptomsRecent]);

  const moodsRecent = withinLastDays(record.moods, days, now);
  const nutritionRecent = withinLastDays(record.nutrition, days, now);
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of nutritionRecent) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [nutritionRecent]);
  const moodFlags = flags.filter((f) => f.category === "drug-mood" || f.category === "drug-nutrient");

  return (
    <div>
      <PageHeader
        eyebrow="Trends"
        title="Mood and meals, next to your medicines"
        subtitle="Seeing a medication change on the same timeline as your daily check-ins is often the fastest way to notice a pattern worth mentioning."
        actions={
          <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
            {([14, 35] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${days === d ? "bg-brand-700 text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {d === 14 ? "2 weeks" : "5 weeks"}
              </button>
            ))}
          </div>
        }
      />

      <p className="-mt-3 mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        Data from: <SourceBadges sources={[...moodsRecent, ...nutritionRecent, ...symptomsRecent].map((e) => e.source)} />
      </p>
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-serif text-xl font-semibold text-navy">Daily timeline</h2>
          <ChartLegend show={show} onToggle={(k) => setShow((s) => ({ ...s, [k]: !s[k] }))} />
        </div>
        <TrendChart moods={record.moods} nutrition={record.nutrition} symptoms={record.symptoms} events={record.patient.medicationHistory} now={now} days={days} show={show} />
        <p className="mt-2 text-xs text-ink-muted">Hover or tap a point for detail. Symptom dots grow with the number of entries that day; darker means a severe entry.</p>
      </Card>

      {moodFlags.length > 0 && (
        <div className="mt-4 rounded-card border border-gold-200 bg-gold-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">What the safety check sees in this timeline</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink">
            {moodFlags.map((f) => (
              <li key={f.id}>
                <span className="font-semibold">{f.title}.</span> {f.suggestedNextStep}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-serif text-lg font-semibold text-navy">Mood</h3>
          <p className="mt-2 text-3xl font-semibold text-ink">{mean(moodsRecent.map((m) => m.score))?.toFixed(1) ?? "—"} <span className="text-base font-normal text-ink-muted">/ 5 average</span></p>
          <p className="mt-1 text-sm text-ink-muted">{moodsRecent.length} check-ins in {days} days</p>
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((s) => {
              const n = moodsRecent.filter((m) => m.score === s).length;
              const pct = moodsRecent.length ? (n / moodsRecent.length) * 100 : 0;
              return (
                <div key={s} className="flex-1">
                  <div className="h-16 rounded-md bg-cream-dark" style={{ background: `linear-gradient(to top, #0e5c56 ${pct}%, #efeae0 ${pct}%)` }} />
                  <p className="mt-1 text-center text-[11px] text-ink-muted">{s}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-lg font-semibold text-navy">Meals</h3>
          <p className="mt-2 text-3xl font-semibold text-ink">
            {new Set(nutritionRecent.map((e) => e.timestamp.slice(0, 10))).size} <span className="text-base font-normal text-ink-muted">of {days} days logged</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">{nutritionRecent.length} entries</p>
          <ul className="mt-3 space-y-1.5">
            {tagCounts.slice(0, 5).map(([tag, n]) => (
              <li key={tag} className="flex items-center justify-between text-sm">
                <span className="capitalize text-ink">{tag.replace(/-/g, " ")}</span>
                <span className="font-semibold text-ink-soft">{n}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-lg font-semibold text-navy">Symptoms</h3>
          <p className="mt-2 text-3xl font-semibold text-ink">{symptomsRecent.length} <span className="text-base font-normal text-ink-muted">entries</span></p>
          {symptomTable.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">Nothing logged in this period.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {symptomTable.slice(0, 5).map(([name, s]) => (
                <li key={name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{name}</span>
                  <span className="shrink-0 text-ink-soft">
                    {s.count}× · max {s.maxSeverity}/5
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-3 font-serif text-lg font-semibold text-navy">From your wearables and devices</h3>
        <DeviceTrends vitals={record.patient.vitals} now={now} days={days} />
      </Card>

      <Disclaimer />
    </div>
  );
}
