"use client";

import { usePatient } from "@/lib/context/PatientContext";
import { Wordmark } from "@/components/Wordmark";
import { CATEGORY_LABELS, LEVEL_STYLES } from "@/components/Badges";
import { withinLastDays, mean } from "@/lib/safetyEngine/rules/types";
import { latestLabs } from "@/lib/passport/selectors";
import { questionsForClinician } from "@/lib/reconcile";

function fmt(d: string) {
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SharePage() {
  const { record, flags, indicators, now, issues } = usePatient();
  const recordQuestions = questionsForClinician(issues);
  const { patient } = record;
  const moods14 = withinLastDays(record.moods, 14, now);
  const moods14Avg = mean(moods14.map((m) => m.score));
  const nutrition14 = withinLastDays(record.nutrition, 14, now);
  const symptoms14 = withinLastDays(record.symptoms, 14, now);
  const symptomSummary = [...symptoms14.reduce((m, s) => m.set(s.symptom, (m.get(s.symptom) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const latestVitals = [...patient.vitals].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  return (
    <div>
      <div className="print-hidden">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-navy">Share with a clinician</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              A one-page snapshot of your medicines, active safety questions and recent trends — print it or show it on your phone at your
              next appointment. You decide who sees it.
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="min-h-11 shrink-0 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            Print / Save as PDF
          </button>
        </div>
      </div>

      <article className="print-page mx-auto max-w-3xl rounded-card border border-line bg-white p-6 shadow-card sm:p-10">
        <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark size="sm" />
            <p className="mt-2 text-xs uppercase tracking-wider text-ink-muted">Patient-prepared visit summary</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-serif text-xl font-semibold text-navy">{patient.name}</p>
            <p className="text-ink-soft">
              Age {patient.age} · {patient.sex === "female" ? "F" : patient.sex === "male" ? "M" : "—"} · Patient ID {patient.id}
            </p>
            <p className="text-ink-muted">Prepared {fmt(now.toISOString())} for {patient.primaryClinician}</p>
          </div>
        </header>

        <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Status at a glance</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {indicators.map((i) => (
              <div key={i.domain} className={`rounded-lg border border-line border-l-4 px-3 py-2 ${LEVEL_STYLES[i.level].accent}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{i.label}</p>
                <p className="text-sm font-semibold text-ink">{LEVEL_STYLES[i.level].label}</p>
                <p className="text-xs text-ink-muted">{i.metric}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Conditions</h2>
          <p className="mt-1 text-sm text-ink">{patient.conditions.map((c) => `${c.name}${c.code ? ` (${c.code})` : ""}`).join(" · ")}</p>
        </section>

        <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Current medications ({patient.medications.length})</h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="py-1.5 pr-2 font-semibold">Medicine</th>
                <th className="py-1.5 pr-2 font-semibold">Dose</th>
                <th className="py-1.5 pr-2 font-semibold">Frequency</th>
                <th className="py-1.5 font-semibold">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {patient.medications.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 pr-2 font-medium text-ink">
                    {m.name}
                    {m.indication && <span className="block text-xs font-normal text-ink-muted">{m.indication}</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-ink">{m.dose}</td>
                  <td className="py-1.5 pr-2 text-ink">{m.frequency}</td>
                  <td className="py-1.5 text-ink">{fmt(m.startDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {patient.medicationHistory.length > 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              Recent changes: {patient.medicationHistory.map((e) => `${fmt(e.date)} — ${e.detail}`).join(" ")}
            </p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Questions for this visit ({flags.length})</h2>
          <p className="text-xs text-ink-muted">Raised by Parthia&apos;s rule-based safety check from the patient&apos;s medication list and self-reported entries. Not a clinical assessment.</p>
          {flags.length === 0 ? (
            <p className="mt-2 text-sm text-ink">No active flags.</p>
          ) : (
            <ol className="mt-2 space-y-3">
              {flags.map((f, i) => (
                <li key={f.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-semibold text-ink">
                    {i + 1}. {f.title}{" "}
                    <span className="ml-1 rounded-full bg-cream-dark px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                      {f.severity} · {CATEGORY_LABELS[f.category]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">Involves: {f.medications.join(", ")}</p>
                  <p className="mt-1 text-sm text-ink-soft">{f.explanation}</p>
                  <p className="mt-1 text-sm text-ink">
                    <span className="font-semibold">Question: </span>
                    {f.suggestedNextStep}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {recordQuestions.length > 0 && (
          <section className="mt-6">
            <h2 className="font-serif text-lg font-semibold text-navy">Questions about my records ({recordQuestions.length})</h2>
            <p className="text-xs text-ink-muted">Differences the patient found between their own list and connected records, and wants to confirm with you.</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink">
              {recordQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Recent labs & vitals</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {latestLabs(patient.labs).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-1.5">
                  <span className="text-ink">
                    {l.name} <span className="text-xs text-ink-muted">{fmt(l.date)}</span>
                  </span>
                  <span className={`font-semibold ${l.status === "abnormal" ? "text-attention" : l.status === "borderline" ? "text-gold-700" : "text-ink"}`}>
                    {l.value}
                    {l.unit ? ` ${l.unit}` : ""}
                  </span>
                </li>
              ))}
              {latestVitals && (
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-ink">
                    Blood pressure <span className="text-xs text-ink-muted">{fmt(latestVitals.timestamp)}</span>
                  </span>
                  <span className="font-semibold text-ink">
                    {latestVitals.systolic}/{latestVitals.diastolic} · HR {latestVitals.heartRate}
                  </span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Last 14 days, self-reported</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              <li className="flex items-center justify-between py-1.5">
                <span className="text-ink">Mood (1–5)</span>
                <span className="font-semibold text-ink">
                  {moods14Avg?.toFixed(1) ?? "—"} avg · {moods14.length} check-ins
                </span>
              </li>
              <li className="flex items-center justify-between py-1.5">
                <span className="text-ink">Meals logged</span>
                <span className="font-semibold text-ink">
                  {nutrition14.length} on {new Set(nutrition14.map((e) => e.timestamp.slice(0, 10))).size} days
                </span>
              </li>
              <li className="py-1.5">
                <span className="text-ink">Symptoms</span>
                <p className="text-ink-soft">{symptomSummary.length ? symptomSummary.map(([s, n]) => `${s} (${n})`).join(", ") : "None logged"}</p>
              </li>
            </ul>
          </div>
        </section>

        <footer className="mt-8 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-muted">
          Prototype with synthetic data. Generated by Parthia Health from information the patient owns and chose to share. Flags are the output of
          transparent rules (listed in the app under Medications → How the safety check works) and are intended to prompt discussion, not to direct treatment.
        </footer>
      </article>
    </div>
  );
}
