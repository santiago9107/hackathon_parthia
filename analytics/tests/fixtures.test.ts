import { describe, expect, it } from "vitest";
import { PatientSnapshot } from "../src/model/snapshot";
import { fixture, fixtureNames } from "./helpers";

describe("synthetic fixtures", () => {
  it.each(fixtureNames())("%s is a valid, synthetic PatientSnapshot", (name) => {
    const s = PatientSnapshot.parse(fixture(name));
    expect(s.synthetic).toBe(true);
  });

  it("includes the three personas and the edge cases", () => {
    expect(fixtureNames()).toEqual(expect.arrayContaining([
      "margaret", "harold", "rosa", "edge-missing-labs", "edge-stale-values", "edge-conflicting-sources", "edge-unit-conversions",
    ]));
  });
});
