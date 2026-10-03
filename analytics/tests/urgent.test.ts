/** RED FLAGS FIRST: R21, R22 and urgent labs (DEC-06, DEC-07). */
import { describe, expect, it, vi } from "vitest";
import { fixture, run, confirmed } from "./helpers";

describe("urgent pathway", () => {
  it("red-flag symptoms and urgent vitals (BP >= 180 OR >= 120, DEC-15) produce urgent items at the top", () => {
    const b = run(fixture("edge-red-flags"));
    const ids = b.urgent.map((u) => u.urgent_id);
    expect(ids.some((i) => i.startsWith("R21:symptom"))).toBe(true); // chest pain alone
    expect(ids.some((i) => i.startsWith("R21:bp-high"))).toBe(true); // 186/96: systolic >= 180 (DEC-15)
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

  it("diastolic >= 120 alone is urgent (DEC-15)", () => {
    const s = fixture("rosa");
    s.vitals.push({ id: "bp-d", element_id: "D012", provenance: { ...confirmed, source: "device" as const }, kind: "blood_pressure", datetime: "2026-10-03T07:00:00-04:00", systolic: 165, diastolic: 122, unit: "mmHg" });
    expect(run(s).urgent.map((u) => u.urgent_id)).toEqual(["R21:bp-high:bp-d"]);
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

  it("DEC-18: a patient-entered PHQ-9 counts as confirmed on entry and triggers the urgent message", () => {
    const s = fixture("rosa");
    s.mood.push({ id: "phq-u", element_id: "D016", provenance: { ...confirmed, source: "patient" as const, confirmed: false }, date: "2026-10-02", instrument: "PHQ-9", score: 12, item9: 1 });
    const b = run(s);
    expect(b.urgent[0]).toMatchObject({ urgent_id: "R22:phq-u", data_status: "confirmed" });
    expect(b.needs_review.find((n) => n.item_id === "phq-u")).toBeUndefined();
  });

  it("DEC-18: an unconfirmed imported potassium 6.2 shows the urgent message AND stays in needs_review", () => {
    const s = fixture("harold");
    s.labs.push({ id: "k-scan", element_id: "D007", provenance: { ...confirmed, source: "scan" as const, confirmed: false }, analyte: "potassium", value: 6.2, unit: "mEq/L", date: "2026-10-02" });
    const b = run(s);
    expect(b.urgent[0]).toMatchObject({ urgent_id: "UL-K-HIGH:k-scan", data_status: "unconfirmed", pathway: "urgent_lab" });
    expect(b.needs_review[0]).toMatchObject({ item_id: "k-scan", reason: "unconfirmed", possible_red_flag: true });
    expect(b.ranked_findings.some((f) => f.evidence.some((e) => e.item_id === "k-scan"))).toBe(false); // still not analysed
    expect(b.audit.warnings.join(" ")).toMatch(/DEC-18/);
  });

  it("DEC-18: an unconfirmed device heart rate of 128 with symptoms is urgent", () => {
    const s = fixture("edge-red-flags");
    for (const v of s.vitals) if (v.kind === "heart_rate" && v.datetime.startsWith("2026-10-03")) v.provenance.confirmed = false;
    const hr = run(s).urgent.find((u) => u.urgent_id.startsWith("R21:hr"))!;
    expect(hr.data_status).toBe("unconfirmed");
  });

  it("an older unconfirmed lab does not override a newer confirmed normal result", () => {
    const s = fixture("harold");
    s.labs.push({ id: "k-old-scan", element_id: "D007", provenance: { ...confirmed, source: "scan" as const, confirmed: false }, analyte: "potassium", value: 6.4, unit: "mEq/L", date: "2026-08-20" });
    expect(run(s).urgent).toHaveLength(0);
  });

  it("DEC-17: clinical mode never switches off the urgent pathway; Draft items are labelled", () => {
    const b = run(fixture("edge-phq9-item9"), undefined, { knowledge_mode: "clinical" });
    expect(b.urgent).toHaveLength(1);
    expect(b.urgent[0]).toMatchObject({ rule_id: "R22", approval_status: "draft_pending_clinical_approval", approval_label: "Draft – pending clinical approval" });
    expect(b.ranked_findings).toHaveLength(0); // R01-R20 are still Draft and excluded in clinical mode
    expect(b.audit.rules_evaluated.find((r) => r.rule_id === "R22")!.outcome).toBe("fired");
    expect(b.audit.rules_evaluated.filter((r) => !["R21", "R22"].includes(r.rule_id)).every((r) => ["excluded_by_mode", "not_evaluable"].includes(r.outcome))).toBe(true);
  });

  it("every urgent item carries approval and data status", () => {
    for (const u of run(fixture("edge-red-flags")).urgent) {
      expect(u.approval_status).toBe("draft_pending_clinical_approval");
      expect(u.data_status).toBe("confirmed");
    }
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
