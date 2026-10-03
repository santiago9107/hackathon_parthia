import Image from "next/image";
import { Card, PageHeader } from "@/components/PageHeader";

const stages = [
  ["1 · Capture", "Patient forms, on-device OCR, Apple Health, Bluetooth BP cuff, live public FHIR R4 sandbox, RxNorm mapping and Synthea import.", "Epic public sandbox and a smart scale."],
  ["2 · Store", "Patient Passport stays on the device. The patient can export or delete it.", "PostgreSQL, time series, pgvector, licensed interaction data and a planned HIPAA program."],
  ["3 · Analyze", "Reconciliation, deterministic rules, measures for weight, BP, HR, potassium, eGFR and PHQ-9, with every flag linked to source data.", "Licensed knowledge and more heart-failure rules."],
  ["4 · Agents", "Patient companion, records, pharmacist, cardiology, nutrition and behavioral specialists, orchestrator and safety reviewer. All are rule-based and route questions to people. Photon screening is read-only.", "Model-written explanations held to the same safety reviewer."],
  ["5 · Share", "Exportable summary, FHIR export, clinician view and Photon provider workflow only after approval.", "Revocable links, SMART EHR launch and write-back."],
] as const;

export default function ArchitecturePage() {
  return <div><PageHeader eyebrow="Architecture" title="A patient-owned record, with bounded agents around it." subtitle="The demo runs the first five stages as transparent, replayable steps. Each stage says what is live today and what comes next." />
    <div className="space-y-4">{stages.map(([name, running, next]) => <Card key={name} className="p-5 sm:p-6"><div className="grid gap-5 md:grid-cols-[180px_1fr_1fr]"><h2 className="font-serif text-xl font-semibold text-navy">{name}</h2><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Running in this demo</p><p className="mt-2 text-sm leading-6 text-ink-soft">{running}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Next</p><p className="mt-2 text-sm leading-6 text-ink-muted">{next}</p></div></div></Card>)}</div>
    <Card className="mt-6 overflow-hidden p-2 sm:p-3"><Image src="/architecture/parthia-architecture.png" alt="Parthia Health architecture diagram" width={1800} height={1000} className="h-auto w-full rounded-xl" /></Card>
    <p className="mt-3 text-center text-xs text-ink-muted">Architecture by the Parthia team. Prototype decision support, not clinical validation.</p>
  </div>;
}
