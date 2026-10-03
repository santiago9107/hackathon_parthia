"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePatient } from "@/lib/context/PatientContext";
import { VisitQuestions } from "@/components/patient/VisitQuestions";
import { usePatientAgent } from "@/lib/patientAgent/usePatientAgent";
import { buildVisitQuestions } from "@/lib/patientAgent/visitQuestions";
import { Wordmark } from "@/components/Wordmark";
import { CATEGORY_LABELS, LEVEL_STYLES } from "@/components/Badges";
import { withinLastDays, mean } from "@/lib/safetyEngine/rules/types";
import { latestLabs } from "@/lib/passport/selectors";
import { questionsForClinician } from "@/lib/reconcile";
import { recordActivity } from "@/lib/passport/actions";
import { downloadJson } from "@/lib/export/download";
import { toFhirBundle, type ExportSection } from "@/lib/export/fhirExport";
import { passportFileName } from "@/lib/export/passportFile";
import Link from "next/link";

const SHARE_SECTIONS = [
  { id: "status", label: "Status at a glance" },
  { id: "conditions", label: "Conditions", fhir: ["conditions"] },
  { id: "medications", label: "Medications and recent changes", fhir: ["medications"] },
  { id: "allergies", label: "Allergies", fhir: ["allergies"] },
  { id: "safety", label: "Safety questions (flags)" },
  { id: "recordQuestions", label: "Questions about my records" },
  { id: "visitQuestions", label: "Questions the agent prepared" },
  { id: "labs", label: "Recent labs and vitals", fhir: ["labs", "vitals"] },
  { id: "screenings", label: "Mental health screenings", sensitive: true, fhir: ["screenings"] },
  { id: "selfReported", label: "Last 14 days: mood, meals, symptoms", sensitive: true },
  { id: "immunizations", label: "Immunizations", fhir: ["immunizations"] },
  { id: "careTeam", label: "Care team and upcoming appointments", fhir: ["careTeam", "appointments"] },
  { id: "emergency", label: "Emergency contacts", sensitive: true },
] as const satisfies readonly { id: string; label: string; sensitive?: boolean; fhir?: readonly ExportSection[] }[];
type ShareSection = (typeof SHARE_SECTIONS)[number]["id"];
const DEFAULT_SECTIONS: ShareSection[] = ["status", "conditions", "medications", "allergies", "safety", "recordQuestions", "labs"];

function fmt(d: string) {
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * `useSearchParams` is client-only and must sit inside a Suspense boundary,
 * the same pattern as src/app/log/medication/page.tsx. `?prepare=1` arrives
 * from the "Prepare for my visit" action on the dashboard and pre-ticks the
 * visit questions section. Without it the share page behaves exactly as before.
 */
export default function SharePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading your summary…</p>}>
      <ShareBuilder />
    </Suspense>
  );
}

