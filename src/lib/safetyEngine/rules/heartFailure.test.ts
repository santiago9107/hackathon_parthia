import { describe, expect, it } from "vitest";
import { evaluatePatient } from "../index";
import { getRecord } from "../../mockData";

const now = new Date("2026-09-11T12:00:00Z");

describe("heart-failure weight rule", () => {
  it("flags Margaret's rapid gain with source evidence", () => {
    const flags = evaluatePatient(getRecord("p-margaret")!, { now, ruleIds: ["heart-failure/rapid-weight-gain"] });
    expect(flags).toHaveLength(1);
    expect(flags[0].evidence.some((line) => line.includes("heart.org"))).toBe(true);
    expect(flags[0].suggestedNextStep).toMatch(/Could your care team review/);
  });

  it("does not apply to a record without a heart-failure profile", () => {
    const flags = evaluatePatient(getRecord("p-rosa")!, { now, ruleIds: ["heart-failure/rapid-weight-gain"] });
    expect(flags).toHaveLength(0);
  });
});
