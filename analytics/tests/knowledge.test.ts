import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import { checkKnowledge, loadKnowledge } from "../src/knowledge/index";

const dir = (p: string) => new URL(`../knowledge/${p}`, import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(dir(p), "utf-8"));

describe("knowledge export", () => {
  const files = readdirSync(dir("json")).filter((f) => f.endsWith(".json"));

  it("exports one JSON file per sheet plus a manifest", () => {
    expect(files.sort()).toEqual([
      "data_dictionary.json", "dictionary_guide.json", "domain_tracker.json", "how_to_use.json", "lists.json",
      "manifest.json", "recommendation_cards.json", "rules.json", "source_register.json", "test_cases.json", "thresholds.json",
    ]);
  });

  it.each(files)("%s validates against its JSON Schema", (f) => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(read(`schemas/${f.replace(".json", ".schema.json")}`));
    expect(validate(read(`json/${f}`)), JSON.stringify(validate.errors)).toBe(true);
  });

  it("every file carries the same knowledge_version", () => {
    const versions = new Set(files.map((f) => read(`json/${f}`).knowledge_version));
    expect(versions.size).toBe(1);
    expect(loadKnowledge().version).toBe([...versions][0]);
  });

  it("covers D001-D020, T01-T12, R01-R22, TC01-TC06", () => {
    const k = loadKnowledge();
    expect([...k.dictionary.keys()]).toEqual(Array.from({ length: 20 }, (_, i) => `D${String(i + 1).padStart(3, "0")}`));
    expect([...k.thresholds.keys()]).toEqual(Array.from({ length: 12 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`));
    expect([...k.rules.keys()]).toEqual(Array.from({ length: 22 }, (_, i) => `R${String(i + 1).padStart(2, "0")}`));
    expect(k.testCases.map((t) => t.test_id)).toEqual(["TC01", "TC02", "TC03", "TC04", "TC05", "TC06"]);
  });

  it("overrides are consistent with the KB (every rule has parameters, every reference resolves)", () => {
    expect(checkKnowledge(loadKnowledge())).toEqual([]);
  });

  it("every decision referenced in overrides is logged in DECISIONS.md", () => {
    const md = readFileSync(dir("DECISIONS.md"), "utf-8");
    for (const d of loadKnowledge().overrides.decisions) expect(md).toContain(d.id);
  });

  it("every ambiguity referenced in overrides/config is logged in AMBIGUITIES.md", () => {
    const md = readFileSync(dir("AMBIGUITIES.md"), "utf-8");
    const text = readFileSync(dir("overrides.json"), "utf-8") + readdirSync(new URL("../config/", import.meta.url)).map((f) => readFileSync(new URL(`../config/${f}`, import.meta.url), "utf-8")).join("");
    for (const id of new Set(text.match(/AMB-\d{2}/g))) expect(md).toContain(id);
  });
});
