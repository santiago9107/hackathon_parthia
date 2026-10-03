/** Dictionary-guide data rules: validity, confirmation, units, threshold priority, missing data. */
import { describe, expect, it } from "vitest";
import { findingsFor, fixture, run, ruleOutcome, confirmed } from "./helpers";

describe("validity windows (stale = missing)", () => {
  it("labs older than 90 days are treated as missing, never as normal", () => {
    const b = run(fixture("edge-stale-values"));
    expect(ruleOutcome(b, "R02")).toBe("missing_data");
    const k = b.missing_data.find((m) => m.element_id === "D007")!;
    expect(k.reason).toBe("stale");
    expect(k.last_value?.date).toBe("2026-05-20");
    expect(k.suggested_patient_question).toBe("When was your last potassium blood test?");
    expect(findingsFor(b, "R02")).toHaveLength(0);
  });

  it("weight older than the 2-day D011 window is missing", () => {
    const b = run(fixture("edge-stale-values"));
    expect(ruleOutcome(b, "R08")).toBe("missing_data");
    expect(b.missing_data.find((m) => m.element_id === "D011")!.reason).toBe("stale");
  });

  it("the same data becomes valid again when analysed as of an earlier date", () => {
    const b = run(fixture("rosa"), "2026-09-28T12:00:00Z");
    expect(b.missing_data.find((m) => m.element_id === "D011")).toBeUndefined();
  });

  it("DEC-03: potassium drawn before an MRA dose change no longer counts", () => {
    const s = fixture("margaret");
    const spiro = s.medications.find((m) => m.id === "m-spiro")!;
    spiro.events.push({ type: "change", date: "2026-09-30", detail: "dose changed" });
    const b = run(s);
    expect(ruleOutcome(b, "R02")).toBe("missing_data");
    const m = b.missing_data.find((x) => x.element_id === "D007")!;
    expect(m.reason).toBe("post_change_monitoring_due");
    expect(m.suggested_patient_question).toMatch(/after this medicine change/);
  });

  it("DEC-03: after 14 days without a post-change result it is overdue", () => {
    const s = fixture("margaret");
    s.medications.find((m) => m.id === "m-lisinopril")!.events.push({ type: "change", date: "2026-09-10" });
    // potassium results on 09-15 and 09-30 are AFTER this change, so they count
    expect(ruleOutcome(run(s), "R02")).toBe("fired");
    s.labs = s.labs.filter((l) => l.analyte !== "potassium" || l.date < "2026-09-10");
    s.labs.push({ id: "k-old", element_id: "D007", provenance: confirmed, analyte: "potassium", value: 5.8, unit: "mEq/L", date: "2026-09-01" });
    const b = run(s);
    expect(b.missing_data.find((x) => x.element_id === "D007")!.reason).toBe("post_change_monitoring_overdue");
    expect(findingsFor(b, "R02")).toHaveLength(0);
  });
});

describe("confirmed, reconciled data only", () => {
  it("unconfirmed items are ignored and reported as needs_review", () => {
    const s = fixture("harold");
    s.medications.find((m) => m.id === "m-naproxen")!.provenance.confirmed = false;
    const b = run(s);
    expect(findingsFor(b, "R01")).toHaveLength(0);
    expect(b.needs_review).toContainEqual(expect.objectContaining({ item_id: "m-naproxen", reason: "unconfirmed" }));
  });

  it("conflicting and pending items are excluded and listed; possible red flags first", () => {
    const b = run(fixture("edge-conflicting-sources"));
    expect(findingsFor(b, "R01")).toHaveLength(0);
    expect(b.urgent).toHaveLength(0); // the conflicting 6.3 is NOT used
    const reasons = b.needs_review.map((n) => [n.item_id, n.reason]);
    expect(reasons).toContainEqual(["p-harold-k-2026-10-01-a", "conflict"]);
    expect(reasons).toContainEqual(["m-naproxen", "pending_reconciliation"]);
  });

  it("items with an Element ID outside the dictionary or mismatched to their type are rejected", () => {
    const s = fixture("harold");
    s.labs.push({ id: "x1", element_id: "D099", provenance: confirmed, analyte: "potassium", value: 4, unit: "mEq/L", date: "2026-10-01" });
    s.labs.push({ id: "x2", element_id: "D008", provenance: confirmed, analyte: "potassium", value: 4, unit: "mEq/L", date: "2026-10-01" });
    const b = run(s);
    expect(b.needs_review.find((n) => n.item_id === "x1")!.reason).toBe("unknown_element");
    expect(b.needs_review.find((n) => n.item_id === "x2")!.reason).toBe("element_mismatch");
  });
});

describe("unit conversion (DEC-11 only)", () => {
  const b = run(fixture("edge-unit-conversions"));

  it("weights in lb are converted to kg and still trigger R08", () => {
    const f = findingsFor(b, "R08")[0]!;
    expect(f.evidence[1]!.unit).toBe("kg");
    expect(f.evidence[1]!.value).toBeCloseTo(73.5, 1);
    expect(f.evidence[1]!.conversion).toMatch(/lb -> .* kg \(DEC-11\)/);
  });

  it("potassium in mmol/L is accepted as mEq/L", () => {
    expect(findingsFor(b, "R02")[0]!.evidence[0]).toMatchObject({ value: 5.6, unit: "mEq/L" });
  });

  it("creatinine in µmol/L is converted to mg/dL (÷ 88.4), including its reference range", () => {
    const e = b.timeline.events.find((x) => x.label === "creatinine")!;
    expect(e.unit).toBe("mg/dL");
    expect(e.value).toBeCloseTo(1.12, 2);
  });

  it("a unit with no dictionary conversion is not guessed: magnesium mmol/L goes to needs_review", () => {
    expect(b.needs_review).toContainEqual(expect.objectContaining({ item_id: "edge-mg-1", reason: "unit_not_convertible" }));
  });
});