function ShareBuilder() {
  const prepare = useSearchParams().get("prepare") === "1";
  const { record, flags, indicators, now, issues, patientId } = usePatient();
  const { update } = usePatientAgent();
  const recordQuestions = questionsForClinician(issues);
  const visitQuestions = useMemo(() => buildVisitQuestions(update, issues, record), [update, issues, record]);
  const [chosen, setChosen] = useState<Set<ShareSection>>(() => new Set(prepare ? [...DEFAULT_SECTIONS, "visitQuestions" as ShareSection] : DEFAULT_SECTIONS));
  const on = (id: ShareSection) => chosen.has(id);
  const toggle = (id: ShareSection) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosenLabels = SHARE_SECTIONS.filter((x) => chosen.has(x.id)).map((x) => x.label);
  const fhirSections = SHARE_SECTIONS.filter((x) => chosen.has(x.id)).flatMap((x) => ("fhir" in x ? [...x.fhir] : []));

  async function print() {
    await recordActivity(patientId, "share", `Printed or saved a visit summary: ${chosenLabels.join(", ") || "header only"}`);
    window.print();
  }
  async function downloadFhir() {
    const bundle = toFhirBundle(record, { now, sections: fhirSections });
    downloadJson(passportFileName(record, now, "fhir"), bundle, "application/fhir+json");
    await recordActivity(patientId, "share", `Downloaded shared sections as FHIR R4 (${bundle.entry?.length ?? 0} resources)`);
  }
  const upcoming = record.appointments.filter((a) => a.status === "booked" && a.start >= now.toISOString().slice(0, 19)).sort((a, b) => a.start.localeCompare(b.start));
  const screenings = [...record.assessments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
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
              Choose what to include. The preview below is exactly what will be printed or saved — nothing else is shared, and nothing is sent
              anywhere: you hand it over yourself.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/clinician/" className="min-h-11 rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-brand-900">
              Open as clinician →
            </Link>
            <button
              type="button"
              onClick={() => setChosen((prev) => new Set(prev).add("visitQuestions"))}
              disabled={on("visitQuestions")}
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50 disabled:opacity-50"
            >
              {on("visitQuestions") ? `Visit questions included (${visitQuestions.length})` : "Prepare for my visit"}
            </button>
            <button type="button" onClick={print} className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
              Print / Save as PDF
            </button>
            <button type="button" onClick={downloadFhir} disabled={fhirSections.length === 0} className="min-h-11 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50 disabled:opacity-50">
              Download as FHIR
            </button>
          </div>
        </div>
        <fieldset className="mb-6 rounded-card border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Sections to share ({chosen.size} of {SHARE_SECTIONS.length})</legend>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {SHARE_SECTIONS.map((x) => (
              <label key={x.id} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={on(x.id)} onChange={() => toggle(x.id)} className="h-5 w-5 accent-brand-700" />
                {x.label}
                {"sensitive" in x && <span className="rounded-full bg-cream-dark px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Sensitive</span>}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">FHIR download includes the coded sections only (conditions, medications, allergies, labs, vitals, screenings, immunizations, care team).</p>
        </fieldset>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Preview</p>
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

        {on("status") && <section className="mt-6">
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
        </section>}

        {on("conditions") && <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Conditions</h2>
          <p className="mt-1 text-sm text-ink">{patient.conditions.map((c) => `${c.name}${c.code ? ` (${c.code})` : ""}`).join(" · ")}</p>
        </section>}

        {on("allergies") && <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Allergies ({record.allergies.length})</h2>
          <p className="mt-1 text-sm text-ink">
            {record.allergies.length
              ? record.allergies.map((a) => `${a.substance}${a.reaction ? ` — ${a.reaction.toLowerCase()}` : ""} (${a.severity}${a.type === "intolerance" ? ", intolerance" : ""})`).join(" · ")
              : "No known allergies recorded."}
          </p>
        </section>}

        {on("medications") && <section className="mt-6">
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
        </section>}

        {on("safety") && <section className="mt-6">
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
        </section>}

        {on("recordQuestions") && recordQuestions.length > 0 && (
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

        {on("visitQuestions") && (
          <section className="mt-6">
            <h2 className="font-serif text-lg font-semibold text-navy">Questions the agent prepared ({visitQuestions.length})</h2>
            <p className="text-xs text-ink-muted">
              Written by Parthia&apos;s rule-based agent from the patient&apos;s own records: what is new since their last visit, the open safety
              flags and the differences between their list and connected records. AI-generated, not a clinical assessment, and not an instruction
              about any medicine.
            </p>
            <VisitQuestions questions={visitQuestions} className="mt-2" showChip={false} />
          </section>
        )}

        {(on("labs") || on("selfReported")) && <section className="mt-6 grid gap-6 sm:grid-cols-2">
          {on("labs") && <div>
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
          </div>}
          {on("selfReported") && <div>
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
          </div>}
        </section>}

        {on("screenings") && <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Mental health screenings</h2>
          <p className="text-xs text-ink-muted">Screenings, not diagnoses. Self-administered unless noted.</p>
          {screenings.length ? (
            <ul className="mt-2 divide-y divide-line text-sm">
              {screenings.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-1.5">
                  <span className="text-ink">{a.instrument} <span className="text-xs text-ink-muted">{fmt(a.date)}{a.administeredBy === "clinician" ? " · clinician" : ""}</span></span>
                  <span className="font-semibold text-ink">{a.score} · {a.severity}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-ink">No screenings recorded.</p>}
        </section>}

        {on("immunizations") && <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Immunizations</h2>
          <p className="mt-1 text-sm text-ink">{record.immunizations.length ? [...record.immunizations].sort((a, b) => b.date.localeCompare(a.date)).map((i) => `${i.vaccine} (${fmt(i.date)})`).join(" · ") : "None recorded."}</p>
        </section>}

        {on("careTeam") && <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Care team</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {record.careTeam.map((c) => <li key={c.id}>{c.name}{c.specialty ? ` — ${c.specialty}` : ""}{c.phone ? ` · ${c.phone}` : ""}</li>)}
              {record.careTeam.length === 0 && <li>None recorded.</li>}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">Upcoming appointments</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {upcoming.map((a) => <li key={a.id}>{fmt(a.start)} — {a.clinician} ({a.specialty}): {a.reason}</li>)}
              {upcoming.length === 0 && <li>None booked.</li>}
            </ul>
          </div>
        </section>}

        {on("emergency") && <section className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-navy">Emergency contacts</h2>
          <p className="mt-1 text-sm text-ink">
            {record.emergency?.contacts.length ? record.emergency.contacts.map((c) => `${c.name} (${c.relationship}) ${c.phone}`).join(" · ") : "None recorded."}
            {record.emergency?.bloodType ? ` · Blood type ${record.emergency.bloodType}` : ""}
          </p>
        </section>}

        <footer className="mt-8 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-muted">
          Sections shared: {chosenLabels.join(", ") || "none"}. Prototype with synthetic data. Generated by Parthia Health from information the patient owns and chose to share; only reviewed and confirmed items are included. Flags are the output of
          transparent rules (listed in the app under Medications → How the safety check works) and are intended to prompt discussion, not to direct treatment.
        </footer>
      </article>
    </div>
  );
}
