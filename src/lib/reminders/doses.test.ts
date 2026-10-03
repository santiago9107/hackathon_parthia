import { describe, expect, it } from "vitest";
import type { Medication } from "../types";
import {
  createDoseEvent,
  deriveDailyDoses,
  DOSE_EVENTS_STORAGE_KEY,
  latestEventForDose,
  loadDoseEvents,
  recordDoseEvent,
  slotsForFrequency,
  type StorageLike,
} from "./doses";

const source = { kind: "seed" as const, label: "Sample data", importedAt: "2026-09-01T12:00:00Z", verified: true };
const medication = (over: Partial<Medication> = {}): Medication => ({
  id: "med-1",
  name: "Metformin",
  genericName: "metformin",
  class: "biguanide",
  dose: "500 mg",
  frequency: "twice daily with meals",
  startDate: "2026-01-01",
  status: "active",
  source,
  ...over,
});

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("daily medication schedule", () => {
  it("derives stable morning and evening doses from confirmed frequency text", () => {
    const doses = deriveDailyDoses("patient-1", [medication()], new Date(2026, 9, 3, 12));
    expect(doses).toHaveLength(2);
    expect(doses.map((dose) => [dose.dueLabel, dose.dueTime])).toEqual([["Morning", "08:00"], ["Evening", "18:00"]]);
    expect(doses[0]).toMatchObject({ id: "patient-1:2026-10-03:med-1:morning", dose: "500 mg", frequency: "twice daily with meals" });
  });

  it("recognizes common daily timing without inventing a weekly day", () => {
    expect(slotsForFrequency("once daily (evening)")[0]).toMatchObject({ dueLabel: "Evening", dueTime: "18:00" });
    expect(slotsForFrequency("at bedtime")[0]).toMatchObject({ dueLabel: "Bedtime", dueTime: "21:00" });
    expect(slotsForFrequency("three times daily")).toHaveLength(3);
    expect(slotsForFrequency("once weekly")).toEqual([]);
  });

  it("marks as-needed medicine as optional and excludes unconfirmed or stopped medicine", () => {
    const meds = [
      medication({ id: "prn", frequency: "at bedtime as needed" }),
      medication({ id: "unconfirmed", source: { ...source, verified: false } }),
      medication({ id: "stopped", status: "stopped" }),
      medication({ id: "future", startDate: "2026-10-04" }),
    ];
    expect(deriveDailyDoses("patient-1", meds, new Date(2026, 9, 3, 12))).toMatchObject([{ medicationId: "prn", kind: "as-needed", dueTime: null }]);
  });
});

describe("dose event storage", () => {
  it("persists taken, snoozed and skipped events as local history", () => {
    const storage = new MemoryStorage();
    const [dose] = deriveDailyDoses("patient-1", [medication({ frequency: "once daily" })], new Date(2026, 9, 3, 12));
    const at = new Date("2026-10-03T12:00:00.000Z");
    const actions = ["taken", "snoozed", "skipped"] as const;

    actions.forEach((action, index) => recordDoseEvent(createDoseEvent(dose, action, new Date(at.getTime() + index * 60_000)), storage));

    expect(loadDoseEvents(storage).map((event) => event.action)).toEqual(actions);
    expect(JSON.parse(storage.getItem(DOSE_EVENTS_STORAGE_KEY)!)).toHaveLength(3);
  });

  it("treats an expired snooze as pending while retaining the stored event", () => {
    const storage = new MemoryStorage();
    const [dose] = deriveDailyDoses("patient-1", [medication({ frequency: "once daily" })], new Date(2026, 9, 3, 12));
    const event = createDoseEvent(dose, "snoozed", new Date("2026-10-03T12:00:00.000Z"), 30);
    recordDoseEvent(event, storage);

    expect(latestEventForDose(loadDoseEvents(storage), dose.id, new Date("2026-10-03T12:15:00.000Z"))?.action).toBe("snoozed");
    expect(latestEventForDose(loadDoseEvents(storage), dose.id, new Date("2026-10-03T12:31:00.000Z"))).toBeUndefined();
    expect(loadDoseEvents(storage)).toHaveLength(1);
  });

  it("ignores corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(DOSE_EVENTS_STORAGE_KEY, "not-json");
    expect(loadDoseEvents(storage)).toEqual([]);
  });
});
