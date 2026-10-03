"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/PageHeader";
import type { Medication, PatientId } from "@/lib/types";
import {
  createDoseEvent,
  deriveDailyDoses,
  latestEventForDose,
  loadDoseEvents,
  localDateKey,
  recordDoseEvent,
  type DailyDose,
  type DoseAction,
  type DoseEvent,
} from "./doses";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ActionButton({ dose, action, label, onAction }: { dose: DailyDose; action: DoseAction; label: string; onAction: (dose: DailyDose, action: DoseAction) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAction(dose, action)}
      aria-label={`${label}: ${dose.medicationName}${dose.dose ? ` ${dose.dose}` : ""}, ${dose.dueLabel}`}
      className={
        action === "taken"
          ? "min-h-10 rounded-full bg-brand-700 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          : "min-h-10 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink transition hover:border-brand-300 hover:bg-brand-50"
      }
    >
      {label}
    </button>
  );
}

export function TodayMedications({ patientId, medications, date }: { patientId: PatientId; medications: Medication[]; date: Date }) {
  const day = localDateKey(date);
  const doses = useMemo(() => deriveDailyDoses(patientId, medications, date), [patientId, medications, date]);
  const [events, setEvents] = useState<DoseEvent[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setEvents(loadDoseEvents());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [patientId, day]);

  const scheduled = doses.filter((dose) => dose.kind === "scheduled");
  const taken = scheduled.filter((dose) => latestEventForDose(events, dose.id)?.action === "taken").length;
  const representedMedicationIds = new Set(doses.map((dose) => dose.medicationId));
  const unscheduledCount = medications.filter(
    (medication) =>
      medication.source.verified &&
      (medication.status ?? "active") === "active" &&
      (!medication.startDate || medication.startDate <= day) &&
      !representedMedicationIds.has(medication.id),
  ).length;

  function onAction(dose: DailyDose, action: DoseAction) {
    const event = createDoseEvent(dose, action);
    setEvents(recordDoseEvent(event));
  }

  return (
    <Card className="mt-6 overflow-hidden" accent="border-l-brand-500">
      <div id="todays-medications" className="scroll-mt-24 border-b border-line bg-brand-50/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Today</p>
            <h2 className="font-serif text-2xl font-semibold text-navy">Today&apos;s medications</h2>
            <p className="mt-1 text-sm text-ink-muted">Based on your confirmed prescriptions. Follow the prescription label; Parthia does not calculate or change doses.</p>
          </div>
          {scheduled.length > 0 && (
            <p className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-100" aria-live="polite">
              {ready ? `${taken} of ${scheduled.length} taken` : `${scheduled.length} scheduled`}
            </p>
          )}
        </div>
      </div>

      {doses.length === 0 ? (
        <div className="p-5 text-sm text-ink-muted">
          No daily doses can be scheduled from the confirmed frequency details. Check the prescription label or add a more specific schedule.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {doses.map((dose) => {
            const event = latestEventForDose(events, dose.id);
            const complete = event?.action === "taken" || event?.action === "skipped";
            return (
              <li key={dose.id} className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{dose.medicationName}{dose.dose && <span className="font-normal text-ink-soft"> · {dose.dose}</span>}</p>
                    {event?.action === "taken" && <span className="rounded-full bg-good-soft px-2 py-0.5 text-xs font-semibold text-good">Taken</span>}
                    {event?.action === "skipped" && <span className="rounded-full bg-cream-dark px-2 py-0.5 text-xs font-semibold text-ink-muted">Skipped</span>}
                    {event?.action === "snoozed" && <span className="rounded-full bg-watch-soft px-2 py-0.5 text-xs font-semibold text-gold-700">Snoozed</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {dose.dueLabel} · {dose.frequency}
                    {event?.action === "snoozed" && event.snoozedUntil ? ` · remind at ${timeLabel(event.snoozedUntil)}` : ""}
                  </p>
                </div>
                {!complete && ready && (
                  <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
                    <ActionButton dose={dose} action="taken" label="Taken" onAction={onAction} />
                    {dose.kind === "scheduled" && <ActionButton dose={dose} action="snoozed" label="Snooze 30m" onAction={onAction} />}
                    {dose.kind === "scheduled" && <ActionButton dose={dose} action="skipped" label="Skip" onAction={onAction} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unscheduledCount > 0 && (
        <p className="border-t border-line bg-cream px-5 py-3 text-xs text-ink-muted">
          {unscheduledCount} active medicine{unscheduledCount === 1 ? " has" : "s have"} a schedule that needs a day or time before Parthia can create a reminder.
        </p>
      )}
    </Card>
  );
}
