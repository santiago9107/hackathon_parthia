import type { DocumentType } from "../types";
import { DRUGS, type DrugConcept } from "../terminology/medications";
import { LABS, interpretLab, type LabConcept } from "../terminology/labs";

/**
 * DOCUMENT EXTRACTION
 *
 * Turns recognised text (from on-device OCR) into structured, reviewable rows:
 * medications with dose / unit / frequency, lab values with units and ranges,
 * plus the document's type, date, prescriber and organisation. Every row has
 * a confidence score and the original line, so the patient can check it.
 *
 * Pure functions over text — no OCR engine needed to test them.
 */

export interface OcrLine {
  text: string;
  /** Tesseract line confidence, 0–100. */
  confidence: number;
}

export interface ExtractedMedication {
  line: string;
  drug?: DrugConcept;
  /** The name as it should be saved (dictionary display name when matched). */
  name: string;
  dose?: string;
  unit?: string;
  frequency?: string;
  indication?: string;
  confidence: number;
  issues: string[];
}

export interface ExtractedLab {
  line: string;
  concept?: LabConcept;
  name: string;
  value: number;
  unit: string;
  range: { low?: number; high?: number };
  flag?: "H" | "L";
  status: "normal" | "borderline" | "abnormal";
  confidence: number;
  issues: string[];
}

export interface Extraction {
  documentType: Extract<DocumentType, "prescription" | "lab-report" | "visit-summary" | "other">;
  date?: string;
  prescriber?: string;
  organization?: string;
  patientName?: string;
  panelName?: string;
  medications: ExtractedMedication[];
  labs: ExtractedLab[];
  /** Mean OCR confidence 0–1. */
  textConfidence: number;
}

export function linesFromText(text: string, confidence = 90): OcrLine[] {
  return text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, confidence }));
}

/* ---- Helpers ------------------------------------------------------------- */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clamp = (n: number) => Math.max(0, Math.min(0.99, n));

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** Every recognisable drug name (generic, display, brands), longest first. */
const DRUG_NAMES: { name: string; drug: DrugConcept }[] = DRUGS.flatMap((d) =>
  [...new Set([d.generic, d.display.toLowerCase().replace(/\s*\(.*\)/, ""), ...d.brands.map((b) => b.toLowerCase())])].map((name) => ({ name, drug: d })),
).sort((a, b) => b.name.length - a.name.length);

const LAB_ALIASES: { alias: string; concept: LabConcept }[] = LABS.flatMap((l) => [l.name.toLowerCase(), ...l.aliases].map((alias) => ({ alias, concept: l }))).sort((a, b) => b.alias.length - a.alias.length);

const SKIP_LINE = /allerg|patient:|prescriber:|provider:|reason for visit|signature|npi\b|sample|synthetic|disp:|refills/i;

export function findDrug(line: string): { drug: DrugConcept; matched: string; index: number; exact: boolean } | null {
  const low = line.toLowerCase();
  for (const { name, drug } of DRUG_NAMES) {
    const m = new RegExp(`(^|[^a-z])${escape(name)}(?![a-z])`).exec(low);
    if (m) return { drug, matched: name, index: m.index + m[1].length, exact: true };
  }
  // Fuzzy: one or two OCR slips in a longer word ("Naproxcn", "Lisinoprll").
  const words = [...low.matchAll(/[a-z]{5,}/g)];
  for (const w of words) {
    for (const { name, drug } of DRUG_NAMES) {
      if (name.includes(" ") || Math.abs(name.length - w[0].length) > 2) continue;
      const dist = levenshtein(w[0], name);
      if (dist <= (name.length >= 8 ? 2 : 1)) return { drug, matched: w[0], index: w.index ?? 0, exact: false };
    }
  }
  return null;
}

const UNIT_MAP: Record<string, string> = { mg: "mg", mcg: "mcg", "µg": "mcg", ug: "mcg", g: "g", unit: "units", units: "units", iu: "units", ml: "mL", meq: "mEq" };

export function findDose(text: string): { dose: string; unit: string } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|units?|iu|ml|meq)\b/i.exec(text);
  return m ? { dose: m[1].replace(",", "."), unit: UNIT_MAP[m[2].toLowerCase()] ?? m[2] } : null;
}

const FREQUENCIES: [RegExp, string][] = [
  [/\b(twice (a )?daily|twice a day|two times (a|per) day|b\.?i\.?d\.?|every 12 hours)\b/i, "twice daily"],
  [/\b(three times (a )?daily|three times a day|t\.?i\.?d\.?|every 8 hours)\b/i, "three times daily"],
  [/\b(four times (a )?daily|four times a day|q\.?i\.?d\.?|every 6 hours)\b/i, "four times daily"],
  [/\b(at bedtime|q\.?h\.?s\.?|nightly)\b/i, "at bedtime"],
  [/\b(once (a )?daily|once a day|every day|daily|q\.?d\.?|every morning)\b/i, "once daily"],
  [/\b(once (a )?week|weekly)\b/i, "once weekly"],
];

