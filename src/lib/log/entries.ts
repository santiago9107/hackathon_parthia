import type {
  Allergy,
  DataSource,
  Medication,
  MedicationClass,
  MedicationEvent,
  NutrientEstimate,
  NutritionEntry,
  NutritionTag,
  PatientId,
} from "../types";
import { lookupDrug } from "../terminology/medications";
import { newId } from "../passport/ops";

/**
 * Builders and validation for things the patient enters themselves.
 * Pure functions — the forms call these, and the tests do too.
 */

export function youSource(now: Date = new Date()): DataSource {
  return { kind: "patient-entered", label: "Entered by you", importedAt: now.toISOString(), verified: true };
}

/* ---- Validation ---------------------------------------------------------- */

export type Errors<K extends string> = Partial<Record<K, string>>;

export function parseNumber(v: string): number | undefined {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export interface VitalsInput {
  systolic: string;
  diastolic: string;
  heartRate: string;
  weight: string;
  weightUnit: "kg" | "lb";
}

/** Plausibility limits — to catch typos, not to judge the reading. */
export function validateVitals(v: VitalsInput): Errors<keyof VitalsInput | "form"> {
  const e: Errors<keyof VitalsInput | "form"> = {};
  const sys = parseNumber(v.systolic);
  const dia = parseNumber(v.diastolic);
  const hr = parseNumber(v.heartRate);
  const wt = parseNumber(v.weight);
  if (sys === undefined && dia === undefined && hr === undefined && wt === undefined) e.form = "Enter at least one reading.";
  if ((sys === undefined) !== (dia === undefined)) {
    if (sys === undefined) e.systolic = "Enter the top number too.";
    else e.diastolic = "Enter the bottom number too.";
  }
  if (sys !== undefined && (sys < 60 || sys > 260)) e.systolic = "The top number is usually between 60 and 260.";
  if (dia !== undefined && (dia < 30 || dia > 160)) e.diastolic = "The bottom number is usually between 30 and 160.";
  if (sys !== undefined && dia !== undefined && dia >= sys) e.diastolic = "The bottom number should be lower than the top number.";
  if (hr !== undefined && (hr < 25 || hr > 250)) e.heartRate = "Heart rate is usually between 25 and 250 beats a minute.";
  if (wt !== undefined) {
    const kg = v.weightUnit === "lb" ? wt * 0.453592 : wt;
    if (kg < 20 || kg > 350) e.weight = "That weight looks unusual — please check the number and unit.";
  }
  return e;
}

export function toKg(weight: number, unit: "kg" | "lb"): number {
  return Math.round((unit === "lb" ? weight * 0.453592 : weight) * 10) / 10;
}

export interface MedicationInput {
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  startDate: string;
  indication: string;
  prescriber: string;
  status: "active" | "stopped";
  stoppedOn: string;
}

export function validateMedication(m: MedicationInput): Errors<keyof MedicationInput> {
  const e: Errors<keyof MedicationInput> = {};
  if (!m.name.trim()) e.name = "Enter the medicine's name.";
  const dose = parseNumber(m.dose);
  if (dose === undefined || dose <= 0) e.dose = "Enter the dose as a number, e.g. 20.";
  if (!m.frequency.trim()) e.frequency = "How often do you take it?";
  if (!m.startDate) e.startDate = "When did you start it? An approximate date is fine.";
  if (m.status === "stopped" && !m.stoppedOn) e.stoppedOn = "When did you stop it?";
  if (m.status === "stopped" && m.stoppedOn && m.startDate && m.stoppedOn < m.startDate) e.stoppedOn = "The stop date is before the start date.";
  return e;
}

/**
 * Build (or update) a medication from form input. Recognised names are
 * matched to the local dictionary so the safety engine understands them;
 * unknown names are kept as written with class "other".
 */
export function buildMedication(input: MedicationInput, existing?: Medication, now = new Date()): Medication {
  const drug = lookupDrug(input.name);
  const cls: MedicationClass = drug?.class ?? existing?.class ?? "other";
  return {
    ...(existing ?? {}),
    id: existing?.id ?? newId("m-you"),
    name: input.name.trim(),
    genericName: drug?.generic ?? input.name.trim().toLowerCase(),
    class: cls,
    rxNormCode: drug?.rxcui ?? existing?.rxNormCode,
    dose: `${parseNumber(input.dose)} ${input.unit}`.trim(),
    frequency: input.frequency.trim(),
    startDate: input.startDate,
    indication: input.indication.trim() || undefined,
    prescriber: input.prescriber.trim() || undefined,
    status: input.status,
    stoppedOn: input.status === "stopped" ? input.stoppedOn : undefined,
    source: existing && existing.source.kind !== "patient-entered" ? { ...youSource(now), label: `Edited by you (was: ${existing.source.label})` } : youSource(now),
  };
}

/** The medication-history event implied by an add or edit, if any. */
export function medicationChangeEvent(
  patientId: PatientId,
  before: Medication | undefined,
  after: Medication,
  date: string,
  now = new Date(),
): MedicationEvent | null {
  const base = { id: newId("e-you"), patientId, date, medicationName: after.name, source: youSource(now) };
  if (!before) {
    return after.status === "stopped" ? null : { ...base, type: "started", detail: `${after.name} ${after.dose} ${after.frequency} added by you.` };
  }
  if (before.status !== "stopped" && after.status === "stopped") {
    return { ...base, date: after.stoppedOn ?? date, type: "stopped", detail: `${after.name} stopped.` };
  }
  if (before.dose !== after.dose) {
    return { ...base, type: "dose-changed", detail: `${after.name} changed from ${before.dose} to ${after.dose}.` };
  }
  return null;
}

export interface AllergyInput {
  substance: string;
  category: Allergy["category"];
  reaction: string;
  severity: Allergy["severity"];
  type: "allergy" | "intolerance";
}

export function validateAllergy(a: AllergyInput): Errors<keyof AllergyInput> {
  return a.substance.trim() ? {} : { substance: "What are you allergic to?" };
}

/**
 * For medication allergies, work out which medicines it covers so the
 * safety engine can match it: the named drug, plus whole classes where the
 * patient names one (e.g. "NSAIDs", "penicillins").
 */
export function allergyMatches(substance: string): Allergy["matches"] {
  const s = substance.toLowerCase();
  const genericNames = new Set<string>();
  const classes = new Set<MedicationClass>();
  const drug = lookupDrug(substance);
  if (drug) genericNames.add(drug.generic);
  if (/nsaid|anti-?inflammator/.test(s) || drug?.class === "nsaid") classes.add("nsaid");
  if (/penicillin|amoxicillin/.test(s)) ["penicillin", "amoxicillin"].forEach((n) => genericNames.add(n));
  if (/statin/.test(s) && !drug) classes.add("statin");
  if (/sulfa/.test(s)) genericNames.add("sulfamethoxazole");
  return genericNames.size || classes.size ? { genericNames: [...genericNames], classes: [...classes] } : undefined;
}

export function buildAllergy(input: AllergyInput, patientId: PatientId, existing?: Allergy, now = new Date()): Allergy {
  const drug = input.category === "medication" ? lookupDrug(input.substance) : undefined;
  return {
    id: existing?.id ?? newId("al-you"),
    patientId,
    substance: input.substance.trim(),
    category: input.category,
    type: input.type,
    matches: input.category === "medication" ? allergyMatches(input.substance) : undefined,
    reaction: input.reaction.trim() || undefined,
    severity: input.severity,
    recordedOn: existing?.recordedOn ?? now.toISOString().slice(0, 10),
    code: drug?.rxcui ?? existing?.code,
    source: youSource(now),
  };
}

/* ---- Meals -------------------------------------------------------------- */

export interface NutritionInput {
  meal: NutritionEntry["meal"] | null;
  description: string;
  tags: NutritionTag[];
  tagsConfirmed: boolean;
  portion: string;
  ingredients: string;
  caloriesKcal: string;
  proteinG: string;
  carbohydratesG: string;
  sodiumMg: string;
  sugarG: string;
  potassiumMg: string;
  vitaminKMcg: string;
  photoDataUrl?: string;
}

type NutritionNumberKey = keyof NutrientEstimate;
export type NutritionErrors = Errors<"meal" | "description" | "confirmation" | "photoDataUrl" | NutritionNumberKey>;

const NUTRIENT_INPUTS: readonly [NutritionNumberKey, keyof NutritionInput][] = [
  ["caloriesKcal", "caloriesKcal"],
  ["proteinG", "proteinG"],
  ["carbohydratesG", "carbohydratesG"],
  ["sodiumMg", "sodiumMg"],
  ["sugarG", "sugarG"],
  ["potassiumMg", "potassiumMg"],
  ["vitaminKMcg", "vitaminKMcg"],
];

/** Data URLs are rendered back into the page, so allow only non-SVG image formats. */
export function isSafeMealPhotoDataUrl(value: string): boolean {
  return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(value);
}

export function validateNutrition(input: NutritionInput): NutritionErrors {
  const errors: NutritionErrors = {};
  if (!input.meal) errors.meal = "Which meal was it?";
  if (!input.description.trim()) errors.description = "What did you have? A few words is enough.";
  if (!input.tagsConfirmed) errors.confirmation = "Review the description and tags, then confirm them.";
  if (input.photoDataUrl && !isSafeMealPhotoDataUrl(input.photoDataUrl)) errors.photoDataUrl = "That photo could not be stored safely. Please choose it again.";

  for (const [nutrient, field] of NUTRIENT_INPUTS) {
    const raw = input[field] as string;
    if (!raw.trim()) continue;
    const value = parseNumber(raw);
    if (value === undefined || value < 0) errors[nutrient] = "Use zero or a positive number.";
  }
  return errors;
}

export function parseIngredientList(value: string): string[] | undefined {
  const seen = new Set<string>();
  const ingredients = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return ingredients.length ? ingredients : undefined;
}

export function buildNutritionEntry(
  input: NutritionInput,
  patientId: PatientId,
  timestamp: string,
  now = new Date(),
): NutritionEntry {
  if (!input.meal) throw new Error("A meal type is required.");
  const estimatedNutrients = Object.fromEntries(
    NUTRIENT_INPUTS.flatMap(([nutrient, field]) => {
      const value = parseNumber(input[field] as string);
      return value === undefined ? [] : [[nutrient, value]];
    }),
  ) as NutrientEstimate;
  return {
    id: newId("nu-you"),
    patientId,
    timestamp,
    meal: input.meal,
    description: input.description.trim(),
    tags: [...input.tags],
    portion: input.portion.trim() || undefined,
    ingredients: parseIngredientList(input.ingredients),
    estimatedNutrients: Object.keys(estimatedNutrients).length ? estimatedNutrients : undefined,
    photoDataUrl: input.photoDataUrl && isSafeMealPhotoDataUrl(input.photoDataUrl) ? input.photoDataUrl : undefined,
    source: youSource(now),
  };
}

/** US-style phone check: at least 7 digits. */
export function looksLikePhone(p: string): boolean {
  return (p.match(/\d/g) ?? []).length >= 7;
}
