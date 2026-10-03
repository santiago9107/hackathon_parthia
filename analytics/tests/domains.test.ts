/** 6.2 Holistic domain profile. */
import { describe, expect, it } from "vitest";
import { DOMAIN_IDS } from "../src/model/bundle";
import { fixture, fixtureNames, run } from "./helpers";

const domain = (b: ReturnType<typeof run>, id: string) => b.domain_profile.find((d) => d.domain === id)!;

describe("domain profile", () => {
  it.each(fixtureNames())("%s: exactly the 8 domains, in order, with no combined score", (name) => {
    const b = run(fixture(name));
    expect(b.domain_profile.map((d) => d.domain)).toEqual([...DOMAIN_IDS]);
    expect(JSON.stringify(b.domain_profile)).not.toMatch(/"(overall|total|combined)_?score"/);
  });

  it("Margaret: status per domain follows the worst finding severity (High -> attention, Moderate -> watch)", () => {
    const b = run(fixture("margaret"));
    expect(Object.fromEntries(b.domain_profile.map((d) => [d.domain, d.status]))).toEqual({
      medication_safety: "good",
      fluid_congestion: "watch",
      heart_kidney_labs: "attention",
      bp_heart_rate: "good",
      mental_health: "watch",
      adherence: "watch",
      nutrition: "attention",
      function_qol: "insufficient_data",
    });
    expect(domain(b, "heart_kidney_labs").rule_ids).toEqual(["R02"]);
    expect(domain(b, "nutrition").rule_ids).toEqual(["R07"]);
    expect(domain(b, "mental_health").rule_ids).toEqual(["R19"]);
    expect(domain(b, "adherence").rule_ids).toEqual(["R20"]);
  });

  it("Margaret: trends compare the recent window with the previous one", () => {
    const b = run(fixture("margaret"));
    expect(domain(b, "fluid_congestion").trend).toBe("worsening");
    expect(domain(b, "heart_kidney_labs").trend).toBe("worsening");
    expect(domain(b, "mental_health").trend).toBe("worsening");
    expect(domain(b, "adherence").trend).toBe("worsening");
    expect(domain(b, "nutrition").trend).toBe("worsening");
    expect(domain(b, "bp_heart_rate").trend).toBe("stable");
    expect(domain(b, "medication_safety").trend).toBe("unknown");
  });

  it("Harold: medication safety needs attention (R01), other domains good", () => {
    const b = run(fixture("harold"));
    expect(domain(b, "medication_safety")).toMatchObject({ status: "attention", rule_ids: ["R01"] });
    expect(domain(b, "fluid_congestion").status).toBe("good");
    expect(domain(b, "bp_heart_rate").status).toBe("good");
    expect(domain(b, "fluid_congestion").trend).toBe("stable");
  });

  it("Rosa (sparse logging): missing data gives insufficient_data, never 'good'", () => {
    const b = run(fixture("rosa"));
    for (const id of ["fluid_congestion", "mental_health", "adherence", "nutrition"]) {
      expect(domain(b, id).status, id).toBe("insufficient_data");
    }
    expect(domain(b, "fluid_congestion").missing_element_ids).toEqual(["D011", "D014"]);
    const d014 = b.missing_data.find((m) => m.element_id === "D014")!;
    expect(d014.needed_by_domains).toEqual(["fluid_congestion"]);
    expect(d014.suggested_patient_question).toMatch(/symptom check/);
  });

  it("function and quality of life is insufficient until KCCQ exists", () => {
    for (const name of fixtureNames()) expect(domain(run(fixture(name)), "function_qol").status).toBe("insufficient_data");
  });

  it("urgent items colour their domain 'attention' (AMB-06)", () => {
    const b = run(fixture("edge-phq9-item9"));
    expect(domain(b, "mental_health")).toMatchObject({ status: "attention" });
    expect(domain(b, "mental_health").urgent_ids).toHaveLength(1);
  });

  it("findings take precedence over missing data, and the reason says both", () => {
    const s = fixture("margaret");
    s.symptoms = [];
    const d = domain(run(s), "fluid_congestion");
    expect(d.status).toBe("watch");
    expect(d.reason).toMatch(/symptoms checklist is missing|missing or out of date: symptoms checklist/);
  });

  it("every finding and urgent item belongs to exactly one domain entry", () => {
    const b = run(fixture("edge-red-flags"));
    const ids = b.domain_profile.flatMap((d) => [...d.finding_ids, ...d.urgent_ids]).sort();
    expect(ids).toEqual([...b.ranked_findings.map((f) => f.finding_id), ...b.urgent.map((u) => u.urgent_id)].sort());
  });
});
