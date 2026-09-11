"use client";

import Link from "next/link";
import { PageHeader, Card, Disclaimer } from "@/components/PageHeader";
import { RULES } from "@/lib/safetyEngine";
import { CATEGORY_LABELS } from "@/components/Badges";
import { listPatients } from "@/lib/mockData";

const REAL: { title: string; body: string }[] = [
  {
    title: "The safety engine",
    body: `${RULES.length} rule functions run over the medication list and the patient's own entries every time the app loads. Each flag records the rule that raised it and the evidence it used, so a clinician can check the reasoning line by line. There is no hidden score.`,
  },
  {
    title: "Four separate indicators",
    body: "Medication Safety, Physical & Labs, Mental Health and Nutrition are computed independently and never combined. A patient can be doing well on one and poorly on another; a single number would hide exactly that.",
  },
  {
    title: "The data model",
    body: "Patient, Medication, MedicationEvent, LabResult, VitalSign, SymptomEntry, MoodCheckIn, NutritionEntry and RiskFlag are real TypeScript types, each annotated with its FHIR R4 analogue so the mapping to an EHR feed is explicit.",
  },
  {
    title: "The installable app",
    body: "Web manifest, service worker with offline caching of the whole app, install prompt handling on Android and desktop Chrome, a designed Add-to-Home-Screen walkthrough for iPhone, and the notification permission flow.",
  },
  {
    title: "The deployment pipeline",
    body: "Every push to the main branch is linted, type-checked, built as a static export and published to Azure Static Web Apps by GitHub Actions.",
  },
];

const SIMULATED: { title: string; body: string; later: string }[] = [
  {
    title: "Patients and their entries",
    body: `${listPatients().length} synthetic personas with five weeks of generated symptom, mood and nutrition entries. No real person's data appears anywhere in this prototype.`,
    later: "A FHIR client reads Patient, MedicationStatement, Condition and Observation resources from the patient's health system, and patient-reported entries are stored in Parthia's own database.",
  },
  {
    title: "The assistant",
    body: "Replies are assembled by keyword rules from the current record and labelled AI-generated. There is no language model behind it yet.",
    later: "A model-backed provider behind the same interface, given only the patient's own record as context and held to the same rule: questions for the doctor, never instructions.",
  },
  {
    title: "Interaction knowledge",
    body: "The drug-drug pairs, anticholinergic scores and grapefruit sensitivities are small illustrative tables written for this demo.",
    later: "A licensed drug-interaction database feeding the same rule functions.",
  },
  {
    title: "Reminders",
    body: "Notifications are scheduled on the device by the service worker. The push subscription is created for real but stored locally.",
    later: "A reminder service on Azure Functions that holds subscriptions and sends Web Push messages on schedule.",
  },
  {
    title: "Identity",
    body: "The patient switcher lets a presenter flip between personas. There is no sign-in.",
    later: "Patient authentication so each person sees only their own record, with explicit consent controls for sharing with a clinician.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="About this prototype"
        title="What is real, what is simulated"
        subtitle="Parthia Health is a patient-owned medication-safety platform for people managing several chronic conditions on five or more medicines. This build is a working prototype for partner conversations, with the parts that need real integrations clearly marked."
      />

      <Card className="p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy">The problem it addresses</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Adults living with diabetes, hypertension and cardiovascular disease routinely take five to ten medicines prescribed by
          several clinicians. Interactions between those medicines, and between medicines and food, mood and daily habits, are
          usually caught late, if at all, because no single party sees the whole picture. Parthia puts that picture in the
          patient&apos;s hands: their medication list, their own daily entries, and a transparent check that turns patterns into
          questions to raise with their doctor.
        </p>
      </Card>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">Built for real</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">These parts work exactly as they would in production.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {REAL.map((item) => (
            <Card key={item.title} accent="border-l-good" className="p-4">
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">Simulated for now</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">Each of these has a clean seam in the code where the real integration plugs in.</p>
        <div className="space-y-3">
          {SIMULATED.map((item) => (
            <Card key={item.title} accent="border-l-watch" className="p-4">
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                <span className="font-semibold text-brand-700">Next phase: </span>
                {item.later}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">The safety rules</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">
          Every rule is a readable function. Every flag it raises ends in a question for a clinician, never an instruction to
          change treatment.
        </p>
        <Card className="divide-y divide-line">
          {RULES.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {r.name}{" "}
                <span className="ml-1 rounded-full bg-cream-dark px-2 py-0.5 text-[11px] font-medium text-ink-soft">{CATEGORY_LABELS[r.category]}</span>
              </p>
              <p className="text-sm text-ink-muted">{r.description}</p>
            </div>
          ))}
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">The data model</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">Types are defined once and shared by the mock data, the safety engine and every screen.</p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-cream text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Holds</th>
                <th className="px-4 py-2 font-semibold">FHIR analogue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["Patient", "id, name, age, sex, conditions, medications, medication history, labs, vitals", "Patient + linked resources"],
                ["Medication", "name, generic name, class, dose, frequency, start date, indication", "MedicationStatement"],
                ["MedicationEvent", "started / dose-changed / stopped, with date and detail", "MedicationStatement history"],
                ["LabResult, VitalSign", "value, unit, date, reference range, status", "Observation"],
                ["SymptomEntry", "symptom, severity 1–5, note, timestamp", "Observation (patient-reported)"],
                ["MoodCheckIn", "score 1–5, note, timestamp", "Observation (patient-reported)"],
                ["NutritionEntry", "meal, description, tags such as high-vitamin-K or grapefruit", "Observation (patient-reported)"],
                ["RiskFlag", "rule id, category, severity, medications, explanation, suggested question, evidence", "DetectedIssue"],
              ].map(([t, h, f]) => (
                <tr key={t}>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-brand-800">{t}</td>
                  <td className="px-4 py-2 text-ink-soft">{h}</td>
                  <td className="px-4 py-2 text-ink-muted">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">How it is built</h2>
        <Card className="mt-3 p-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["Front end", "React 19, TypeScript, Next.js App Router, Tailwind CSS"],
              ["Delivery", "Static export, installable progressive web app, offline-capable"],
              ["Hosting", "Azure Static Web Apps, continuous deployment from GitHub"],
              ["Safety logic", "Pure, testable rule functions with inspectable knowledge tables"],
              ["Charts", "Hand-drawn SVG, no charting library, prints cleanly"],
              ["Privacy stance", "Patient-owned data, sharing is an explicit act by the patient"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <p className="mt-8 text-sm">
        <Link href="/" className="font-semibold text-brand-700 hover:text-brand-900">
          ← Back to dashboard
        </Link>
      </p>
      <Disclaimer />
    </div>
  );
}
