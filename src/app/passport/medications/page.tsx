"use client";

import Link from "next/link";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, TextLink, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";

export default function PassportMedicationsPage() {
  const { record, flags } = usePatient();
  const { patient } = record;
  const history = [...patient.medicationHistory].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle action={<TextLink href="/log/medication/">Add a medication</TextLink>}>Current medications</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-ink-muted">
          Where each medicine on your list came from. For interactions and questions to ask, see{" "}
          <Link href="/medications/" className="font-semibold text-brand-700 hover:text-brand-900">Medication safety</Link>
          {flags.length > 0 ? ` (${flags.length} item${flags.length === 1 ? "" : "s"})` : ""}.
        </p>
        <ul className="space-y-3">
          {patient.medications.map((m) => (
            <li key={m.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{m.name} <span className="font-normal text-ink-soft">{m.dose}</span></p>
                  <p className="text-sm text-ink-soft">{m.frequency}{m.indication ? ` · for ${m.indication.toLowerCase()}` : ""}</p>
                </div>
                <SourceBadge source={m.source} />
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                <div><dt className="inline text-ink-muted">Prescriber: </dt><dd className="inline text-ink-soft">{m.prescriber ?? "—"}</dd></div>
                <div><dt className="inline text-ink-muted">Started: </dt><dd className="inline text-ink-soft">{fmtDate(m.startDate)}</dd></div>
                <div><dt className="inline text-ink-muted">RxNorm: </dt><dd className="inline text-ink-soft">{m.rxNormCode ?? "—"}</dd></div>
              </dl>
              <Link href={`/log/medication/?id=${encodeURIComponent(m.id)}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">
                Edit or stop →
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionTitle>Past medications</SectionTitle>
        {record.pastMedications.length === 0 ? (
          <EmptyState>No stopped medications recorded.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {record.pastMedications.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-medium text-ink">{m.name} {m.dose}</span><span className="block text-xs text-ink-muted">{m.status}{m.stoppedOn ? ` ${fmtDate(m.stoppedOn)}` : ""}</span></span>
                <SourceBadge source={m.source} compact />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>Medication history</SectionTitle>
        {history.length === 0 ? (
          <EmptyState>No changes recorded.</EmptyState>
        ) : (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {history.map((h) => (
              <li key={h.id} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
                <p className="font-medium text-ink">{fmtDate(h.date)} — {h.medicationName} <span className="font-normal text-ink-muted">({h.type.replace("-", " ")})</span></p>
                <p className="text-ink-soft">{h.detail}</p>
                <div className="mt-1"><SourceBadge source={h.source} compact /></div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Disclaimer />
    </div>
  );
}
