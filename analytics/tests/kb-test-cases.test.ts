/**
 * Every test case in the KB "Test cases" sheet as an automated test.
 * Expected rule IDs, severity and "Must NOT say" are read from the exported KB.
 */
import { describe, expect, it } from "vitest";
import { loadKnowledge } from "../src/knowledge/index";
import { findingsFor, fixture, run } from "./helpers";

const k = loadKnowledge();
const tc = (id: string) => k.testCases.find((t) => t.test_id === id)!;
const allText = (b: ReturnType<typeof run>) => JSON.stringify([b.urgent, b.ranked_findings, b.missing_data]);
const mustNotSay = (id: string) => (tc(id).must_not_say ?? "").match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];

describe("KB test cases", () => {
  it("TC01 Harold: naproxen in HF -> R01 High, no 'stop' instruction", () => {
    const b = run(fixture("harold"));
    const f = findingsFor(b, "R01");
    expect(tc("TC01").expected_rule_ids).toEqual(["R01"]);
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe(tc("TC01").expected_severity);
    expect(f[0]!.patient_question).toContain("Naproxen");
    expect(f[0]!.patient_question).toMatch(/safer option\?$/);
    for (const s of mustNotSay("TC01")) expect(allText(b).toLowerCase()).not.toContain(s.toLowerCase());
  });

  it("TC02 Margaret (HFpEF): potassium 5.6 on spironolactone -> R02 High (DEC-01: all phenotypes)", () => {
    const b = run(fixture("margaret"));
    expect(b.phenotype.value).toBe("HFpEF");
    const f = findingsFor(b, "R02");
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe(tc("TC02").expected_severity);
    expect(f[0]!.patient_question).toBe("My potassium was 5.6 mEq/L. Should my Spironolactone be adjusted?");
    expect(f[0]!.decision_ids).toContain("DEC-01");
  });

  it("TC03 Margaret: potassium salt substitute with lisinopril + spironolactone -> R07 (KB Moderate, escalated to High by DEC-05)", () => {
    const b = run(fixture("margaret"));
    const f = findingsFor(b, "R07")[0]!;
    expect(f.base_severity).toBe(tc("TC03").expected_severity);
    expect(f.severity).toBe("high");
    expect(f.decision_ids).toContain("DEC-05");
    for (const s of mustNotSay("TC03")) expect(allText(b).toLowerCase()).not.toContain(s.toLowerCase());
  });

  it("TC03 variant: R07 stays Moderate when potassium is normal and not rising", () => {
    const s = fixture("margaret");
    s.labs = s.labs.map((l) => (l.analyte === "potassium" ? { ...l, value: 4.5 } : l));
    const f = findingsFor(run(s), "R07")[0]!;
    expect(f.severity).toBe("moderate");
    expect(f.base_severity).toBe("moderate");
  });

  it("TC03 variant: R07 escalates on a potassium rise >= 0.5 vs the previous result", () => {
    const s = fixture("margaret");
    s.labs = s.labs.map((l) => (l.analyte === "potassium" ? { ...l, value: l.date === "2026-09-30" ? 4.9 : 4.3 } : l));
    expect(findingsFor(run(s), "R07")[0]!.severity).toBe("high");
  });

  it("TC04 Margaret: +2.5 kg in 5 days with breathlessness -> R08 Moderate, no extra-diuretic advice", () => {
    const b = run(fixture("margaret"));
    const f = findingsFor(b, "R08")[0]!;
    expect(f.severity).toBe(tc("TC04").expected_severity);
    expect(f.patient_question).toBe("My weight went up 2.5 kg in 5 days. Should I contact my care team?");
    for (const s of mustNotSay("TC04")) expect(allText(b).toLowerCase()).not.toContain(s.toLowerCase());
  });

  it("TC05 NEGATIVE: diltiazem in HFpEF (LVEF 60%) is NOT flagged", () => {
    const b = run(fixture("edge-diltiazem-hfpef"));
    expect(tc("TC05").expected_rule_ids).toEqual(["R04"]); // text says "None (R04 is HFrEF only)"
    expect(tc("TC05").expected_severity).toBeNull();
    expect(b.phenotype.value).toBe("HFpEF");
    expect(findingsFor(b, "R04")).toHaveLength(0);
    expect(b.audit.rules_evaluated.find((r) => r.rule_id === "R04")!.outcome).toBe("not_fired");
  });

  it("TC05 control: the same patient with LVEF 35% (HFrEF) IS flagged High", () => {
    const b = run(fixture("edge-diltiazem-hfref"));
    expect(b.phenotype.value).toBe("HFrEF");
    expect(findingsFor(b, "R04")[0]!.severity).toBe("high");
  });

  it("TC06 PHQ-9 item 9 > 0 -> urgent, first, with 988 and 911, independent of other analysis", () => {
    const b = run(fixture("edge-phq9-item9"));
    expect(b.urgent[0]!.rule_id).toBe("R22");
    expect(b.urgent[0]!.pathway).toBe("self_harm");
    expect(b.urgent[0]!.patient_message).toMatch(/988/);
    expect(b.urgent[0]!.patient_message).toMatch(/911/);
    expect(tc("TC06").expected_severity).toBe("urgent");
  });
});
