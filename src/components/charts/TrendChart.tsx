"use client";

import { useMemo } from "react";
import type { MedicationEvent, MoodCheckIn, NutritionEntry, SymptomEntry } from "@/lib/types";

interface Props {
  moods: MoodCheckIn[];
  nutrition: NutritionEntry[];
  symptoms: SymptomEntry[];
  events: MedicationEvent[];
  now: Date;
  days: number;
  show: { mood: boolean; nutrition: boolean; symptoms: boolean };
}

interface DayBucket {
  date: string;
  label: string;
  mood: number | null;
  meals: number;
  symptomCount: number;
  symptomMax: number;
  symptomNames: string[];
}

const W = 860;
const H = 300;
const M = { l: 40, r: 16, t: 28, b: 44 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;

function toDate(s: string) {
  return s.slice(0, 10);
}

/**
 * Lightweight SVG time-series: daily mood (line, 1–5) over meals-logged bars,
 * with symptom markers and vertical medication-change markers. No chart
 * library so the print view and offline shell stay tiny.
 */
export function TrendChart({ moods, nutrition, symptoms, events, now, days, show }: Props) {
  const buckets = useMemo<DayBucket[]>(() => {
    const out: DayBucket[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayMoods = moods.filter((m) => toDate(m.timestamp) === key);
      const dayMeals = nutrition.filter((n) => toDate(n.timestamp) === key);
      const daySymptoms = symptoms.filter((s) => toDate(s.timestamp) === key);
      out.push({
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        mood: dayMoods.length ? dayMoods.reduce((s, m) => s + m.score, 0) / dayMoods.length : null,
        meals: dayMeals.length,
        symptomCount: daySymptoms.length,
        symptomMax: daySymptoms.reduce((mx, s) => Math.max(mx, s.severity), 0),
        symptomNames: [...new Set(daySymptoms.map((s) => s.symptom))],
      });
    }
    return out;
  }, [moods, nutrition, symptoms, now, days]);

  const x = (i: number) => M.l + (PW * (i + 0.5)) / days;
  const yMood = (v: number) => M.t + PH - ((v - 1) / 4) * PH;
  const maxMeals = 4;
  const yMeals = (n: number) => M.t + PH - (Math.min(n, maxMeals) / maxMeals) * PH * 0.55;
  const barW = Math.max(3, (PW / days) * 0.6);

  const moodPath = useMemo(() => {
    let d = "";
    let pen = false;
    buckets.forEach((b, i) => {
      if (b.mood === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${yMood(b.mood).toFixed(1)} `;
      pen = true;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, days]);

  const visibleEvents = events
    .map((e) => ({ e, idx: buckets.findIndex((b) => b.date === e.date) }))
    .filter((v) => v.idx >= 0);

  const labelEvery = days > 21 ? 7 : days > 10 ? 3 : 1;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="Mood, nutrition and symptom trends">
        {/* Grid + left axis (mood 1–5) */}
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={yMood(v)} y2={yMood(v)} stroke="#e6e0d4" strokeWidth={1} />
            <text x={M.l - 8} y={yMood(v) + 4} textAnchor="end" fontSize={11} fill="#75716a">
              {v}
            </text>
          </g>
        ))}

        {/* Nutrition bars */}
        {show.nutrition &&
          buckets.map((b, i) =>
            b.meals > 0 ? (
              <rect
                key={b.date}
                x={x(i) - barW / 2}
                y={yMeals(b.meals)}
                width={barW}
                height={M.t + PH - yMeals(b.meals)}
                rx={2}
                fill="#efdcae"
              >
                <title>{`${b.label}: ${b.meals} meal${b.meals === 1 ? "" : "s"} logged`}</title>
              </rect>
            ) : null,
          )}

        {/* Medication change markers */}
        {visibleEvents.map(({ e, idx }) => (
          <g key={e.id}>
            <line x1={x(idx)} x2={x(idx)} y1={M.t - 6} y2={M.t + PH} stroke="#1b2a41" strokeWidth={1.5} strokeDasharray="4 3" />
            <rect x={x(idx) - 4} y={M.t - 22} width={Math.min(240, (e.medicationName.length + (e.type === "dose-changed" ? 13 : e.type.length + 1)) * 6.6 + 16)} height={16} rx={8} fill="#1b2a41" />
            <text x={x(idx) + 4} y={M.t - 10.5} fontSize={10.5} fontWeight={600} fill="#fff">
              {e.medicationName} {e.type === "dose-changed" ? "dose changed" : e.type}
            </text>
            <title>{`${e.date}: ${e.detail}`}</title>
          </g>
        ))}

        {/* Mood line + points */}
        {show.mood && (
          <>
            <path d={moodPath} fill="none" stroke="#0e5c56" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {buckets.map((b, i) =>
              b.mood !== null ? (
                <circle key={b.date} cx={x(i)} cy={yMood(b.mood)} r={days > 21 ? 3 : 4.5} fill="#fffdf9" stroke="#0e5c56" strokeWidth={2}>
                  <title>{`${b.label}: mood ${b.mood.toFixed(1)} / 5`}</title>
                </circle>
              ) : null,
            )}
          </>
        )}

        {/* Symptom markers along the bottom */}
        {show.symptoms &&
          buckets.map((b, i) =>
            b.symptomCount > 0 ? (
              <circle
                key={b.date}
                cx={x(i)}
                cy={M.t + PH + 12}
                r={3 + Math.min(b.symptomCount, 4)}
                fill={b.symptomMax >= 4 ? "#b5473a" : "#e0a99f"}
                opacity={0.9}
              >
                <title>{`${b.label}: ${b.symptomCount} symptom entr${b.symptomCount === 1 ? "y" : "ies"} — ${b.symptomNames.join(", ")}`}</title>
              </circle>
            ) : null,
          )}

        {/* X labels */}
        {buckets.map((b, i) =>
          i % labelEvery === 0 || i === buckets.length - 1 ? (
            <text key={b.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#75716a">
              {b.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function ChartLegend({ show, onToggle }: { show: Props["show"]; onToggle: (k: keyof Props["show"]) => void }) {
  const items: { key: keyof Props["show"]; label: string; swatch: string }[] = [
    { key: "mood", label: "Mood (1–5)", swatch: "bg-brand-700" },
    { key: "nutrition", label: "Meals logged", swatch: "bg-gold-200" },
    { key: "symptoms", label: "Symptoms", swatch: "bg-attention" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onToggle(it.key)}
          aria-pressed={show[it.key]}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
            show[it.key] ? "border-line bg-surface text-ink" : "border-transparent bg-cream-dark text-ink-muted line-through"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${it.swatch}`} />
          {it.label}
        </button>
      ))}
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink">
        <span className="h-3 w-0 border-l-2 border-dashed border-navy" />
        Medication change
      </span>
    </div>
  );
}
