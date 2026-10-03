import Link from "next/link";
import { Card, PageHeader } from "@/components/PageHeader";
import { SystemDiagram } from "@/components/architecture/SystemDiagram";
import { RULES } from "@/lib/safetyEngine";

const stages = [
  ["1 · Capture", "Patient forms, on-device OCR, Apple Health export, Bluetooth BP cuff, live public FHIR R4 sandbox, live RxNorm mapping and Synthea fixtures.", "Epic public sandbox and a smart scale."],
  ["2 · Store", "The Patient Passport stays on the device in the browser store. The user can export or delete it.", "PostgreSQL, time series, pgvector, licensed interaction data and a planned HIPAA program."],
  ["3 · Analyze", `Reconciliation, deterministic safety rules (${RULES.length} loaded), measures for weight, BP, HR, potassium, eGFR and PHQ-9, with each flag linked to its source data.`, "Licensed knowledge and more heart-failure rules."],
  ["4 · Agents", "Patient companion, records, pharmacist, cardiology, nutrition and behavioral specialists, an orchestrator and a safety reviewer. They route questions to people. Photon screening is read-only.", "Model-written explanations held to the same safety reviewer."],
  ["5 · Share", "Printable summary, FHIR export, clinician view and the Photon provider workflow only after approval.", "Revocable links, SMART EHR launch and write-back."],
] as const;

const SPONSORS = [
  { name: "Photon Health", live: true, what: "Real API calls to the Photon Neutron sandbox: drug-drug and drug-allergy screening of a drafted prescription, sandbox patient sync, and the provider workflow, which opens only after a clinician approves. Shown in the clinician view and run by Fotini." },
  { name: "Visualize AI", live: false, what: "Iris, the clinician liaison, is named for them. The Visualize SDK is not integrated yet." },
  { name: "DxAngels", live: false, what: "Our host. Dex, the safety agent, is named for them." },
  { name: "Redesign Health", live: false, what: "Our venue. Reid, the records agent, is named for them." },
  { name: "TechNovaTime", live: false, what: "Nova, the patient companion, is named for them." },
] as const;

export default function ArchitecturePage() {
  return <div><PageHeader eyebrow="Architecture" title="A patient-owned record, with bounded agents around it." subtitle="The demo runs the first five stages as transparent, replayable steps. Each stage says what is live today and what comes next." />
    <Card className="mb-6 p-4 sm:p-6"><SystemDiagram ruleCount={RULES.length} /></Card>
    <Card className="mb-6 p-5 sm:p-6">
      <h2 className="font-serif text-xl font-semibold text-navy">Sponsors in this build</h2>
      <p className="mt-1 text-sm text-ink-muted">What is a live integration, and what is a name we are proud to carry.</p>
      <ul className="mt-4 space-y-2">
        {SPONSORS.map((sponsor) => (
          <li key={sponsor.name} className={`grid gap-1 rounded-xl border px-4 py-3 sm:grid-cols-[170px_1fr_auto] sm:items-center sm:gap-4 ${sponsor.live ? "border-2 border-gold-500 bg-gold-50" : "border-line bg-surface"}`}>
            <p className="text-sm font-bold text-ink">{sponsor.name}</p>
            <p className="text-sm leading-relaxed text-ink-soft">{sponsor.what}</p>
            <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${sponsor.live ? "bg-gold-500 text-ink" : "bg-cream-dark text-ink-soft"}`}>{sponsor.live ? "Live integration" : "Named for"}</span>
          </li>
        ))}
      </ul>
    </Card>
    <div className="space-y-4">{stages.map(([name, running, next]) => <Card key={name} className="p-5 sm:p-6"><div className="grid gap-5 md:grid-cols-[180px_1fr_1fr]"><h2 className="font-serif text-xl font-semibold text-navy">{name}</h2><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Running in this demo</p><p className="mt-2 text-sm leading-6 text-ink-soft">{running}</p>{name.startsWith("3 ·") && <Link href="/analytics/" className="mt-3 inline-flex text-sm font-semibold text-brand-700 underline">Open live analytics →</Link>}</div><div><p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Next</p><p className="mt-2 text-sm leading-6 text-ink-muted">{next}</p></div></div></Card>)}</div>
    <p className="mt-4 text-center text-xs text-ink-muted">Based on the Parthia team&apos;s architecture. Prototype decision support, not clinical validation.</p>
  </div>;
}
