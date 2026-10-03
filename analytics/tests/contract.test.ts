/** Output contract, determinism, citations and the forbidden-phrase scan. */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import { AS_OF, PERSONAS, bundleSchema, example, snapshotSchema } from "../scripts/write-contract";
import { forbiddenPhrases } from "../src/engine/text";
import { fixture, fixtureNames, run } from "./helpers";

const contract = (p: string) => readFileSync(new URL(`../contract/${p}`, import.meta.url), "utf-8");

describe("published contract", () => {
  it("holistic_bundle.schema.json is in sync with the zod source (run `npm run schema`)", () => {
    expect(contract("holistic_bundle.schema.json")).toBe(bundleSchema());
  });

  it("patient_snapshot.schema.json is in sync with the zod source", () => {
    expect(contract("patient_snapshot.schema.json")).toBe(snapshotSchema());
  });

  it("there is one committed example bundle per persona, and each is current", () => {
    expect(readdirSync(new URL("../contract/examples/", import.meta.url)).sort()).toEqual(PERSONAS.map((p) => `${p}.json`).sort());
    for (const p of PERSONAS) expect(contract(`examples/${p}.json`), p).toBe(example(p));
  });

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateBundle = ajv.compile(JSON.parse(contract("holistic_bundle.schema.json")));
  const validateSnapshot = ajv.compile(JSON.parse(contract("patient_snapshot.schema.json")));

  it.each(PERSONAS)("examples/%s.json validates against the published JSON Schema", (p) => {
    expect(validateBundle(JSON.parse(contract(`examples/${p}.json`))), JSON.stringify(validateBundle.errors)).toBe(true);
  });

  it.each(fixtureNames())("bundle for fixture %s validates against the JSON Schema", (name) => {
    expect(validateBundle(JSON.parse(JSON.stringify(run(fixture(name))))), JSON.stringify(validateBundle.errors)).toBe(true);
  });

  it.each(fixtureNames())("fixture %s validates against the published snapshot schema", (name) => {
    expect(validateSnapshot(fixture(name)), JSON.stringify(validateSnapshot.errors)).toBe(true);
  });
});

describe("determinism", () => {
  it.each(fixtureNames())("%s: same input -> byte-identical output", (name) => {
    expect(JSON.stringify(run(fixture(name)))).toBe(JSON.stringify(run(fixture(name))));
  });

  it("output does not depend on the order of input items", () => {
    const a = fixture("margaret");
    const b = fixture("margaret");
    for (const key of ["medications", "labs", "vitals", "symptoms", "diet_logs", "mood", "adherence", "care_plan"] as const) b[key].reverse();
    expect(JSON.stringify(run(b))).toBe(JSON.stringify(run(a)));
  });
});

describe("citations and review status (guide rules 1, 11)", () => {
  it.each(fixtureNames())("%s: every finding and urgent item cites element, rule/threshold and source IDs with review status", (name) => {
    const b = run(fixture(name));
    for (const f of b.ranked_findings) {
      expect(f.element_ids.length, f.finding_id).toBeGreaterThan(0);
      expect(f.rule_ids).toEqual([f.rule_id]);
      expect(f.source_ids.length).toBeGreaterThan(0);
      expect(f.evidence.length).toBeGreaterThan(0);
      for (const e of f.evidence) expect(e.element_id).toMatch(/^D\d{3}$/);
      expect(f.knowledge.find((r) => r.kind === "rule")!.review_status).toBe("draft_verify");
    }
    for (const u of b.urgent) {
      expect(u.element_ids.length).toBeGreaterThan(0);
      expect(u.threshold_ids.length + u.rule_ids.length).toBeGreaterThan(0);
      expect(u.source_ids.length).toBeGreaterThan(0);
    }
    for (const r of b.audit.knowledge_rows_used) expect(r.review_status).toBeTruthy();
  });

  it("evidence always carries value/unit/date (guide rule 5)", () => {
    for (const f of run(fixture("margaret")).ranked_findings) {
      for (const e of f.evidence) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      for (const e of f.evidence.filter((x) => typeof x.value === "number")) expect(e.unit).toBeTruthy();
    }
  });
});

describe("forbidden-phrase scan (no diagnoses, no stop/start/increase/decrease)", () => {
  it("the scanner itself catches the KB 'Must NOT say' examples and directive verbs", () => {
    for (const bad of ["Stop taking naproxen", "Your potassium is dangerous", "Take an extra diuretic dose", "increase your dose", "You have heart failure"]) {
      expect(forbiddenPhrases(bad), bad).not.toEqual([]);
    }
    expect(forbiddenPhrases("Is it safe with my heart failure, and is there a safer option?")).toEqual([]);
  });

  it.each(fixtureNames())("%s: no generated text contains forbidden wording", (name) => {
    const b = run(fixture(name));
    const texts = [
      ...b.urgent.flatMap((u) => [u.title, u.patient_message, u.clinician_note]),
      ...b.ranked_findings.flatMap((f) => [f.title, f.summary, f.patient_question, f.clinician_note]),
      ...b.domain_profile.flatMap((d) => [d.reason, d.trend_detail]),
      ...b.missing_data.flatMap((m) => [m.detail, m.suggested_patient_question ?? ""]),
    ];
    for (const t of texts) expect(forbiddenPhrases(t), t).toEqual([]);
    expect(b.audit.warnings.filter((w) => w.startsWith("Forbidden"))).toEqual([]);
  });

  it("every finding ends with a question", () => {
    for (const name of fixtureNames()) for (const f of run(fixture(name)).ranked_findings) expect(f.patient_question.trim()).toMatch(/\?$/);
  });
});

describe("timeline (6.1)", () => {
  const b = run(fixture("margaret"));

  it("is chronological and never contains events after as_of", () => {
    const at = b.timeline.events.map((e) => Date.parse(e.at.length === 10 ? `${e.at}T00:00:00Z` : e.at));
    expect(at).toEqual([...at].sort((x, y) => x - y));
    expect(Math.max(...at)).toBeLessThanOrEqual(Date.parse(AS_OF));
  });

  it("merges every category for Margaret", () => {
    const cats = new Set(b.timeline.events.map((e) => e.category));
    for (const c of ["medication_start", "medication_change", "lab", "weight", "blood_pressure", "heart_rate", "mood", "diet", "symptom", "missed_dose", "er_visit", "care_plan"]) {
      expect(cats, c).toContain(c);
    }
  });

  it("includes unconfirmed items, flagged as not used in analysis", () => {
    const e = b.timeline.events.find((x) => x.label.startsWith("Diphenhydramine"))!;
    expect(e).toMatchObject({ confirmed: false, used_in_analysis: false });
  });

  it("marks events that triggered a rule with its severity", () => {
    const k = b.timeline.events.find((x) => x.event_id === "p-margaret-k-2026-09-30")!;
    expect(k.severity).toBe("high");
    expect(k.rule_ids).toEqual(expect.arrayContaining(["R02", "R07"]));
  });

  it("produces daily series for charts", () => {
    const s = b.timeline.daily_series;
    expect(s.weight_kg.at(-1)).toEqual({ date: "2026-10-03", value: 73.5, n: 1 });
    expect(s.missed_doses.map((p) => p.date)).toEqual(["2026-09-29", "2026-10-01", "2026-10-02"]);
    expect(s.phq9_score.map((p) => p.value)).toEqual([7, 16]);
    expect(s.diet_risk_tags.find((p) => p.date === "2026-09-30")!.value).toBe(2);
  });
});
