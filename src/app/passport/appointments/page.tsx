"use client";

import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, TextLink, fmtDateTime } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";

export default function AppointmentsPage() {
  const { record, now } = usePatient();
  const nowIso = now.toISOString().slice(0, 19);
  const upcoming = record.appointments.filter((a) => a.start >= nowIso && a.status === "booked").sort((a, b) => a.start.localeCompare(b.start));
  const past = record.appointments.filter((a) => !(a.start >= nowIso && a.status === "booked")).sort((a, b) => b.start.localeCompare(a.start));
  const encounters = new Map(record.encounters.map((e) => [e.id, e]));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle action={<TextLink href="/log/appointment/">Add an appointment</TextLink>}>Upcoming</SectionTitle>
        {upcoming.length === 0 ? <EmptyState>No upcoming appointments.</EmptyState> : (
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <li key={a.id} className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{fmtDateTime(a.start)}</p>
                    <p className="text-ink-soft">{a.clinician} · {a.specialty}</p>
                    {a.location && <p className="text-xs text-ink-muted">{a.location}</p>}
                  </div>
                  <SourceBadge source={a.source} />
                </div>
                <p className="mt-2 text-ink-soft"><span className="text-ink-muted">Reason: </span>{a.reason}</p>
                {a.patientNotes && <p className="mt-1 text-ink-soft"><span className="text-ink-muted">My notes: </span>{a.patientNotes}</p>}
                <TextLink href="/passport/share/">Prepare what to share →</TextLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>Past</SectionTitle>
        {past.length === 0 ? <EmptyState>No past appointments.</EmptyState> : (
          <ul className="space-y-3">
            {past.map((a) => {
              const e = a.encounterId ? encounters.get(a.encounterId) : undefined;
              return (
                <li key={a.id} className="rounded-xl border border-line p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{fmtDateTime(a.start)}{a.status !== "fulfilled" && <span className="ml-2 text-xs font-semibold uppercase text-attention">{a.status}</span>}</p>
                      <p className="text-ink-soft">{a.clinician} · {a.specialty}</p>
                    </div>
                    <SourceBadge source={a.source} compact />
                  </div>
                  {e ? (
                    <details className="mt-2 group">
                      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-700 hover:text-brand-900">Visit summary</summary>
                      <p className="mt-1 leading-relaxed text-ink-soft">{e.summary}</p>
                      {e.diagnoses?.length ? <p className="mt-1 text-xs text-ink-muted">Discussed: {e.diagnoses.join(", ")}</p> : null}
                    </details>
                  ) : (
                    <p className="mt-2 text-xs text-ink-muted">{a.reason} · no visit summary in your Passport</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Disclaimer />
    </div>
  );
}
