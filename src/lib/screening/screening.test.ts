import { describe, expect, it } from "vitest";
import { GAD7_ITEMS, PHQ9_ITEMS, SELF_HARM_SUPPORT, scoreScreening, severityBand } from ".";

describe("PHQ-9", () => {
  it("has 9 items and scores 0–27", () => {
    expect(PHQ9_ITEMS).toHaveLength(9);
    expect(scoreScreening("PHQ-9", Array(9).fill(0))).toMatchObject({ score: 0, max: 27, severity: "Minimal" });
    expect(scoreScreening("PHQ-9", Array(9).fill(3))).toMatchObject({ score: 27, severity: "Severe" });
  });

  it.each([
    [4, "Minimal"], [5, "Mild"], [9, "Mild"], [10, "Moderate"], [14, "Moderate"],
    [15, "Moderately severe"], [19, "Moderately severe"], [20, "Severe"],
  ])("score %i → %s", (score, band) => {
    expect(severityBand("PHQ-9", score)).toBe(band);
  });

  it("item 9 answered 'Not at all' does not trigger the safety response", () => {
    expect(scoreScreening("PHQ-9", [3, 3, 3, 3, 3, 3, 3, 3, 0]).selfHarmResponse).toBe(false);
  });

  it.each([1, 2, 3])("item 9 answered %i triggers the safety response, even when the total is low", (a) => {
    const r = scoreScreening("PHQ-9", [0, 0, 0, 0, 0, 0, 0, 0, a]);
    expect(r.selfHarmResponse).toBe(true);
    expect(r.severity).toBe("Minimal");
  });

  it("the safety message offers 988 (call or text) and 911 without blocking", () => {
    const hrefs = SELF_HARM_SUPPORT.actions.map((a) => a.href);
    expect(hrefs).toContain("tel:988");
    expect(hrefs).toContain("tel:911");
    expect(SELF_HARM_SUPPORT.actions[0].smsHref).toBe("sms:988");
    expect(SELF_HARM_SUPPORT.followUp).toMatch(/keep going/);
  });

  it("rejects malformed answers", () => {
    expect(() => scoreScreening("PHQ-9", [1, 2])).toThrow(RangeError);
    expect(() => scoreScreening("PHQ-9", [0, 0, 0, 0, 0, 0, 0, 0, 4])).toThrow(RangeError);
  });
});

describe("GAD-7", () => {
  it("has 7 items, scores 0–21, never raises the PHQ-9 safety response", () => {
    expect(GAD7_ITEMS).toHaveLength(7);
    const r = scoreScreening("GAD-7", [3, 3, 3, 3, 3, 3, 3]);
    expect(r).toMatchObject({ score: 21, max: 21, severity: "Severe", selfHarmResponse: false });
  });

  it.each([[4, "Minimal"], [5, "Mild"], [10, "Moderate"], [15, "Severe"]])("score %i → %s", (score, band) => {
    expect(severityBand("GAD-7", score)).toBe(band);
  });
});
