"use client";

import Link from "next/link";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, TextLink, fmtDate, fmtDateTime } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { lastUpdated, passportGaps } from "@/lib/passport/completeness";
import { pendingEntries } from "@/lib/passport/ops";

const SEVERITY_TONE = { severe: "text-attention", moderate: "text-[#7a5812]", mild: "text-ink-soft" } as const;

export default function PassportOverview() {
  const { record, now, local } = usePatient();
  const { patient } = record;
  const pending = pendingEntries(local).length;
  const gaps = passportGaps(record, now);
  const nowIso = now.toISOString().slice(0, 19);
  const next = [...record.appointments].filter((a) => a.status === "booked" && a.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0];
  const updated = lastUpdated(record);
  const e = record.emergency;

  return (
    <div className="space-y-6">
      {pending > 0 && (
        <Link href="/passport/review/" className="flex items-center justify-between gap-3 rounded-card border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-[#5c430d] hover:bg-gold-100">
          <span>
            <strong>{pending} imported item{pending === 1 ? "" : "s"} waiting for your review.</strong> They aren&apos;t used in any analysis until you confirm them.
          </span>
          <span className="shrink-0 font-semibold">Review →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle>Who I am</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-muted">Age</dt><dd className="font-semibold text-ink">{patient.age}</dd></div>
            <div><dt className="text-ink-muted">Sex</dt><dd className="font-semibold capitalize text-ink">{patient.sex}</dd></div>
            <div><dt className="text-ink-muted">Blood type</dt><dd className="font-semibold text-ink">{e?.bloodType ?? "—"}</dd></div>
            <div><dt className="text-ink-muted">Last updated</dt><dd className="font-semibold text-ink">{updated ? fmtDate(updated) : "—"}</dd></div>
            <div className="col-span-2"><dt className="text-ink-muted">Primary clinician</dt><dd className="font-semibold text-ink">{patient.primaryClinician}</dd></div>
            <div className="col-span-2"><dt className="text-ink-muted">Emergency contact</dt><dd className="font-semibold text-ink">{e?.contacts[0] ? `${e.contacts[0].name} (${e.contacts[0].relationship}) · ${e.contacts[0].phone}` : "—"}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-ink-muted">
            You own this record. You review what is imported, correct it, export it, and choose who sees it.
          </p>
        </Card>

        <Card className="p-5" accent="border-l-brand-500">
          <SectionTitle action={<TextLink href="/passport/appointments/">All</TextLink>}>Next appointment</SectionTitle>
          {next ? (
            <div className="text-sm">
              <p className="font-semibold text-ink">{fmtDateTime(next.start)}</p>
              <p className="mt-0.5 text-ink-soft">{next.clinician} · {next.specialty}</p>
              <p className="mt-0.5 text-ink-muted">{next.reason}</p>
              <div className="mt-2"><SourceBadge source={next.source} /></div>
              <Link href="/passport/share/" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900">Prepare a summary to share →</Link>
            </div>
          ) : (
            <EmptyState action={<TextLink href="/log/appointment/">Add an appointment</TextLink>}>No upcoming appointments.</EmptyState>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle action={<TextLink href="/passport/clinical/">Details</TextLink>}>Active conditions</SectionTitle>
          <ul className="divide-y divide-line">
            {patient.conditions.filter((c) => c.clinicalStatus !== "resolved").map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-ink">{c.name}{c.diagnosedOn && <span className="ml-2 text-xs font-normal text-ink-muted">since {fmtDate(c.diagnosedOn, { month: "short", year: "numeric" })}</span>}</span>
                <SourceBadge source={c.source} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle action={<TextLink href="/passport/medications/">Details</TextLink>}>Current medications</SectionTitle>
          <ul className="divide-y divide-line">
            {patient.medications.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium text-ink">{m.name} {m.dose}</span> <span className="text-ink-muted">· {m.frequency}</span></span>
                <SourceBadge source={m.source} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle action={<TextLink href="/log/allergy/">Add</TextLink>}>Allergies &amp; intolerances</SectionTitle>
          {record.allergies.length === 0 ? (
            <EmptyState>No allergies recorded.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {record.allergies.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium text-ink">{a.substance}</span>{" "}
                    <span className={`text-xs font-semibold ${SEVERITY_TONE[a.severity]}`}>{a.severity}{a.type === "intolerance" ? " intolerance" : ""}</span>
                    {a.reaction && <span className="block text-xs text-ink-muted">{a.reaction}</span>}
                  </span>
                  <SourceBadge source={a.source} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Care team</SectionTitle>
          <ul className="divide-y divide-line">
            {record.careTeam.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="block text-xs text-ink-muted">{[m.specialty, m.organization].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex items-center gap-2">
                  {m.phone && <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`} className="text-xs font-semibold text-brand-700 hover:text-brand-900">{m.phone}</a>}
                  <SourceBadge source={m.source} compact />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>What&apos;s missing from my Passport</SectionTitle>
        {gaps.length === 0 ? (
          <p className="text-sm text-good">Nothing obvious is missing. Keep it up to date after each visit.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {gaps.map((g) => (
              <li key={g.id} className="rounded-xl border border-line bg-cream/50 p-3 text-sm">
                <p className="font-semibold text-ink">{g.title}</p>
                <p className="mt-0.5 text-ink-muted">{g.why}</p>
                <Link href={g.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">{g.action} →</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-4 text-sm">
        <TextLink href="/passport/activity/">Activity log</TextLink>
        <TextLink href="/passport/settings/">Passport settings (export, lock, reset)</TextLink>
      </div>
      <Disclaimer />
    </div>
  );
}
