import { describe, expect, it } from "vitest";
import { buildHuddle, urgentNotice, usePlayback } from "./huddle";
import { MARGARET_HUDDLE_FIXTURE } from "./huddle.fixture";

const reply = {
  answeredBy: "rules" as const,
  segments: [{ kind: "authored" as const, text: "Bring these questions to your care team." }],
  citations: [{ label: "Margaret medication record" }],
  suggestions: [],
};

describe("agent huddle contract", () => {
  it("maps every orchestrator handoff in sequence and ends with an answer step", () => {
    const huddle = buildHuddle(MARGARET_HUDDLE_FIXTURE, reply);
    expect(huddle.messages).toHaveLength(MARGARET_HUDDLE_FIXTURE.messages.length);
    expect(huddle.messages.map((message) => message.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(huddle.steps.map((step) => step.label)).toEqual([
      "Question received", "Records gathered", "Safety rules checked", "Specialists reviewing",
      "Linked across specialists", "Safety review", "Answer ready",
    ]);
    expect(huddle.steps.at(-1)?.id).toBe("answer");
    expect(huddle.steps.at(-2)?.detail).toBe("6 passed, 1 blocked");
  });

  it("advances statuses, skip and reduced motion to the final state", () => {
    const huddle = buildHuddle(MARGARET_HUDDLE_FIXTURE, reply);
    const running = usePlayback(huddle, { elapsedMs: 900, stepMs: 700 });
    expect(running.complete).toBe(false);
    expect(running.currentStep).toBe(1);
    expect(Object.values(running.statuses)).toContain("working");
    expect(usePlayback(huddle, { skipped: true }).complete).toBe(true);
    expect(usePlayback(huddle, { reducedMotion: true }).currentStep).toBe(6);
  });

  it("shows urgent notices immediately and never treats them as a huddle", () => {
    expect(urgentNotice("physical")).toContain("911");
    expect(urgentNotice("self-harm")).toContain("988");
    expect(urgentNotice(undefined)).toBeUndefined();
  });
});
