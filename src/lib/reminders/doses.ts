import type { Medication, PatientId } from "../types";

export type DoseAction = "taken" | "snoozed" | "skipped";

export interface DailyDose {
  id: string;
  patientId: PatientId;
  medicationId: string;
  medicationName: string;
  dose: string;
  frequency: string;
  date: string;
  slot: string;
  dueTime: string | null;
  dueLabel: string;
  kind: "scheduled" | "as-needed";
}

export interface DoseEvent {
  id: string;
  doseId: string;
  patientId: PatientId;
  medicationId: string;
  date: string;
  action: DoseAction;
  occurredAt: string;
  snoozedUntil?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface DoseSlot {
  slot: string;
  dueTime: string | null;
  dueLabel: string;
  kind: DailyDose["kind"];
}

export const DOSE_EVENTS_STORAGE_KEY = "parthia.medicationDoseEvents.v1";

const STANDARD_SLOTS: Record<number, Array<Omit<DoseSlot, "kind">>> = {
  1: [{ slot: "morning", dueTime: "08:00", dueLabel: "Morning" }],
  2: [
    { slot: "morning", dueTime: "08:00", dueLabel: "Morning" },
    { slot: "evening", dueTime: "18:00", dueLabel: "Evening" },
  ],
  3: [
    { slot: "morning", dueTime: "08:00", dueLabel: "Morning" },
    { slot: "midday", dueTime: "13:00", dueLabel: "Midday" },
    { slot: "evening", dueTime: "18:00", dueLabel: "Evening" },
  ],
  4: [
    { slot: "morning", dueTime: "08:00", dueLabel: "Morning" },
    { slot: "midday", dueTime: "12:00", dueLabel: "Midday" },
    { slot: "evening", dueTime: "18:00", dueLabel: "Evening" },
    { slot: "bedtime", dueTime: "21:00", dueLabel: "Bedtime" },
  ],
};

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert the confirmed prescription's plain-language frequency into a small,
 * conservative set of reminder slots. Unsupported schedules are left alone;
 * the app must not invent timing that is not present on the prescription.
 */
export function slotsForFrequency(frequency: string): DoseSlot[] {
  const text = frequency.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return [];

  if (text.includes("as needed") || /\bprn\b/.test(text)) {
    return [{ slot: "as-needed", dueTime: null, dueLabel: "As needed", kind: "as-needed" }];
  }

  // A weekday or starting date is required before a weekly reminder is safe.
  if (/weekly|every\s+(?:other\s+)?week/.test(text)) return [];

  if (/bedtime|at night|nightly/.test(text) && !/twice|two|2\s*(?:x|times)/.test(text)) {
    return [{ slot: "bedtime", dueTime: "21:00", dueLabel: "Bedtime", kind: "scheduled" }];
  }

  let count = 0;
  if (/four times|4\s*(?:x|times)/.test(text)) count = 4;
  else if (/three times|3\s*(?:x|times)/.test(text)) count = 3;
  else if (/twice|two times|2\s*(?:x|times)/.test(text)) count = 2;
  else if (/once|one time|1\s*(?:x|time)|daily|each day|every day/.test(text)) count = 1;

  if (!count) return [];

  if (count === 1 && /evening/.test(text)) {
    return [{ slot: "evening", dueTime: "18:00", dueLabel: "Evening", kind: "scheduled" }];
  }
  if (count === 1 && /bedtime|at night|nightly/.test(text)) {
    return [{ slot: "bedtime", dueTime: "21:00", dueLabel: "Bedtime", kind: "scheduled" }];
  }

  return STANDARD_SLOTS[count].map((slot) => ({ ...slot, kind: "scheduled" as const }));
}

export function deriveDailyDoses(patientId: PatientId, medications: Medication[], date: Date): DailyDose[] {
  const day = localDateKey(date);

  return medications
    .filter((medication) => medication.source.verified && (medication.status ?? "active") === "active")
    .filter((medication) => !medication.startDate || medication.startDate <= day)
    .flatMap((medication) =>
      slotsForFrequency(medication.frequency).map((slot) => ({
        id: `${patientId}:${day}:${medication.id}:${slot.slot}`,
        patientId,
        medicationId: medication.id,
        medicationName: medication.name,
        dose: medication.dose,
        frequency: medication.frequency,
        date: day,
        ...slot,
      })),
    )
    .sort((a, b) => {
      if (a.dueTime === null) return b.dueTime === null ? a.medicationName.localeCompare(b.medicationName) : 1;
      if (b.dueTime === null) return -1;
      return a.dueTime.localeCompare(b.dueTime) || a.medicationName.localeCompare(b.medicationName);
    });
}

function isDoseAction(value: unknown): value is DoseAction {
  return value === "taken" || value === "snoozed" || value === "skipped";
}

function isDoseEvent(value: unknown): value is DoseEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DoseEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.doseId === "string" &&
    typeof event.patientId === "string" &&
    typeof event.medicationId === "string" &&
    typeof event.date === "string" &&
    isDoseAction(event.action) &&
    typeof event.occurredAt === "string" &&
    (event.snoozedUntil === undefined || typeof event.snoozedUntil === "string")
  );
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDoseEvents(storage: StorageLike | null = browserStorage()): DoseEvent[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(DOSE_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isDoseEvent) : [];
  } catch {
    return [];
  }
}

export function saveDoseEvents(events: DoseEvent[], storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DOSE_EVENTS_STORAGE_KEY, JSON.stringify(events.slice(-5_000)));
    return true;
  } catch {
    return false;
  }
}

export function latestEventForDose(events: DoseEvent[], doseId: string, now: Date = new Date()): DoseEvent | undefined {
  const event = [...events].reverse().find((candidate) => candidate.doseId === doseId);
  if (event?.action === "snoozed" && event.snoozedUntil && new Date(event.snoozedUntil).getTime() <= now.getTime()) return undefined;
  return event;
}

export function createDoseEvent(dose: DailyDose, action: DoseAction, now: Date = new Date(), snoozeMinutes = 30): DoseEvent {
  const occurredAt = now.toISOString();
  return {
    id: `${dose.id}:${occurredAt}:${action}`,
    doseId: dose.id,
    patientId: dose.patientId,
    medicationId: dose.medicationId,
    date: dose.date,
    action,
    occurredAt,
    ...(action === "snoozed" ? { snoozedUntil: new Date(now.getTime() + snoozeMinutes * 60_000).toISOString() } : {}),
  };
}

export function recordDoseEvent(event: DoseEvent, storage: StorageLike | null = browserStorage()): DoseEvent[] {
  const events = [...loadDoseEvents(storage), event];
  saveDoseEvents(events, storage);
  return events;
}

