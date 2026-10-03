import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import type { DataSource, VitalSign } from "../types";
import { passportGaps } from "./completeness";
import { emptyPassport } from "./collections";
import { summarizeSources } from "./items";
import { mergeRecord } from "./merge";
import { upsertItems } from "./ops";
import { buildTimeline, filterTimeline } from "./timeline";

const now = referenceNow();
const harold = getSeedRecord("p-harold")!;
const watch: DataSource = { kind: "wearable", label: "Apple Health", importedAt: "2026-10-03T08:00:00", verified: true };

describe("timeline", () => {
  const events = buildTimeline(harold, now);

  it("is newest first and includes every kind of Passport event", () => {
    const whens = events.map((e) => e.when);
    expect(whens).toEqual([...whens].sort().reverse());
    const cats = new Set(events.map((e) => e.category));
    for (const c of ["visit", "lab", "medication", "appointment", "screening", "reading", "document", "immunization", "procedure", "daily-log"]) {
      expect(cats.has(c as never), c).toBe(true);
    }
  });

  it("marks future appointments as upcoming and hides fulfilled ones that have a visit summary", () => {
    const appts = events.filter((e) => e.category === "appointment");
    expect(appts.every((a) => a.upcoming)).toBe(true);
    expect(appts.map((a) => a.id).sort()).toEqual(["ap-h5", "ap-h6", "ap-h7"]);
  });

  it("groups lab results by panel", () => {
    const inr = events.filter((e) => e.category === "lab" && e.title === "Prothrombin time / INR");
    expect(inr).toHaveLength(5);
  });

  it("collapses daily logs to one row per day", () => {
    const days = events.filter((e) => e.category === "daily-log");
    expect(new Set(days.map((d) => d.when.slice(0, 10))).size).toBe(days.length);
  });

  it("filters by category and by source", () => {
    expect(filterTimeline(events, { categories: ["lab"] }).every((e) => e.category === "lab")).toBe(true);
    const withWatch = mergeRecord(
      harold,
      upsertItems(emptyPassport("p-harold"), "vitals", [{ id: "v-w1", patientId: "p-harold", timestamp: "2026-09-10T07:00:00", restingHeartRate: 52, source: watch } as VitalSign], "confirmed", "2026-10-03T08:00:00"),
    );
    const onlyWatch = filterTimeline(buildTimeline(withWatch, now), { sourceKinds: ["wearable"] });
    expect(onlyWatch.map((e) => e.id)).toEqual(["v-w1"]);
    expect(onlyWatch[0].title).toContain("resting HR 52");
  });
});

describe("what's missing", () => {
  it("Harold's seed Passport is nearly complete", () => {
    const ids = passportGaps(harold, now).map((g) => g.id);
    expect(ids).not.toContain("emergency-contact");
    expect(ids).not.toContain("allergies");
    expect(ids).not.toContain("appointment");
  });

  it("flags missing basics on an empty Passport", () => {
    const bare = { ...harold, allergies: [], emergency: undefined, nutritionProfile: undefined, appointments: [], assessments: [], documents: [], careTeam: [], immunizations: [], patient: { ...harold.patient, vitals: [] } };
    const ids = passportGaps(bare, now).map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(["emergency-contact", "blood-type", "allergies", "primary-care", "nutrition-profile", "bp", "phq9", "flu", "appointment", "documents"]));
  });
});

describe("sources summary", () => {
  it("counts seed items and pending imports separately", () => {
    const local = upsertItems(emptyPassport("p-harold"), "vitals", [{ id: "v-w2", patientId: "p-harold", timestamp: "2026-09-10T07:00:00", steps: 4200, source: watch } as VitalSign], "pending", "2026-10-03T08:00:00");
    const s = summarizeSources(mergeRecord(harold, local), local);
    const seed = s.find((x) => x.kind === "seed")!;
    const apple = s.find((x) => x.label === "Apple Health")!;
    expect(seed.confirmed).toBeGreaterThan(100);
    expect(apple).toMatchObject({ confirmed: 0, pending: 1 });
  });
});