export function findFrequency(text: string): string | null {
  for (const [re, label] of FREQUENCIES) {
    if (re.test(text)) {
      const prn = /\b(as needed|prn|p\.r\.n\.)\b/i.test(text) ? " as needed" : "";
      const days = /\bfor (\d+) days?\b/i.exec(text);
      return `${label}${prn}${days ? ` for ${days[1]} days` : ""}`;
    }
  }
  return /\b(as needed|prn)\b/i.test(text) ? "as needed" : null;
}

function findIndication(text: string): string | undefined {
  const m = /\bfor (?!\d+ days?)([a-z][a-z ]{2,40}?)(?:[.,;]|$)/i.exec(text);
  return m ? m[1].trim() : undefined;
}

/* ---- Header fields -------------------------------------------------------- */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(text: string): string | undefined {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(text);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /\b([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})\b/.exec(text);
  if (m && MONTHS.includes(m[1].toLowerCase())) return `${m[3]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return undefined;
}

function findDocDate(lines: string[]): string | undefined {
  const labelled = lines.find((l) => /\b(date|collected|written|issued|visit date|signed)\b/i.test(l) && parseDate(l) && !/\bdob\b\s*:?\s*[\d/]+$/i.test(l.split(/date|collected|written|issued/i).pop() ?? ""));
  if (labelled) {
    // Prefer the date right after the label ("Collected: 09/09/2026 Reported: …").
    const after = /(date|collected|written|issued|signed)\s*:?\s*(.+)$/i.exec(labelled);
    return (after && parseDate(after[2])) ?? parseDate(labelled);
  }
  return lines.map((l) => (/dob/i.test(l) ? undefined : parseDate(l))).find(Boolean);
}

function findPerson(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = /\b(prescriber|provider|ordering provider|physician|prescribed by)\s*:?\s*(.+)$/i.exec(l);
    if (m) return cleanName(m[2]);
  }
  const dr = lines.find((l) => /\bDr\.?\s+[A-Z]/.test(l) && !/patient/i.test(l));
  return dr ? cleanName(dr.slice(dr.search(/\bDr\.?\s/))) : undefined;
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").replace(/,?\s*(MD|DO|NP|PA-C|APRN|RN)\b.*$/i, "").replace(/^Dr\s/, "Dr. ").trim();
}

function findPatientName(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = /\b[Pp]atient\s*:?\s*([A-Z][A-Za-z'.-]+(?:\s[A-Z][A-Za-z'.-]+)+?)(?=\s+(?:DOB|Visit|Date|MRN|Age)\b|\s*$)/.exec(l);
    if (m) return m[1];
  }
  return undefined;
}

function findOrganization(lines: string[]): string | undefined {
  const heading = lines.find((l) => !/sample|synthetic|prescription\b|report$/i.test(l) && /^[A-Z][A-Z &'.-]{6,}$/.test(l) && l.split(" ").length >= 2);
  if (!heading) return undefined;
  return heading.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function classify(text: string): Extraction["documentType"] {
  const t = text.toLowerCase();
  const score = {
    prescription: (/\brx\b/.test(t) ? 3 : 0) + (/\bsig\s*:/.test(t) ? 3 : 0) + (/disp(ense)?\s*:?/.test(t) ? 2 : 0) + (/refills?/.test(t) ? 2 : 0) + (/prescription/.test(t) ? 2 : 0),
    "lab-report": (/reference range|ref\. range|normal range/.test(t) ? 3 : 0) + (/\bcollected\b/.test(t) ? 2 : 0) + (/laborator/.test(t) ? 2 : 0) + (/\bpanel\b/.test(t) ? 2 : 0) + (/\bresult/.test(t) ? 1 : 0),
    "visit-summary": (/visit summary|after-visit|after visit/.test(t) ? 3 : 0) + (/reason for visit|chief complaint/.test(t) ? 2 : 0) + (/follow-?up/.test(t) ? 1 : 0) + (/assessment|plan\b/.test(t) ? 1 : 0) + (/your medications/.test(t) ? 1 : 0),
  };
  const [best, s] = (Object.entries(score) as [keyof typeof score, number][]).sort((a, b) => b[1] - a[1])[0];
  return s >= 3 ? best : "other";
}

/* ---- Main ------------------------------------------------------------------ */

export function extractDocument(ocrLines: OcrLine[]): Extraction {
  const lines = ocrLines.map((l) => l.text);
  const text = lines.join("\n");
  const documentType = classify(text);
  const medications: ExtractedMedication[] = [];
  const labs: ExtractedLab[] = [];

  ocrLines.forEach((ol, i) => {
    const line = ol.text;
    const lineConf = Math.max(0.3, Math.min(1, ol.confidence / 100));

    // Lab values: a known test name at the start of the line, then a number.
    const low = line.toLowerCase();
    // The name must end at a word boundary: "Vitamin D3 2000 units" is a medicine, not a vitamin D result of 3.
    const lab = LAB_ALIASES.find(({ alias }) => new RegExp(`^[^a-z0-9]{0,3}${escape(alias)}(?![a-z0-9])`).test(low));
    if (lab) {
      const rest = line.slice(low.indexOf(lab.alias) + lab.alias.length);
      const v = /(-?\d+(?:\.\d+)?)\s*([HL])?(?![0-9.])/.exec(rest);
      if (v) {
        const value = Number(v[1]);
        const afterValue = rest.slice((v.index ?? 0) + v[0].length);
        const unitM = /(mmol\/L|mEq\/L|mg\/dL|mL\/min(?:\/1\.73\s?m2)?|g\/dL|pg\/mL|mIU\/L|ng\/mL|mg\/g|U\/L|%)/i.exec(afterValue);
        const rangeM = /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/.exec(afterValue) ;
        const gtM = /[>≥]\s*(\d+(?:\.\d+)?)/.exec(afterValue);
        const ltM = /[<≤]\s*(\d+(?:\.\d+)?)/.exec(afterValue);
        const range = rangeM ? { low: Number(rangeM[1]), high: Number(rangeM[2]) } : gtM ? { low: Number(gtM[1]) } : ltM ? { high: Number(ltM[1]) } : { ...lab.concept.range };
        const issues: string[] = [];
        const unit = unitM ? unitM[1].replace(/\/1\.73\s?m2/i, "") : lab.concept.unit;
        if (!unitM) issues.push("Unit not found — assumed the usual unit");
        if (!rangeM && !gtM && !ltM) issues.push("Reference range not found — using a typical range");
        if (unitM && lab.concept.unit && unit.toLowerCase() !== lab.concept.unit.toLowerCase()) issues.push(`Usual unit is ${lab.concept.unit}`);
        labs.push({
          line, concept: lab.concept, name: lab.concept.name, value, unit, range, flag: v[2] as "H" | "L" | undefined,
          status: interpretLab(value, range, lab.concept.borderlineMargin), confidence: clamp(lineConf * (unitM ? 1 : 0.85) * (rangeM || gtM || ltM ? 1 : 0.9)), issues,
        });
        return;
      }
    }

    // Medications: a recognised drug name on a line that isn't a header/allergy line.
    if (SKIP_LINE.test(line)) return;
    const found = findDrug(line);
    if (!found) return;
    const issues: string[] = [];
    if (!found.exact) issues.push(`Read as “${found.matched}” — check the spelling`);
    const tail = line.slice(found.index);
    // The directions often continue on the next line or two ("Sig: …").
    const next = ocrLines.slice(i + 1, i + 3).map((l) => l.text).filter((t) => !findDrug(t) || /^sig\b/i.test(t));
    const context = [tail, ...next].join(" ");
    const dose = findDose(tail) ?? findDose(context);
    const frequency = findFrequency(context);
    if (!dose) issues.push("Dose not found");
    if (!frequency) issues.push("How often not found");
    const indication = findIndication(next.join(" ")) ?? findIndication(tail.replace(/\bfor \d+ days?/i, ""));
    medications.push({
      line, drug: found.drug, name: found.drug.display.replace(/\s*\(.*\)/, ""), dose: dose?.dose, unit: dose?.unit, frequency: frequency ?? undefined, indication,
      confidence: clamp(lineConf * (found.exact ? 1 : 0.7) * (dose ? 1 : 0.7) * (frequency ? 1 : 0.85)), issues,
    });
  });

  const panelLine = lines.find((l) => /panel|profile|count\b/i.test(l) && !/reference/i.test(l));
  return {
    documentType,
    date: findDocDate(lines),
    prescriber: findPerson(lines),
    organization: findOrganization(lines),
    patientName: findPatientName(lines),
    panelName: panelLine ? panelLine.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : undefined,
    medications,
    labs,
    textConfidence: ocrLines.length ? ocrLines.reduce((s, l) => s + l.confidence, 0) / ocrLines.length / 100 : 0,
  };
}

export function confidenceLevel(c: number): "high" | "medium" | "low" {
  return c >= 0.8 ? "high" : c >= 0.6 ? "medium" : "low";
}
