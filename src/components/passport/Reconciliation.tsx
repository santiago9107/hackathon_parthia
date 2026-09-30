"use client";

import { useState } from "react";
import { Card } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { SectionTitle, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { REFERENCE_DATE } from "@/lib/mockData";
import { resolveReconIssue } from "@/lib/passport/actions";
import { openIssues, type ReconIssue } from "@/lib/reconcile";

const KIND_LABEL: Record<ReconIssue["kind"], string> = {
  duplicate: "Listed twice",
  "dose-conflict": "Different doses",
  "frequency-conflict": "Different schedules",
  "missing-from-source": "Missing from a record",
  "possibly-stopped": "Possibly stopped",
  "allergy-missing-from-source": "Allergy missing from a record",
};

export function ReconIssueCard({ issue }: { issue: ReconIssue }) {
  const { patientId } = usePatient();
  const [busy, setBusy] = useState(false);
  return (
    <li className="rounded-xl border border-gold-200 bg-gold-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#7a5812]">{KIND_LABEL[issue.kind]}</p>
      <h3 className="font-serif text-lg font-semibold text-navy">{issue.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{issue.explanation}</p>
      {(issue.medications.length > 0 || issue.allergies.length > 0) && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {issue.medications.map((e) => (
            <li key={e.item.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{e.item.name} {e.item.dose}</span>
              <span className="text-ink-muted">{e.item.frequency}</span>
              <SourceBadge source={e.item.source} />
              {e.state === "pending" && <span className="text-xs font-semibold text-[#7a5812]">not confirmed yet</span>}
            </li>
          ))}
          {issue.allergies.map((e) => (
            <li key={e.item.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{e.item.substance}</span>
              <SourceBadge source={e.item.source} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {issue.options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await resolveReconIssue(patientId, issue, o, REFERENCE_DATE);
              } finally {
                setBusy(false);
              }
            }}
            className={`min-h-11 rounded-full px-4 text-left text-sm font-semibold disabled:opacity-50 ${
              o.effect.type === "keep-only" ? "bg-brand-700 text-white hover:bg-brand-800" : "bg-surface text-brand-800 ring-1 ring-line hover:bg-brand-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </li>
  );
}

/** Open differences (with actions) and a short list of resolved ones. */
export function ReconciliationSection() {
  const { issues } = usePatient();
  const open = openIssues(issues);
  const resolved = issues.filter((i) => i.resolution);
  if (!issues.length) return null;
  return (
    <Card className="p-5" accent="border-l-watch">
      <SectionTitle>Differences between your records {open.length > 0 && <span className="ml-1 rounded-full bg-gold-100 px-2 py-0.5 align-middle text-sm text-[#5c430d]">{open.length}</span>}</SectionTitle>
      <p className="-mt-1 mb-4 text-sm text-ink-soft">
        We compared medicines and allergies across your sources. You decide what&apos;s right — and anything you&apos;re unsure about becomes a question for your
        clinician in your shared summary.
      </p>
      {open.length === 0 ? (
        <p className="text-sm font-semibold text-good">All differences have been reviewed.</p>
      ) : (
        <ul className="space-y-3">{open.map((i) => <ReconIssueCard key={i.id} issue={i} />)}</ul>
      )}
      {resolved.length > 0 && (
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-700">Reviewed ({resolved.length})</summary>
          <ul className="mt-1 space-y-1 text-sm text-ink-soft">
            {resolved.map((i) => (
              <li key={i.id}>
                ✓ {i.resolution!.summary} <span className="text-xs text-ink-muted">· {fmtDate(i.resolution!.at)}{i.resolution!.askClinician ? " · will ask my clinician" : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
