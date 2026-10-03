"use client";

import Link from "next/link";
import { Card } from "@/components/PageHeader";
import { Citations } from "@/components/patient/Citations";
import { usePatientAgent } from "@/lib/patientAgent/usePatientAgent";
import type { AgentCitation } from "@/lib/patientAgent/types";

/**
 * The dashboard agent card.
 *
 * Reads the real counts from the one safety-watch seam. "Since your last visit"
 * means "not in the records your care team already has", so the zero case is
 * the honest answer right after a demo reset.
 *
 * Plain short sentences, no jargon, and never an instruction to begin or to
 * end anything. Every finding is a question for a clinician.
 */
export function AgentCard() {
  const { update } = usePatientAgent();
  const { newCount, newFindings, updatedFindings, patientReportedOnly } = update;
  const nothingNew = newCount === 0 && updatedFindings.length === 0;

  const citations: AgentCitation[] = [
    ...newFindings.map((f) => ({ label: f.title, ruleId: f.ruleId })),
    ...updatedFindings.map(({ flag }) => ({ label: flag.title, ruleId: flag.ruleId })),
  ];
  const added = [...new Set(updatedFindings.flatMap((u) => u.addedMedications))];
  const ownEntries = [...new Set(patientReportedOnly.flatMap((f) => f.medications))];

  return (
    <Card className="mb-6 p-5" accent="border-l-brand-500">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-navy">Your Parthia agent</h2>
        <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-700">AI-generated</span>
      </div>

      {nothingNew ? (
        <p className="mt-2 text-[15px] text-ink">Nothing new since your last visit.</p>
      ) : (
        <>
          {newCount > 0 && (
            <p className="mt-2 text-[15px] font-semibold text-ink">
              Since your last visit: {newCount} new thing{newCount === 1 ? "" : "s"} to ask your doctor about
            </p>
          )}
          {added.length > 0 && (
            <p className="mt-1 text-[15px] text-ink">
              A flag you already had now also involves {added.join(" and ")}.
            </p>
          )}
          {ownEntries.length > 0 && (
            <p className="mt-1 text-sm text-ink-muted">
              {ownEntries.join(" and ")} came from your own entry, so it is in no clinical record yet.
            </p>
          )}
          {citations.length > 0 && <Citations citations={citations} className="mt-3" />}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/medications/#flags-heading" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
          {nothingNew ? "See your safety check" : "See what this is about"} &rarr;
        </Link>
        <span className="text-[11px] text-ink-muted">Answered from your records by Parthia&apos;s rules</span>
      </div>
    </Card>
  );
}
