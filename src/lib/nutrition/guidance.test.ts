import { describe, expect, it } from "vitest";
import { getSeedRecord } from "../mockData";
import { buildFoodGuidance } from "./guidance";

describe("food guidance", () => {
  it("encourages consistency rather than avoiding greens for warfarin", () => {
    const text = buildFoodGuidance(getSeedRecord("p-harold")!).map((item) => `${item.title} ${item.detail}`).join(" ");
    expect(text).toMatch(/consistent/i);
    expect(text).toMatch(/do not automatically avoid greens/i);
    expect(text).not.toMatch(/avoid leafy greens/i);
  });

  it("offers a food pattern for diabetes", () => {
    const items = buildFoodGuidance(getSeedRecord("p-rosa")!);
    expect(items).toEqual(expect.arrayContaining([expect.objectContaining({ id: "diabetes-pattern", kind: "consider" })]));
  });

  it("keeps confirmed food allergies visible without treating medication allergies as foods", () => {
    const margaret = buildFoodGuidance(getSeedRecord("p-margaret")!);
    expect(margaret.find((item) => item.id === "allergy-labels")?.detail).toMatch(/Shellfish/);
    const rosa = buildFoodGuidance(getSeedRecord("p-rosa")!);
    expect(rosa.find((item) => item.id === "allergy-labels")).toBeUndefined();
  });

  it("falls back to general guidance for an empty import-only Passport", () => {
    expect(buildFoodGuidance(getSeedRecord("p-synthea-shaun")!)[0]).toMatchObject({ id: "balanced-pattern", kind: "consider" });
  });
});
