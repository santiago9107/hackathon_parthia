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
    body: "Every Passport section is a real TypeScript type annotated with its FHIR R4 analogue, and every item carries its provenance: where it came from, when, and whether the patient has confirmed it.",
  },
  {
    title: "The installable app",
    body: "Web manifest, service worker with offline caching of the whole app, install prompt handling on Android and desktop Chrome, a designed Add-to-Home-Screen walkthrough for iPhone, and the notification permission flow.",
  },
  {
    title: "The deployment pipeline",
    body: "The code is linted, type-checked and unit-tested, then built as a static export and deployed on Vercel, with two small serverless functions for the Photon Health screening calls.",
  },
];

const SIMULATED: { title: string; body: string; later: string }[] = [
  {
    title: "Patients and their entries",
    body: `${listPatients().length} synthetic personas with five weeks of generated symptom, mood and nutrition entries. No real person's data appears anywhere in this prototype.`,
    later: "Real patients connect their own health systems through SMART on FHIR; their Passport stays on their device unless they choose to sync it.",
  },
  {
    title: "The assistant",
    body: "Replies are assembled by keyword rules from the patient's full Passport (medications, allergies, labs, appointments, care team, screenings, differences between records) and labelled AI-generated. There is no language model behind it yet.",
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


const PASSPORT_SOURCES: { name: string; status: "Real" | "Simulated" | "Sample data"; note: string }[] = [
  { name: "Typed entries and questionnaires", status: "Real", note: "Medicines, allergies, vitals, meals, mood, symptoms, appointments, PHQ-9 and GAD-7 — validated and stored on the device." },
  { name: "Document scan", status: "Real", note: "On-device OCR (Tesseract.js, WebAssembly) reads prescriptions and lab reports; every extracted line is reviewed before it is saved." },
  { name: "Apple Health export", status: "Real", note: "The export.zip is parsed in a background worker on the device. Nothing is uploaded." },
  { name: "Bluetooth blood pressure cuff", status: "Real", note: "Web Bluetooth, standard Blood Pressure service (0x1810), where the browser supports it." },
  { name: "Epic MyChart", status: "Simulated", note: "A simulated SMART on FHIR sign-in returns synthetic FHIR R4 bundles. The mapper and review flow are the real ones. No real Epic connection." },
  { name: "Home cuff sync", status: "Simulated", note: "Generates two weeks of readings for demos when no cuff is available." },
  { name: "The three personas", status: "Sample data", note: "Synthetic patients. No real person's data appears anywhere." },
];

const NEXT_PHASES = [
  "Real SMART on FHIR connections to patient portals (Epic, Cerner/Oracle, athenahealth) with the same mapper and review step.",
  "Encrypted sync across the patient's own devices, with the key held by the patient.",
  "A licensed drug-interaction and renal-dosing database behind the same rule functions.",
  "Sharing links with expiry and an access log, alongside today's printed and FHIR hand-over.",
  "A model-backed assistant grounded only in the Passport, held to the same rules: questions for the clinician, never instructions.",
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="About this prototype"
        title="What is real, what is simulated"
        subtitle="Parthia Health is a patient-owned medication-safety platform for people managing several chronic conditions on five or more medicines. This build is a working prototype for partner conversations, with the parts that need real integrations clearly marked."
      />

      <Card className="p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy">The problem it addresses</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft lg:columns-2 lg:gap-10">
          Adults living with diabetes, hypertension and cardiovascular disease routinely take five to ten medicines prescribed by
          several clinicians. Interactions between those medicines, and between medicines and food, mood and daily habits, are
          usually caught late, if at all, because no single party sees the whole picture. Parthia puts that picture in the
          patient&apos;s hands: their medication list, their own daily entries, and a transparent check that turns patterns into
          questions to raise with their doctor.
        </p>
      </Card>

      <section className="mt-8" id="patient-passport">
        <h2 className="font-serif text-2xl font-semibold text-navy">The Patient Passport</h2>
        <Card className="mt-3 p-5 sm:p-6">
          <p className="text-[15px] leading-relaxed text-ink-soft lg:columns-2 lg:gap-10">
            The Passport is one record of a person&apos;s health that they hold themselves: hospital records, prescriptions, labs, wearables,
            home devices and their own entries, gathered in one place with the source of every item shown. It is stored only on the
            patient&apos;s device. Imports wait for the patient to review them; nothing unconfirmed is used in any analysis. Where records
            disagree — a different dose, a medicine missing from one list — the patient decides, or turns it into a question for their
            clinician. They can export it (FHIR R4 or a Passport file), print a summary with only the sections they choose, and lock it
            with a passcode.
          </p>
        </Card>
        <Card className="mt-3 divide-y divide-line">
          {PASSPORT_SOURCES.map((x) => (
            <div key={x.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <span
                className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                  x.status === "Real" ? "bg-good-soft text-good" : "bg-gold-100 text-[#5c430d]"
                }`}
              >
                {x.status}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{x.name}</p>
                <p className="text-sm text-ink-soft">{x.note}</p>
              </div>
            </div>
          ))}
        </Card>
        <Card className="mt-3 p-5">
          <h3 className="font-serif text-lg font-semibold text-navy">Next phases</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {NEXT_PHASES.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Card>
      </section>

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
        <div className="grid gap-3 md:grid-cols-2">
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
                ["Allergy", "substance, reaction, severity, matching medicines or classes", "AllergyIntolerance"],
                ["Appointment, Encounter", "clinician, time, reason; visit notes", "Appointment, Encounter"],
                ["Immunization, Procedure", "vaccine or procedure, date, performer", "Immunization, Procedure"],
                ["CareTeamMember, CarePlan", "who looks after the patient and their instructions", "CareTeam, CarePlan"],
                ["MentalHealthAssessment", "PHQ-9 / GAD-7 score and band (a screening, not a diagnosis)", "Observation (LOINC 44261-6 / 70274-6)"],
                ["HealthDocument", "scanned or imported documents with extracted text", "DocumentReference"],
                ["DataSource", "kind, label, imported at, verified, confidence, original text", "Provenance / meta.source"],
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
              ["Hosting", "Vercel: static site plus serverless functions for Photon Health"],
              ["Safety logic", "Pure, testable rule functions with inspectable knowledge tables"],
              ["Charts", "Hand-drawn SVG, no charting library, prints cleanly"],
              ["Privacy stance", "Patient-owned data stored only on the device (IndexedDB); sharing is an explicit act by the patient"],
              ["Encryption", "Optional Passport lock: PBKDF2-SHA256 key derivation, AES-GCM 256, Web Crypto"],
              ["Interoperability", "FHIR R4 import and export with RxNorm, LOINC, ICD-10-CM, SNOMED CT and CVX codes"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <section className="mt-8" id="credits">
        <h2 className="font-serif text-2xl font-semibold text-navy">Credits</h2>
        <Card className="mt-3 space-y-4 p-5 sm:p-6">
          <div>
            <h3 className="font-semibold text-ink">Anatomy atlas</h3>
            <blockquote className="mt-2 border-l-2 border-brand-500 pl-4 text-sm leading-relaxed text-ink-soft">
              BodyParts3D, © The Database Center for Life Science, licensed under the Creative Commons Attribution-ShareAlike 2.1 Japan license.{" "}
              <a className="text-brand-700 underline" href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Source and license</a>.
              {" "}Web renderer: Human Atlas, MIT licensed.{" "}
              <a className="text-brand-700 underline" href="https://github.com/ashemag/human-atlas" target="_blank" rel="noreferrer">Human Atlas</a>.
            </blockquote>
          </div>
          <div>
            <h3 className="font-semibold text-ink">Health data and safety integrations</h3>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink-soft">
              <li><a className="text-brand-700 underline" href="https://r4.smarthealthit.org" target="_blank" rel="noreferrer">SMART Health IT sandbox</a> for synthetic FHIR R4 records.</li>
              <li><a className="text-brand-700 underline" href="https://github.com/synthetichealth/synthea" target="_blank" rel="noreferrer">Synthea</a>, with thanks to Heather Song for the sample import.</li>
              <li><a className="text-brand-700 underline" href="https://rxnav.nlm.nih.gov/REST" target="_blank" rel="noreferrer">RxNav from the National Library of Medicine</a> for ingredient mapping.</li>
              <li><a className="text-brand-700 underline" href="https://photon.health" target="_blank" rel="noreferrer">Photon Health sandbox</a> for read-only prescription screening.</li>
              <li>Thanks to Santiago Enriquez and the Parthia team for the prototype architecture and demo build.</li>
            </ul>
          </div>
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
