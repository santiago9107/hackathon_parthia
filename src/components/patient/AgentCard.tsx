"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AgentHuddle } from "@/components/agents/AgentHuddle";
import { Card } from "@/components/PageHeader";
import { Citations } from "@/components/patient/Citations";
import { VisitQuestions } from "@/components/patient/VisitQuestions";
import { usePatient } from "@/lib/context/PatientContext";
import { buildHuddle, huddleEnabled } from "@/lib/agents/huddle";
import { orchestrate } from "@/lib/agents/orchestrator";
import { usePatientAgent } from "@/lib/patientAgent/usePatientAgent";
import { buildVisitQuestions } from "@/lib/patientAgent/visitQuestions";
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
  const { update, ask } = usePatientAgent();
  const { record, issues, now } = usePatient();
  const [prepared, setPrepared] = useState(false);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [huddle, setHuddle] = useState<ReturnType<typeof buildHuddle> | null>(null);
  const [triggerKind, setTriggerKind] = useState<"prepare" | "watch">("prepare");
  const prepareRef = useRef<HTMLButtonElement>(null);
  const watchRef = useRef<HTMLButtonElement>(null);
  const questions = useMemo(() => buildVisitQuestions(update, issues, record), [update, issues, record]);
  const { newCount, newFindings, updatedFindings, patientReportedOnly } = update;
  const nothingNew = newCount === 0 && updatedFindings.length === 0;

  const citations: AgentCitation[] = [
    ...newFindings.map((f) => ({ label: f.title, ruleId: f.ruleId })),
    ...updatedFindings.map(({ flag }) => ({ label: flag.title, ruleId: flag.ruleId })),
  ];
  const added = [...new Set(updatedFindings.flatMap((u) => u.addedMedications))];
  const ownEntries = [...new Set(patientReportedOnly.flatMap((f) => f.medications))];

  async function openHuddle(question: string, trigger: "prepare" | "watch") {
    setPrepared(true);
    setTriggerKind(trigger);
    if (!huddleEnabled()) return;
    const reply = await ask(question);
    if (reply.urgent) return;
    setHuddle(buildHuddle(orchestrate(record, now), reply));
    setHuddleOpen(true);
  }

  return (
    <Card className="mb-6 p-5" accent="border-l-brand-500">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-navy">Your Parthia agent</h2>
        <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-700">Rule-based</span>
      </div>

      {nothingNew ? (
        <p className="mt-2 text-[15px] text-ink">No new findings from this check.</p>
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
        <button
          ref={prepareRef}
          type="button"
          onClick={() => { if (prepared) setPrepared(false); else void openHuddle("What should I ask my doctor?", "prepare"); }}
          aria-expanded={prepared}
          aria-controls="visit-questions"
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50"
        >
          {prepared ? "Hide my visit questions" : "Prepare for my visit"}
        </button>
        <button
          ref={watchRef}
          type="button"
          onClick={() => void openHuddle("What has changed since my last visit?", "watch")}
          className="text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          Watch your agents work
        </button>
        <span className="text-[11px] text-ink-muted">Answered from your records by Parthia&apos;s rules</span>
      </div>

      {prepared && (
        <div id="visit-questions" className="mt-3 rounded-xl bg-surface/70 p-3">
          <p className="text-sm font-semibold text-ink">
            {questions.length} question{questions.length === 1 ? "" : "s"} you can ask at your visit
          </p>
          <VisitQuestions questions={questions} className="mt-2" showChip={false} />
          <Link href="/passport/share/?prepare=1" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">
            Add these to my visit summary &rarr;
          </Link>
          <p className="mt-1 text-[11px] text-ink-muted">Nothing is sent anywhere. You print the summary or hand it over yourself.</p>
        </div>
      )}
      <AgentHuddle open={huddleOpen} onClose={() => setHuddleOpen(false)} huddle={huddle ?? undefined} triggerRef={triggerKind === "prepare" ? prepareRef : watchRef} />
    </Card>
  );
}