describe("threshold priority (care plan > lab range > default)", () => {
  it("defaults are used and labelled when no care-plan target exists", () => {
    const t = findingsFor(run(fixture("margaret")), "R08")[0]!.thresholds_used[0]!;
    expect(t).toMatchObject({ source: "default", value: 2.3, threshold_id: "T05" });
  });

  it("a care-plan weight-gain limit overrides the default and is labelled care_plan", () => {
    const s = fixture("margaret");
    s.care_plan.push({ id: "cp-7d", element_id: "D011", provenance: { ...confirmed, source: "care_plan" as const }, target: "weight_gain_7d_limit", value: 3.0, unit: "kg", set_on: "2026-09-01" });
    const b = run(s);
    expect(findingsFor(b, "R08")).toHaveLength(0);
    expect(b.audit.thresholds_used).toContainEqual(expect.objectContaining({ parameter: "7-day weight gain from lowest value", source: "care_plan", value: 3 }));
  });

  it("the lab's own reference range does not move a rule's alert value (AMB-04)", () => {
    const s = fixture("margaret");
    s.labs = s.labs.map((l) => (l.analyte === "potassium" ? { ...l, value: 5.3, reference_range: { low: 3.5, high: 5.2 } } : l));
    expect(findingsFor(run(s), "R02")).toHaveLength(0);
  });

  it("care-plan targets from a non-care-plan source are rejected", () => {
    const s = fixture("margaret");
    s.care_plan[0]!.provenance.source = "patient";
    expect(run(s).needs_review).toContainEqual(expect.objectContaining({ kind: "care_plan", reason: "invalid_value" }));
  });
});

describe("missing data is never normal", () => {
  it("Rosa (sparse logging): no findings invented; missing items with patient questions", () => {
    const b = run(fixture("rosa"));
    expect(b.ranked_findings).toHaveLength(0);
    const ids = b.missing_data.map((m) => m.element_id);
    expect(ids).toEqual(expect.arrayContaining(["D006", "D011", "D015", "D016"]));
    for (const m of b.missing_data) expect(m.suggested_patient_question).toBeTruthy();
  });

  it("R13 without a clinician eGFR baseline reports baseline_not_set", () => {
    const b = run(fixture("rosa"));
    const m = b.missing_data.find((x) => x.element_id === "D009")!;
    expect(m.reason).toBe("baseline_not_set");
    expect(m.needed_by_rule_ids).toContain("R13");
  });

  it("missing labs produce missing-data items, not findings", () => {
    const b = run(fixture("edge-missing-labs"));
    expect(findingsFor(b, "R02")).toHaveLength(0);
    expect(b.missing_data.map((m) => m.element_id)).toEqual(expect.arrayContaining(["D007", "D008", "D009"]));
  });

  it("'Later' elements are never requested from the patient (guide rule 7)", () => {
    const s = fixture("harold");
    s.labs = s.labs.filter((l) => l.analyte !== "inr");
    for (const m of run(s).missing_data) {
      if (["D018", "D019", "D020"].includes(m.element_id)) expect(m.suggested_patient_question).toBeNull();
    }
  });
});

describe("other rules", () => {
  it("R06: ARNI started 48 h after the ACE inhibitor ended is not flagged; within 36 h it is", () => {
    expect(ruleOutcome(run(fixture("harold")), "R06")).toBe("not_fired");
    const s = fixture("harold");
    s.medications.find((m) => m.id === "m-lisinopril")!.events[1]!.date = "2025-04-09";
    expect(findingsFor(run(s), "R06")).toHaveLength(1);
  });

  it("R13 fires at a 30% eGFR drop from the care-plan baseline", () => {
    const s = fixture("margaret");
    s.labs = s.labs.map((l) => (l.id.endsWith("egfr-2026-09-30") ? { ...l, value: 40 } : l));
    expect(findingsFor(run(s), "R13")[0]!.severity).toBe("high");
  });

  it("R09: two low systolic readings + dizziness + 2 BP-lowering medicines", () => {
    const s = fixture("margaret");
    for (const v of s.vitals) if (v.kind === "blood_pressure" && v.datetime >= "2026-10-01") v.systolic = 86;
    s.symptoms.at(-1)!.reported.push("dizziness");
    expect(findingsFor(run(s), "R09")).toHaveLength(1);
  });

  it("R11 escalates to High with digoxin (KB comment)", () => {
    const s = fixture("margaret");
    s.labs = s.labs.map((l) => (l.analyte === "potassium" ? { ...l, value: 3.3 } : l));
    expect(findingsFor(run(s), "R11")[0]!.severity).toBe("moderate");
    s.medications.push({ id: "m-dig", element_id: "D005", provenance: confirmed, name: "Digoxin", ingredients: ["digoxin"], otc: false, events: [{ type: "start", date: "2025-01-01" }] });
    expect(findingsFor(run(s), "R11")[0]!.severity).toBe("high");
  });

  it("R15 and R16 are reported as not evaluable, not silently skipped", () => {
    const b = run(fixture("margaret"));
    expect(ruleOutcome(b, "R15")).toBe("not_evaluable");
    expect(ruleOutcome(b, "R16")).toBe("not_evaluable");
  });
});
