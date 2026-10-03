import { describe, expect, it } from "vitest";
import { computeMeasures } from "./index";
import { getRecord } from "../mockData";

const AS_OF = new Date("2026-09-11T12:00:00Z");

describe("Passport measures", () => {
  it("computes Margaret's recent weight gain from dated readings", () => {
    const record = getRecord("p-margaret")!;
    const measure = computeMeasures(record, AS_OF).find((item) => item.id === "weight-change-3d");
    expect(measure?.value).toBe(1.5);
    expect(measure?.basis.length).toBeGreaterThanOrEqual(3);
  });

  it("returns insufficient data instead of inventing a trend", () => {
    const record = getRecord("p-rosa")!;
    const measure = computeMeasures(record, AS_OF).find((item) => item.id === "bp-trend-14d");
    expect(measure?.status).toBe("insufficient-data");
    expect(measure?.value).toBeNull();
  });

  it("keeps the measure window and evidence ids explicit", () => {
    const record = getRecord("p-margaret")!;
    const measure = computeMeasures(record, AS_OF).find((item) => item.id === "egfr-trend");
    expect(measure?.window).toEqual({ from: "2026-05-20", to: "2026-08-28" });
    expect(measure?.basis).toEqual(["l-m11", "l-m2"]);
  });
});
