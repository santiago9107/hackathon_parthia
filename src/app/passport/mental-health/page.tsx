"use client";

import Link from "next/link";
import { Card, Disclaimer } from "@/components/PageHeader";
import { Sparkline } from "@/components/charts/Sparkline";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { SCREENING_DISCLAIMER, maxScore } from "@/lib/screening";
import { withinLastDays } from "@/lib/safetyEngine/rules/types";
import type { ScreeningInstrument } from "@/lib/types";

const INSTRUMENTS: { id: ScreeningInstrument; name: string; about: string; href: string }[] = [
  { id: "PHQ-9", name: "PHQ-9 (depression screening)", about: "9 questions about the last two weeks", href: "/log/phq-9/" },
  { id: "GAD-7", name: "GAD-7 (anxiety screening)", about: "7 questions about the last two weeks", href: "/log/gad-7/" },
];

const BEHAVIORAL = /psych|therapy|behavioral|counsel/i;

export default function MentalHealthPage() {
  const { record, now } = usePatient();
  const notes = record.encounters.filter((e) => BEHAVIORAL.test(e.specialty) || e.type === "therapy").sort((a, b) => b.date.localeCompare(a.date));
  const moods = withinLastDays(record.moods, 35, now);
  const daily = new Map<string, number[]>();
  for (const m of moods) daily.set(m.timestamp.slice(0, 10), [...(daily.get(m.timestamp.slice(0, 10)) ?? []), m.score]);
  const dailyMeans = [...daily.entries()].sort().map(([d, s]) => ({ x: d, y: s.reduce((a, b) => a + b, 0) / s.length }));
  const changes = record.patient.medicationHistory.filter((h) => record.patient.medications.some((m) => m.name === h.medicationName && ["ssri", "snri", "z-drug", "benzodiazepine", "antipsychotic", "tricyclic-antidepressant"].includes(m.class)));

  return (
    <div className="space-y-6">
      <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
        <strong className="text-ink">Screenings, not diagnoses.</strong> {SCREENING_DISCLAIMER}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {INSTRUMENTS.map((inst) => {
          const results = record.assessments.filter((a) => a.instrument === inst.id).sort((a, b) => a.date.localeCompare(b.date));
          const last = results[results.length - 1];
          return (
            <Card key={inst.id} className="p-5">
              <SectionTitle>{inst.name}</SectionTitle>
              {!last ? (
                <EmptyState>No results yet.</EmptyState>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-soft">
                      Latest: <strong className="text-lg text-ink">{last.score}</strong> / {maxScore(inst.id)} · {last.severity}
                      <span className="block text-xs text-ink-muted">{fmtDate(last.date)} · {last.administeredBy === "self" ? "self-completed" : "with a clinician"}</span>
                    </p>
                    <Sparkline width={170} values={results.map((r) => ({ x: r.date, y: r.score }))} label={`${inst.id} scores over time: ${results.map((r) => `${r.score} on ${fmtDate(r.date)}`).join(", ")}`} />
                  </div>
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {[...results].reverse().map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span><span className="font-medium text-ink">{r.score}</span> <span className="text-ink-muted">{r.severity} · {fmtDate(r.date)}</span></span>
                        <SourceBadge source={r.source} compact />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Link href={inst.href} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
                Take the {inst.id} ({inst.about})
              </Link>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <SectionTitle>Daily mood (last 5 weeks)</SectionTitle>
        {dailyMeans.length === 0 ? <EmptyState>No mood check-ins yet.</EmptyState> : (
          <>
            <Sparkline width={640} height={80} values={dailyMeans} range={{ low: 3, high: 5 }} label={`Daily mood from 1 (very low) to 5 (very good), ${dailyMeans.length} days`} />
            <p className="mt-2 text-xs text-ink-muted">1 = very low, 5 = very good. Shaded band = a comfortable range.{changes.length ? ` Medication changes: ${changes.map((c) => `${c.medicationName} ${fmtDate(c.date)}`).join(", ")}.` : ""}</p>
          </>
        )}
        <Link href="/log/mood/" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">Check in now →</Link>
      </Card>

      <Card className="p-5">
        <SectionTitle>Notes from psychology and psychiatry visits</SectionTitle>
        {notes.length === 0 ? <EmptyState>No behavioral health visit notes in your Passport.</EmptyState> : (
          <ul className="space-y-3">
            {notes.map((e) => (
              <li key={e.id} className="rounded-xl border border-line p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{e.specialty} — {e.clinician}<span className="block text-xs font-normal text-ink-muted">{fmtDate(e.date)} · {e.reason}</span></p>
                  <SourceBadge source={e.source} />
                </div>
                <p className="mt-2 leading-relaxed text-ink-soft">{e.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="rounded-card border border-attention/20 bg-attention-soft px-4 py-3 text-sm text-ink">
        If you are having thoughts of harming yourself, call or text <a href="tel:988" className="font-semibold underline">988</a> (Suicide &amp; Crisis Lifeline, 24/7). In an emergency, call <a href="tel:911" className="font-semibold underline">911</a>.
      </p>
      <Disclaimer />
    </div>
  );
}
