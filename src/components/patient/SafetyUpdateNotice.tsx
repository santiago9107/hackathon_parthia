"use client";

import { Citations } from "@/components/patient/Citations";
import { UrgentCareNotice } from "@/components/patient/UrgentCareNotice";
import { usePatient } from "@/lib/context/PatientContext";
import { detectUrgent } from "@/lib/patientAgent/urgent";
import { usePatientAgent } from "@/lib/patientAgent/usePatientAgent";
import type { AgentCitation } from "@/lib/patientAgent/types";
import type { Medication, PatientRecord, RiskFlag } from "@/lib/types";

/**
 * The safety re-check, inline on a log confirmation screen.
 *
 * `beforeRuleIds` is the set of rule ids that had already fired when the
 * patient pressed Save. It is captured inside the submit handler, a user
 * event, so no effect ever sets state here: writing through `addEntries` bumps
 * the passport store, and `usePatient()` has re-run the safety engine by the
 * time this panel renders.
 *
 * A finding is new when its `ruleId` is absent from that set, because flag ids
 * embed the medicine names and would make one widened interaction look brand
 * new. `beforeFlagIds` carries the full ids from the same moment, which is how
 * a rule that fired before and now involves one more medicine is told apart
 * from one this save did not touch at all.
 *
 * Every line is a question for the patient's doctor or pharmacist. Nothing
 * here ever says to begin, to end, to skip or to alter anything.
 */
export function SafetyUpdateNotice({
  beforeRuleIds,
  beforeFlagIds = [],
  savedText,
}: {
  beforeRuleIds: string[];
  beforeFlagIds?: string[];
  savedText?: string;
}) {
  const { record } = usePatient();
  const { update } = usePatientAgent();

  const before = new Set(beforeRuleIds);
  const beforeIds = new Set(beforeFlagIds);
  const urgent = savedText ? detectUrgent(savedText) : null;

  const fresh = update.findings.filter((f) => !before.has(f.ruleId));
  const widened = update.updatedFindings.filter(
    (u) => before.has(u.flag.ruleId) && !beforeIds.has(u.flag.id),
  );
  const patientOnlyRules = new Set(update.patientReportedOnly.map((f) => f.ruleId));
  const ownEntries = [
    ...new Set(
      [...fresh, ...widened.map((u) => u.flag)]
        .filter((f) => patientOnlyRules.has(f.ruleId))
        .flatMap((f) => f.medications),
    ),
  ];
  const nothingNew = fresh.length === 0 && widened.length === 0;

  return (
    <div className="space-y-3">
      {urgent && <UrgentCareNotice kind={urgent.kind} />}

      {nothingNew ? (
        <p>Nothing new, your safety check did not find anything to add.</p>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold text-ink">
            Your safety check found {fresh.length + widened.length === 1 ? "one thing" : `${fresh.length + widened.length} things`} to ask about.
          </p>

          {fresh.map((flag) => (
            <div key={flag.ruleId} className="rounded-xl bg-surface/70 p-3">
              <p className="text-ink">{flag.title}.</p>
              <p className="mt-1 text-ink">
                A question for your doctor or pharmacist: is {listNames(flag.medications)} safe for me with this on my record?
              </p>
              <Citations citations={citationsFor(flag, record)} className="mt-2" />
            </div>
          ))}

          {widened.map(({ flag, addedMedications }) => (
            <div key={flag.ruleId} className="rounded-xl bg-surface/70 p-3">
              <p className="text-ink">
                A flag you already had now also involves {listNames(addedMedications)}: {flag.title}.
              </p>
              <p className="mt-1 text-ink">
                A question for your doctor or pharmacist: does {listNames(addedMedications)} change anything here for me?
              </p>
              <Citations citations={citationsFor(flag, record)} className="mt-2" />
            </div>
          ))}

          {ownEntries.length > 0 && (
            <p className="text-ink-muted">
              {listNames(ownEntries)} came from your own entry, so it is in no clinical record yet.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-ink-muted">Answered from your records by Parthia&apos;s rules</p>
    </div>
  );
}

function listNames(input: string[]): string {
  const names = [...new Set(input)];
  if (names.length === 0) return "this";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The rule that fired, plus the real source of every medicine it involves. */
function citationsFor(flag: RiskFlag, record: PatientRecord): AgentCitation[] {
  const all: Medication[] = [...record.patient.medications, ...record.pastMedications];
  const sources = [...new Set(flag.medications)]
    .map((name) => all.find((m) => m.name.toLowerCase() === name.toLowerCase()))
    .filter((m): m is Medication => !!m)
    .map((m) => ({ label: m.name, source: m.source }));
  return [{ label: flag.title, ruleId: flag.ruleId }, ...sources];
}
