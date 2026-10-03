"use client";

import Link from "next/link";
import { AgentFace } from "@/components/agents/AgentFace";
import { LiveClock } from "@/components/LiveClock";
import { usePatient } from "@/lib/context/PatientContext";

/**
 * The front door. One question, two answers: the patient side or the
 * clinician side. Choosing the patient side always starts on Margaret, so a
 * demo never opens on whoever was selected last.
 */
const PATIENT_POINTS = [
  "See what changed in plain words",
  "Log a medicine and get an instant safety re-check",
  "Ask Nova, and watch the agents work together",
  "Prepare questions for the next visit",
];

const CLINICIAN_POINTS = [
  "Five records reconciled into one list",
  "Every finding shown with its evidence",
  "Screen a draft prescription with Photon Health",
  "See where each medication risk acts on the body",
];

const BEHIND_THE_SCENES = [
  { href: "/agents/", label: "Meet the agents", hint: "Who does what" },
  { href: "/architecture/", label: "Architecture", hint: "Five stages, one flow" },
  { href: "/analytics/", label: "Holistic analysis", hint: "Every health domain" },
  { href: "/clinician/presentation/", label: "Presentation", hint: "For the investors" },
];

function Arrow() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Tick() {
  return <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

export default function StartPage() {
  const { setPatientId } = usePatient();
  return (
    <div className="mx-auto max-w-5xl py-2 sm:py-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Welcome to Parthia Health <span className="ml-2 font-semibold normal-case tracking-normal text-ink-muted">· <LiveClock /></span></p>
        <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-navy sm:text-5xl">Medication safety that starts with the patient.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          One record the patient owns. A team of friendly agents that check it against every medicine. A clinician who makes every decision. Choose a side to begin.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="flex flex-col rounded-card border-2 border-brand-300 bg-surface p-6 shadow-card sm:p-7" aria-labelledby="patient-side">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 ring-2 ring-brand-300" aria-hidden><AgentFace id="patient" size={60} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">The patient side</p>
              <h2 id="patient-side" className="font-serif text-2xl font-semibold text-navy">I&apos;m Margaret</h2>
              <p className="text-sm text-ink-muted">72, heart failure, diabetes, nine medicines</p>
            </div>
          </div>
          <ul className="mb-6 mt-5 space-y-2.5 text-[15px] text-ink-soft">
            {PATIENT_POINTS.map((point) => <li key={point} className="flex gap-2.5"><Tick />{point}</li>)}
          </ul>
          <Link
            href="/"
            onClick={() => setPatientId("p-margaret")}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-6 text-base font-semibold text-white transition hover:bg-brand-800 md:mt-auto"
          >
            Open the patient side <Arrow />
          </Link>
        </section>

        <section className="flex flex-col rounded-card border-2 border-navy/25 bg-surface p-6 shadow-card sm:p-7" aria-labelledby="clinician-side">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-cream-dark ring-2 ring-line-strong" aria-hidden><AgentFace id="liaison" size={60} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-navy">The clinician side</p>
              <h2 id="clinician-side" className="font-serif text-2xl font-semibold text-navy">I&apos;m the care team</h2>
              <p className="text-sm text-ink-muted">Review, screen, decide</p>
            </div>
          </div>
          <ul className="mb-6 mt-5 space-y-2.5 text-[15px] text-ink-soft">
            {CLINICIAN_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5"><Tick />
                <span>{point}{point.includes("Photon") && <span className="ml-2 rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-extrabold text-ink">LIVE</span>}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/clinician/"
            onClick={() => setPatientId("p-margaret")}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-base font-semibold text-white transition hover:bg-brand-900 md:mt-auto"
          >
            Open the clinician side <Arrow />
          </Link>
        </section>
      </div>

      <div className="mt-6 rounded-card border border-line bg-cream px-5 py-4 text-center text-sm text-ink-soft">
        <strong className="text-ink">The four-minute story:</strong> Margaret logs a medicine and asks her agent (about two minutes), then her care team reviews the findings and screens a draft with Photon Health (about two minutes).
      </div>

      <h2 className="mt-8 text-center text-xs font-bold uppercase tracking-wider text-ink-muted">Behind the scenes</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {BEHIND_THE_SCENES.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-line bg-surface px-4 py-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card">
            <p className="text-sm font-semibold text-ink">{item.label}</p>
            <p className="text-xs text-ink-muted">{item.hint}</p>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-ink-muted">Demo prototype with synthetic data. Every finding is a question for a clinician; nothing here starts, stops or changes a medicine.</p>
    </div>
  );
}
