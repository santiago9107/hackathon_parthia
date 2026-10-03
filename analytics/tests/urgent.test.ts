/** RED FLAGS FIRST: R21, R22 and urgent labs (DEC-06, DEC-07). */
import { describe, expect, it, vi } from "vitest";
import { fixture, run, confirmed } from "./helpers";

describe("urgent pathway", () => {
  it("red-flag symptoms and urgent vitals produce urgent items at the top, independent of findings", () => {
    const b = run(fixture("edge-red-flags"));
    const ids = b.urgent.map((u) => u.urgent_id);
    expect(ids.some((i) => i.startsWith("R21:symptom"))).toBe(true); // chest pain alone
    expect(ids.some((i) => i.startsWith("R21:bp-high"))).toBe(true); // 186/96 (AMB-02, provisional)
    expect(ids.some((i) => i.startsWith("R21:hr"))).toBe(true); // HR 128 + dizziness/chest pain within 24 h
    for (const u of b.urgent) {
      expect(u.patient_message).toMatch(/911/);
      expect(u.element_ids.length).toBeGreaterThan(0);
      expect(u.knowledge.length).toBeGreaterThan(0);
    }
  });

  it("an HR of 128 without qualifying symptoms is not urgent (DEC-07)", () => {
    const s = fixture("edge-red-flags");
    s.symptoms = s.symptoms.filter((c) => c.reported.length === 0);
    s.vitals = s.vitals.filter((v) => v.kind !== "blood_pressure" || (v.systolic ?? 0) < 180);
    expect(run(s).urgent).toHaveLength(0);
  });

  it("dizziness alone is not a red flag; it only qualifies an urgent vital", () => {
    const s = fixture("rosa");
    s.symptoms.push({ id: "sx-d", element_id: "D014", provenance: { ...confirmed, source: "patient" as const }, datetime: "2026-10-03T07:00:00-04:00", reported: ["dizziness"] });
    expect(run(s).urgent).toHaveLength(0);
  });

  it("a red-flag symptom older than the 1-day D014 window does not trigger", () => {
    const b = run(fixture("edge-red-flags"), "2026-10-05T12:00:00Z");
    expect(b.urgent.filter((u) => u.pathway === "red_flag_symptom")).toHaveLength(0);
  });

  it("PHQ-9 item 9 > 0 is urgent and ordered before other urgent items", () => {
    const s = fixture("edge-red-flags");
    s.mood.push({ id: "phq-x", element_id: "D016", provenance: { ...confirmed, source: "patient" as const }, date: "2026-10-02", instrument: "PHQ-9", score: 12, item9: 2 });
    const b = run(s);
    expect(b.urgent[0]!.pathway).toBe("self_harm");
    expect(b.urgent[0]!.patient_message).toMatch(/988/);
  });

  it("urgent labs (DEC-06): potassium 6.2, sodium 123, INR 4.8", () => {
    const s = fixture("harold");
    const base = { provenance: confirmed, date: "2026-10-02" };
    s.labs.push({ ...base, id: "k", element_id: "D007", analyte: "potassium", value: 6.2, unit: "mEq/L" });
    s.labs.push({ ...base, id: "na", element_id: "D008", analyte: "sodium", value: 123, unit: "mEq/L" });
    s.labs.push({ ...base, id: "inr", element_id: "D019", analyte: "inr", value: 4.8, unit: "ratio" });
    const b = run(s);
    expect(b.urgent.map((u) => u.urgent_id).sort()).toEqual(["UL-INR-HIGH:inr", "UL-K-HIGH:k", "UL-NA-LOW:na"]);
    expect(b.urgent.every((u) => u.decision_ids.includes("DEC-06"))).toBe(true);
  });

  it("an eGFR drop >= 30% is High (R13), not urgent (DEC-06)", () => {
    const s = fixture("margaret");
    s.labs = s.labs.map((l) => (l.id.endsWith("egfr-2026-09-30") ? { ...l, value: 35 } : l));
    const b = run(s);
    expect(b.urgent).toHaveLength(0);
    expect(b.ranked_findings.find((f) => f.rule_id === "R13")!.severity).toBe("high");
  });

  it("unconfirmed possible red flags are not analysed but are surfaced first in needs_review (AMB-18)", () => {
    const s = fixture("rosa");
    s.mood.push({ id: "phq-u", element_id: "D016", provenance: { ...confirmed, source: "patient" as const, confirmed: false }, date: "2026-10-02", instrument: "PHQ-9", score: 12, item9: 1 });
    const b = run(s);
    expect(b.urgent).toHaveLength(0);
    expect(b.needs_review[0]).toMatchObject({ item_id: "phq-u", possible_red_flag: true });
  });

  it("clinical mode: Draft R21/R22 are excluded and the bundle says the urgent pathway is disabled", () => {
    const b = run(fixture("edge-phq9-item9"), undefined, { knowledge_mode: "clinical" });
    expect(b.urgent).toHaveLength(0);
    expect(b.ranked_findings).toHaveLength(0);
    expect(b.audit.warnings.join(" ")).toMatch(/Urgent pathway R22 is disabled in clinical mode/);
    expect(b.audit.rules_evaluated.every((r) => ["excluded_by_mode", "not_evaluable"].includes(r.outcome))).toBe(true);
  });
});

describe("urgent short-circuit", () => {
  it("urgent results are returned even when the rest of the analysis fails", async () => {
    vi.resetModules();
    vi.doMock("../src/engine/rules", () => ({ evaluateRules: () => { throw new Error("simulated failure"); } }));
    const { analyzePatient } = await import("../src/analyze");
    const b = analyzePatient(fixture("edge-phq9-item9"), "2026-10-03T12:00:00Z");
    expect(b.urgent[0]!.rule_id).toBe("R22");
    expect(b.ranked_findings).toEqual([]);
    expect(b.audit.warnings.join(" ")).toMatch(/ANALYSIS INCOMPLETE: simulated failure/);
    vi.doUnmock("../src/engine/rules");
  });
});
