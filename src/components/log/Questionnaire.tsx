"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { FormPage, SubmitBar, useSave } from "@/components/log/FormKit";
import { fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { REFERENCE_DATE } from "@/lib/mockData";
import { addEntries } from "@/lib/passport/actions";
import { newId } from "@/lib/passport/ops";
import { youSource } from "@/lib/log/entries";
import { ITEMS, RESPONSE_OPTIONS, SCREENING_DISCLAIMER, SELF_HARM_SUPPORT, STEM, scoreScreening, type ScreeningResult } from "@/lib/screening";
import type { MentalHealthAssessment, ScreeningInstrument } from "@/lib/types";

const TITLES: Record<ScreeningInstrument, { title: string; about: string }> = {
  "PHQ-9": { title: "PHQ-9 mood screening", about: "Nine questions about how you've felt over the last two weeks." },
  "GAD-7": { title: "GAD-7 anxiety screening", about: "Seven questions about worry and nerves over the last two weeks." },
};

const BAND_NOTE: Record<string, string> = {
  Minimal: "You reported few of these symptoms.",
  Mild: "You reported some of these symptoms. It can help to keep an eye on how things go and mention it at your next visit.",
  Moderate: "You reported a number of these symptoms. This is worth talking over with your clinician.",
  "Moderately severe": "You reported many of these symptoms. Please talk with your clinician soon about how you're feeling.",
  Severe: "You reported many of these symptoms, often. Please contact your clinician soon — you don't have to wait for your next appointment.",
};

/** Supportive crisis-resources message (PHQ-9 item 9). Never blocks the user. */
export function SelfHarmSupport({ id }: { id?: string }) {
  return (
    <div id={id} role="alert" className="rounded-card border-2 border-attention/40 bg-attention-soft p-4 text-sm text-ink">
      <p className="font-serif text-lg font-semibold text-navy">{SELF_HARM_SUPPORT.title}</p>
      <p className="mt-1 leading-relaxed">{SELF_HARM_SUPPORT.body}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        <li><a href={SELF_HARM_SUPPORT.actions[0].href} className="flex min-h-12 flex-col justify-center rounded-xl bg-attention px-4 py-2 font-semibold text-white">Call 988<span className="text-xs font-normal text-white/90">Suicide &amp; Crisis Lifeline, 24/7</span></a></li>
        <li><a href={SELF_HARM_SUPPORT.actions[0].smsHref} className="flex min-h-12 flex-col justify-center rounded-xl bg-surface px-4 py-2 font-semibold text-attention ring-1 ring-attention/40">Text 988<span className="text-xs font-normal text-ink-soft">Free and confidential</span></a></li>
        <li><a href={SELF_HARM_SUPPORT.actions[1].href} className="flex min-h-12 flex-col justify-center rounded-xl bg-surface px-4 py-2 font-semibold text-attention ring-1 ring-attention/40">Call 911<span className="text-xs font-normal text-ink-soft">If you are in immediate danger</span></a></li>
      </ul>
      <p className="mt-3 leading-relaxed">{SELF_HARM_SUPPORT.followUp}</p>
    </div>
  );
}

export function Questionnaire({ instrument }: { instrument: ScreeningInstrument }) {
  const { patientId, record } = usePatient();
  const items = ITEMS[instrument];
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));
  const [missing, setMissing] = useState<number[]>([]);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  // The previous result, captured before saving (the record updates as soon as we save).
  const [previousAtSubmit, setPreviousAtSubmit] = useState<MentalHealthAssessment | undefined>();
  const { busy, error, save } = useSave();
  const baseId = useId();
  const answered = answers.filter((a) => a !== null).length;
  const previous = record.assessments.filter((a) => a.instrument === instrument).sort((a, b) => b.date.localeCompare(a.date))[0];
  const selfHarm = instrument === "PHQ-9" && (answers[8] ?? 0) > 0;

  async function submit() {
    const gaps = answers.map((a, i) => (a === null ? i : -1)).filter((i) => i >= 0);
    setMissing(gaps);
    if (gaps.length) {
      document.getElementById(`${baseId}-q${gaps[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const r = scoreScreening(instrument, answers as number[]);
    setPreviousAtSubmit(previous);
    const entry: MentalHealthAssessment = {
      id: newId("as-you"), patientId, instrument, date: REFERENCE_DATE, score: r.score, severity: r.severity,
      answers: answers as number[], administeredBy: "self", source: youSource(),
    };
    if (await save(() => addEntries(patientId, "assessments", [entry], `${instrument} screening: ${r.score} (${r.severity})`))) {
      setResult(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (result) {
    return (
      <FormPage title={`${instrument} result`} eyebrow="Screening">
        <div className="space-y-5">
          {result.selfHarmResponse && <SelfHarmSupport />}
          <div role="status" className="rounded-card border border-line bg-surface p-5 shadow-card">
            <p className="text-sm text-ink-muted">Your score</p>
            <p className="font-serif text-4xl font-semibold text-navy">{result.score} <span className="text-lg font-normal text-ink-muted">/ {result.max}</span></p>
            <p className="mt-1 text-lg font-semibold text-ink">{result.severity}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{BAND_NOTE[result.severity]}</p>
            {previousAtSubmit && <p className="mt-2 text-sm text-ink-muted">Your previous {instrument}: {previousAtSubmit.score} ({previousAtSubmit.severity}) on {fmtDate(previousAtSubmit.date)}.</p>}
            <p className="mt-3 rounded-lg bg-cream/70 p-3 text-sm text-ink-soft"><strong className="text-ink">Screening, not a diagnosis.</strong> {SCREENING_DISCLAIMER}</p>
          </div>
          <p className="text-sm text-ink-soft">Saved to your Passport. It will be included when you share a summary with your clinician — you choose.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/passport/mental-health/" className="inline-flex min-h-12 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">See my history</Link>
            <Link href="/passport/share/" className="inline-flex min-h-12 items-center rounded-full bg-surface px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">Share with my clinician</Link>
          </div>
        </div>
      </FormPage>
    );
  }

  return (
    <FormPage title={TITLES[instrument].title} eyebrow="Screening" subtitle={`${TITLES[instrument].about} It takes about two minutes.`}>
      <p className="mb-5 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
        <strong className="text-ink">This is a screening questionnaire, not a diagnosis.</strong> Your answers stay on this device unless you choose to share them.
      </p>
      <form aria-label={TITLES[instrument].title} noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
        <p className="font-semibold text-ink">{STEM}</p>
        <p className="text-sm text-ink-muted" aria-live="polite">{answered} of {items.length} answered</p>
        {items.map((q, i) => {
          const miss = missing.includes(i) && answers[i] === null;
          return (
            <div key={q}>
              <fieldset id={`${baseId}-q${i}`} aria-describedby={miss ? `${baseId}-q${i}-err` : undefined} className={`rounded-card border bg-surface p-4 shadow-card ${miss ? "border-attention" : "border-line"}`}>
                <legend className="px-1 text-[15px] font-semibold leading-snug text-ink"><span className="text-brand-600">{i + 1}.</span> {q}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {RESPONSE_OPTIONS.map((o) => {
                    const checked = answers[i] === o.value;
                    return (
                      <label key={o.value} className={`flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 text-sm transition focus-within:ring-2 focus-within:ring-brand-500 ${checked ? "border-brand-700 bg-brand-50 font-semibold text-brand-900" : "border-line-strong text-ink hover:border-brand-300"}`}>
                        <input type="radio" name={`${baseId}-q${i}`} className="sr-only" checked={checked} onChange={() => { setAnswers((a) => a.map((x, j) => (j === i ? o.value : x))); setMissing((m) => m.filter((x) => x !== i)); }} />
                        <span>{o.label}</span>
                        <span aria-hidden className="text-xs text-ink-muted">{o.value}</span>
                      </label>
                    );
                  })}
                </div>
                {miss && <p id={`${baseId}-q${i}-err`} className="mt-2 text-sm font-medium text-attention">Please choose an answer.</p>}
              </fieldset>
              {instrument === "PHQ-9" && i === 8 && selfHarm && <div className="mt-3"><SelfHarmSupport /></div>}
            </div>
          );
        })}
        <SubmitBar label="See my result" busy={busy} error={error ?? (missing.length ? `${missing.length} question${missing.length === 1 ? "" : "s"} still need an answer.` : null)} />
      </form>
    </FormPage>
  );
}
