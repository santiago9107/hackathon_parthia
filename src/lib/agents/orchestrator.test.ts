import { describe, expect, it } from "vitest";
import { getRecord } from "@/lib/mockData";
import { orchestrate } from "./orchestrator";
import { reviewSpecialistItems } from "./safetyReviewer";
import type { SpecialistItem } from "./specialists";

const now = new Date("2026-09-11T12:00:00Z");

describe("specialist orchestration", () => {
  it("routes Margaret's facts and records linked handoffs", () => {
    const result = orchestrate(getRecord("p-margaret")!, now);
    expect(result.outputs.map((output) => output.specialist)).toEqual(expect.arrayContaining(["pharmacist", "cardiology", "nutrition", "behavioral"]));
    expect(result.linked.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("blocks unknown facts, directives, diagnosis wording and invented numbers", () => {
    const good: SpecialistItem = { id: "good", specialist: "pharmacist", patientText: "A record pattern is worth discussing with your care team.", clinicianText: "Review the cited evidence.", factIds: ["f1"], ingredients: [] };
    const bad: SpecialistItem[] = [
      { ...good, id: "unknown", factIds: ["missing"] },
      { ...good, id: "directive", clinicianText: "Stop the medicine now." },
      { ...good, id: "diagnosis", patientText: "You have heart failure." },
      { ...good, id: "number", patientText: "The dose is 900 mg.", factIds: ["f1"] },
    ];
    const review = reviewSpecialistItems([good, ...bad], [{ id: "f1", ruleId: "test", ingredients: [], basisIds: [], text: "A finding." }]);
    expect(review.passed.map((item) => item.id)).toEqual(["good"]);
    expect(review.blocked).toHaveLength(4);
  });
});
