import type { MedicationClass } from "../types";

/**
 * LOCAL MEDICATION DICTIONARY
 *
 * A small, hand-curated table that maps generic and brand names to an RxNorm
 * ingredient concept (RxCUI) and our coarse `MedicationClass`. It is shared by
 * the seed data, the FHIR mapper, document-scan extraction and cross-source
 * reconciliation, so the same medicine is recognised the same way everywhere.
 *
 * DEMO ONLY: a production build would query RxNorm (RxNav) or a licensed drug
 * database instead. RxCUIs here are ingredient-level concepts.
 */
export interface DrugConcept {
  /** Lower-case generic (ingredient) name; the key used by the safety engine. */
  generic: string;
  /** Display name for the generic. */
  display: string;
  brands: string[];
  /** RxNorm ingredient RxCUI. */
  rxcui: string;
  class: MedicationClass;
  /** Units this medicine is usually prescribed in. */
  units: ("mg" | "mcg" | "g" | "units" | "mL" | "mEq")[];
}

export const DRUGS: readonly DrugConcept[] = [
  { generic: "warfarin", display: "Warfarin", brands: ["Coumadin", "Jantoven"], rxcui: "11289", class: "anticoagulant", units: ["mg"] },
  { generic: "apixaban", display: "Apixaban", brands: ["Eliquis"], rxcui: "1364430", class: "anticoagulant", units: ["mg"] },
  { generic: "aspirin", display: "Aspirin", brands: ["Bayer", "Ecotrin"], rxcui: "1191", class: "antiplatelet", units: ["mg"] },
  { generic: "clopidogrel", display: "Clopidogrel", brands: ["Plavix"], rxcui: "32968", class: "antiplatelet", units: ["mg"] },
  { generic: "naproxen", display: "Naproxen", brands: ["Aleve", "Naprosyn", "Anaprox"], rxcui: "7258", class: "nsaid", units: ["mg"] },
  { generic: "ibuprofen", display: "Ibuprofen", brands: ["Advil", "Motrin"], rxcui: "5640", class: "nsaid", units: ["mg"] },
  { generic: "atorvastatin", display: "Atorvastatin", brands: ["Lipitor"], rxcui: "83367", class: "statin", units: ["mg"] },
  { generic: "rosuvastatin", display: "Rosuvastatin", brands: ["Crestor"], rxcui: "301542", class: "statin", units: ["mg"] },
  { generic: "simvastatin", display: "Simvastatin", brands: ["Zocor"], rxcui: "36567", class: "statin", units: ["mg"] },
  { generic: "metoprolol", display: "Metoprolol", brands: ["Toprol XL", "Lopressor"], rxcui: "6918", class: "beta-blocker", units: ["mg"] },
  { generic: "carvedilol", display: "Carvedilol", brands: ["Coreg"], rxcui: "20352", class: "beta-blocker", units: ["mg"] },
  { generic: "lisinopril", display: "Lisinopril", brands: ["Zestril", "Prinivil"], rxcui: "29046", class: "ace-inhibitor", units: ["mg"] },
  { generic: "losartan", display: "Losartan", brands: ["Cozaar"], rxcui: "52175", class: "arb", units: ["mg"] },
  { generic: "amlodipine", display: "Amlodipine", brands: ["Norvasc"], rxcui: "17767", class: "calcium-channel-blocker", units: ["mg"] },
  { generic: "furosemide", display: "Furosemide", brands: ["Lasix"], rxcui: "4603", class: "diuretic", units: ["mg"] },
  { generic: "hydrochlorothiazide", display: "Hydrochlorothiazide", brands: ["Microzide", "HCTZ"], rxcui: "5487", class: "diuretic", units: ["mg"] },
  { generic: "spironolactone", display: "Spironolactone", brands: ["Aldactone"], rxcui: "9997", class: "potassium-sparing-diuretic", units: ["mg"] },
  { generic: "metformin", display: "Metformin", brands: ["Glucophage"], rxcui: "6809", class: "biguanide", units: ["mg"] },
  { generic: "glipizide", display: "Glipizide", brands: ["Glucotrol"], rxcui: "4821", class: "sulfonylurea", units: ["mg"] },
  { generic: "empagliflozin", display: "Empagliflozin", brands: ["Jardiance"], rxcui: "1545653", class: "sglt2-inhibitor", units: ["mg"] },
  { generic: "sitagliptin", display: "Sitagliptin", brands: ["Januvia"], rxcui: "593411", class: "dpp4-inhibitor", units: ["mg"] },
  { generic: "insulin glargine", display: "Insulin glargine", brands: ["Lantus", "Basaglar"], rxcui: "274783", class: "insulin", units: ["units"] },
  { generic: "sertraline", display: "Sertraline", brands: ["Zoloft"], rxcui: "36437", class: "ssri", units: ["mg"] },
  { generic: "escitalopram", display: "Escitalopram", brands: ["Lexapro"], rxcui: "321988", class: "ssri", units: ["mg"] },
  { generic: "duloxetine", display: "Duloxetine", brands: ["Cymbalta"], rxcui: "72625", class: "snri", units: ["mg"] },
  { generic: "zolpidem", display: "Zolpidem", brands: ["Ambien"], rxcui: "39993", class: "z-drug", units: ["mg"] },
  { generic: "lorazepam", display: "Lorazepam", brands: ["Ativan"], rxcui: "6470", class: "benzodiazepine", units: ["mg"] },
  { generic: "oxybutynin", display: "Oxybutynin", brands: ["Ditropan"], rxcui: "32675", class: "bladder-antimuscarinic", units: ["mg"] },
  { generic: "diphenhydramine", display: "Diphenhydramine", brands: ["Benadryl", "ZzzQuil"], rxcui: "3498", class: "antihistamine", units: ["mg"] },
  { generic: "omeprazole", display: "Omeprazole", brands: ["Prilosec"], rxcui: "7646", class: "proton-pump-inhibitor", units: ["mg"] },
  { generic: "levothyroxine", display: "Levothyroxine", brands: ["Synthroid", "Levoxyl"], rxcui: "10582", class: "thyroid", units: ["mcg"] },
  { generic: "amiodarone", display: "Amiodarone", brands: ["Pacerone"], rxcui: "703", class: "antiarrhythmic", units: ["mg"] },
  { generic: "amoxicillin", display: "Amoxicillin", brands: ["Amoxil"], rxcui: "723", class: "other", units: ["mg"] },
  { generic: "ciprofloxacin", display: "Ciprofloxacin", brands: ["Cipro"], rxcui: "2551", class: "other", units: ["mg"] },
  { generic: "penicillin", display: "Penicillin", brands: [], rxcui: "70618", class: "other", units: ["mg"] },
  { generic: "codeine", display: "Codeine", brands: [], rxcui: "2670", class: "opioid", units: ["mg"] },
  { generic: "acetaminophen", display: "Acetaminophen", brands: ["Tylenol"], rxcui: "161", class: "other", units: ["mg"] },
  { generic: "potassium chloride", display: "Potassium chloride", brands: ["Klor-Con", "K-Tab"], rxcui: "8591", class: "supplement", units: ["mEq", "mg"] },
  { generic: "cholecalciferol", display: "Vitamin D3 (cholecalciferol)", brands: ["Vitamin D3"], rxcui: "2418", class: "supplement", units: ["units", "mcg"] },
];

const byName = new Map<string, DrugConcept>();
const byRxcui = new Map<string, DrugConcept>();
for (const d of DRUGS) {
  byName.set(d.generic, d);
  byName.set(d.display.toLowerCase(), d);
  for (const b of d.brands) byName.set(b.toLowerCase(), d);
  byRxcui.set(d.rxcui, d);
}

/** Find a drug by generic or brand name (case-insensitive, first word also tried). */
export function lookupDrug(name: string): DrugConcept | undefined {
  const key = name.trim().toLowerCase();
  if (byName.has(key)) return byName.get(key);
  // "Metoprolol succinate ER" → "metoprolol"
  for (const word of key.split(/[\s,/()-]+/)) {
    if (byName.has(word)) return byName.get(word);
  }
  return undefined;
}

export function lookupRxcui(rxcui: string): DrugConcept | undefined {
  return byRxcui.get(rxcui);
}

/** Every name (generic + brand) we recognise, lower-case. Used by OCR matching. */
export function allDrugNames(): string[] {
  return [...byName.keys()];
}
