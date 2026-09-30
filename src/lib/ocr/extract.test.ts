import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classify, extractDocument, findDose, findFrequency, levenshtein, linesFromText, parseDate } from "./extract";

/** Real Tesseract output for the synthetic samples (see scripts/ocr-sample-fixtures.mjs). */
const fixture = (name: string) => linesFromText(readFileSync(join(__dirname, "fixtures", `${name}.txt`), "utf8"), 92);

describe("helpers", () => {
  it("parses common date formats", () => {
    expect(parseDate("Date: 09/10/2026")).toBe("2026-09-10");
    expect(parseDate("on 2026-09-05")).toBe("2026-09-05");
    expect(parseDate("Sep 9, 2026")).toBe("2026-09-09");
    expect(parseDate("no date here")).toBeUndefined();
  });
  it("finds doses and normalises units", () => {
    expect(findDose("Naproxen 500 mg tablet")).toEqual({ dose: "500", unit: "mg" });
    expect(findDose("Vitamin D3 2000 units")).toEqual({ dose: "2000", unit: "units" });
    expect(findDose("Levothyroxine 75 mcg")).toEqual({ dose: "75", unit: "mcg" });
    expect(findDose("KCl 10 mEq")).toEqual({ dose: "10", unit: "mEq" });
  });
  it("reads directions into plain frequencies", () => {
    expect(findFrequency("Take 1 tablet by mouth twice daily with food for 10 days")).toBe("twice daily for 10 days");
    expect(findFrequency("1 tab PO BID")).toBe("twice daily");
    expect(findFrequency("take once daily, empty stomach")).toBe("once daily");
    expect(findFrequency("1 tab qhs")).toBe("at bedtime");
    expect(findFrequency("every 6 hours as needed for pain")).toBe("four times daily as needed");
  });
  it("levenshtein", () => {
    expect(levenshtein("naproxcn", "naproxen")).toBe(1);
  });
});

describe("urgent-care prescription (Harold, real OCR)", () => {
  const x = extractDocument(fixture("sample-prescription-harold"));

  it("classifies it and reads the header", () => {
    expect(x.documentType).toBe("prescription");
    expect(x.date).toBe("2026-09-10");
    expect(x.prescriber).toBe("Dr. Kevin Liu");
    expect(x.organization).toBe("Northside Urgent Care");
    expect(x.patientName).toBe("Harold Okafor");
  });

  it("extracts naproxen 500 mg twice daily with high confidence", () => {
    expect(x.medications).toHaveLength(1);
    const m = x.medications[0];
    expect(m).toMatchObject({ name: "Naproxen", dose: "500", unit: "mg", frequency: "twice daily for 10 days", indication: "back pain", issues: [] });
    expect(m.drug?.class).toBe("nsaid");
    expect(m.confidence).toBeGreaterThan(0.85);
    expect(x.labs).toEqual([]);
  });
});

describe("lab report (Margaret, real OCR)", () => {
  const x = extractDocument(fixture("sample-lab-report-margaret"));

  it("classifies it, reads the collection date and panel", () => {
    expect(x.documentType).toBe("lab-report");
    expect(x.date).toBe("2026-09-09");
    expect(x.patientName).toBe("Margaret Lindqvist");
    expect(x.panelName).toBe("Basic Metabolic Panel");
    expect(x.medications).toEqual([]);
  });

  it("extracts every value with units, ranges and flags", () => {
    const byName = Object.fromEntries(x.labs.map((l) => [l.name, l]));
    expect(Object.keys(byName).sort()).toEqual(["Creatinine", "Fasting glucose", "Potassium", "Sodium", "eGFR"]);
    expect(byName.Potassium).toMatchObject({ value: 3.3, unit: "mmol/L", range: { low: 3.5, high: 5.1 }, flag: "L", status: "borderline" });
    expect(byName.eGFR).toMatchObject({ value: 49, unit: "mL/min", range: { low: 60 }, flag: "L", status: "abnormal" });
    expect(byName["Fasting glucose"]).toMatchObject({ value: 162, status: "abnormal" });
  });

  it("copes with OCR squashing spaces (\"1.2 Hmg/dL0.5-1.0\")", () => {
    const creat = x.labs.find((l) => l.name === "Creatinine")!;
    expect(creat).toMatchObject({ value: 1.2, flag: "H", unit: "mg/dL", range: { low: 0.5, high: 1.0 } });
  });
});

describe("visit summary (Rosa, real OCR)", () => {
  const x = extractDocument(fixture("sample-visit-summary-rosa"));

  it("classifies it and lists the medications", () => {
    expect(x.documentType).toBe("visit-summary");
    expect(x.date).toBe("2026-09-05");
    expect(x.prescriber).toBe("Dr. Marcus Bell");
    expect(x.medications.map((m) => [m.name, `${m.dose} ${m.unit}`, m.frequency])).toEqual([
      ["Levothyroxine", "75 mcg", "once daily"],
      ["Vitamin D3", "2000 units", "once daily"],
      ["Lisinopril", "10 mg", "once daily"],
    ]);
  });

  it("doesn't read \"Vitamin D3 2000 units\" as a vitamin D lab result", () => {
    expect(x.labs.map((l) => l.name)).not.toContain("Vitamin D (25-OH)");
  });
});

describe("a poor scan (noisy OCR, low line confidence)", () => {
  const noisy = [
    { text: "SAMIPILIE — SYNTRIETIC — NOT A REAL DOGUMIENTT", confidence: 40 },
    { text: "After-Visit Summary", confidence: 90 },
    { text: "Levothyroxlne 75 mcg - take 1 tablet once dally, empty stomach", confidence: 70 },
    { text: "Wittarnin 138 2000 unils - lake once dally with food (now)", confidence: 45 },
    { text: "cGiFR AG | ml fmin = 60", confidence: 38 },
  ];
  const x = extractDocument(noisy);

  it("recovers a lightly misspelled drug but marks it for checking", () => {
    const levo = x.medications.find((m) => m.drug?.generic === "levothyroxine")!;
    expect(levo.issues[0]).toMatch(/check the spelling/);
    expect(levo.confidence).toBeLessThan(0.6);
  });

  it("does not invent items from unreadable lines", () => {
    expect(x.medications).toHaveLength(1);
    expect(x.labs).toHaveLength(0);
  });
});

it("classifies an unrelated document as other", () => {
  expect(classify("Grocery list\nMilk\nBread")).toBe("other");
});
