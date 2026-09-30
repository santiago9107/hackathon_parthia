/**
 * LOCAL LAB DICTIONARY
 *
 * Maps common lab tests to a LOINC code, a canonical display name, unit and
 * reference range, so the same test from different sources (seed data, an EHR
 * import, a scanned lab report) lines up in one trend.
 *
 * DEMO ONLY: reference ranges are typical adult ranges and vary by lab.
 */
export interface LabConcept {
  loinc: string;
  name: string;
  /** Other names the test appears under on reports. */
  aliases: string[];
  unit: string;
  range: { low?: number; high?: number };
  /** Values within this fraction outside the range are "borderline". */
  borderlineMargin?: number;
}

export const LABS: readonly LabConcept[] = [
  { loinc: "6301-6", name: "INR", aliases: ["inr", "international normalized ratio", "pt/inr", "prothrombin time inr"], unit: "", range: { low: 2.0, high: 3.0 } },
  { loinc: "4548-4", name: "HbA1c", aliases: ["hba1c", "a1c", "hemoglobin a1c", "glycated hemoglobin", "hgb a1c"], unit: "%", range: { high: 7.0 }, borderlineMargin: 0.03 },
  { loinc: "13457-7", name: "LDL cholesterol", aliases: ["ldl", "ldl cholesterol", "ldl-c", "ldl calculated"], unit: "mg/dL", range: { high: 100 } },
  { loinc: "98979-8", name: "eGFR", aliases: ["egfr", "estimated gfr", "gfr estimated", "egfr ckd-epi"], unit: "mL/min", range: { low: 60 } },
  { loinc: "2823-3", name: "Potassium", aliases: ["potassium", "k", "k+"], unit: "mmol/L", range: { low: 3.5, high: 5.1 } },
  { loinc: "2951-2", name: "Sodium", aliases: ["sodium", "na", "na+"], unit: "mmol/L", range: { low: 135, high: 145 } },
  { loinc: "33762-6", name: "NT-proBNP", aliases: ["nt-probnp", "nt probnp", "pro-bnp"], unit: "pg/mL", range: { high: 300 } },
  { loinc: "1558-6", name: "Fasting glucose", aliases: ["fasting glucose", "glucose fasting", "glucose, fasting"], unit: "mg/dL", range: { low: 70, high: 100 } },
  { loinc: "3016-3", name: "TSH", aliases: ["tsh", "thyroid stimulating hormone"], unit: "mIU/L", range: { low: 0.4, high: 4.0 } },
  { loinc: "2160-0", name: "Creatinine", aliases: ["creatinine", "creat", "serum creatinine"], unit: "mg/dL", range: { low: 0.6, high: 1.3 } },
  { loinc: "2093-3", name: "Total cholesterol", aliases: ["total cholesterol", "cholesterol, total", "cholesterol"], unit: "mg/dL", range: { high: 200 } },
  { loinc: "718-7", name: "Hemoglobin", aliases: ["hemoglobin", "hgb", "hb"], unit: "g/dL", range: { low: 12.0, high: 17.5 } },
];

const byAlias = new Map<string, LabConcept>();
const byLoinc = new Map<string, LabConcept>();
for (const l of LABS) {
  byLoinc.set(l.loinc, l);
  byAlias.set(l.name.toLowerCase(), l);
  for (const a of l.aliases) byAlias.set(a, l);
}

export function lookupLab(nameOrLoinc: string): LabConcept | undefined {
  const key = nameOrLoinc.trim().toLowerCase();
  return byLoinc.get(nameOrLoinc.trim()) ?? byAlias.get(key);
}

export function allLabAliases(): string[] {
  return [...byAlias.keys()];
}

/** normal / borderline / abnormal against the concept's range. */
export function interpretLab(value: number, range: { low?: number; high?: number }, margin = 0.1): "normal" | "borderline" | "abnormal" {
  const { low, high } = range;
  if (low !== undefined && value < low) return value >= low * (1 - margin) ? "borderline" : "abnormal";
  if (high !== undefined && value > high) return value <= high * (1 + margin) ? "borderline" : "abnormal";
  return "normal";
}
