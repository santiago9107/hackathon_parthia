import type { Medication, MedicationClass, RiskSeverity } from "../types";

/**
 * SAFETY ENGINE KNOWLEDGE TABLES
 *
 * Everything the rules "know" lives here as plain data so it can be read,
 * reviewed and edited by a clinician without touching rule logic.
 *
 * DEMO ONLY: these tables are deliberately small and simplified. They are
 * illustrative of how a curated interaction knowledge base would be wired
 * in, not a substitute for one (e.g. a licensed drug-interaction database).
 */

/** Classes we treat as psychotropic for the burden rule. */
export const PSYCHOTROPIC_CLASSES: ReadonlySet<MedicationClass> = new Set<MedicationClass>([
  "ssri",
  "snri",
  "tricyclic-antidepressant",
  "benzodiazepine",
  "z-drug",
  "antipsychotic",
]);

/**
 * Anticholinergic Cognitive Burden (ACB) scores, 1–3, by generic name.
 * Loosely based on the ACB scale (Boustani et al., 2008). Illustrative subset.
 */
export const ANTICHOLINERGIC_BURDEN: Readonly<Record<string, 1 | 2 | 3>> = {
  // Score 3 — definite anticholinergic activity
  oxybutynin: 3,
  tolterodine: 3,
  diphenhydramine: 3,
  hydroxyzine: 3,
  amitriptyline: 3,
  nortriptyline: 3,
  paroxetine: 3,
  olanzapine: 3,
  quetiapine: 3,
  // Score 2
  cyclobenzaprine: 2,
  carbamazepine: 2,
  // Score 1 — possible anticholinergic activity
  carvedilol: 1,
  metoprolol: 1,
  atenolol: 1,
  furosemide: 1,
  warfarin: 1,
  ranitidine: 1,
  loratadine: 1,
  alprazolam: 1,
  diazepam: 1,
};

/** Total ACB score at or above this is considered clinically significant. */
export const ACB_SIGNIFICANT_THRESHOLD = 3;

/** Number of active medications at which we flag polypharmacy burden. */
export const POLYPHARMACY_THRESHOLD = 10;

/**
 * Grapefruit sensitivity by statin. Grapefruit inhibits intestinal CYP3A4;
 * only statins metabolised mainly by CYP3A4 are meaningfully affected.
 */
export const GRAPEFRUIT_STATIN_SENSITIVITY: Readonly<Record<string, "high" | "moderate" | "minimal">> = {
  simvastatin: "high",
  lovastatin: "high",
  atorvastatin: "moderate",
  rosuvastatin: "minimal",
  pravastatin: "minimal",
  fluvastatin: "minimal",
  pitavastatin: "minimal",
};

export type MedMatcher =
  | { kind: "generic"; names: string[] }
  | { kind: "class"; classes: MedicationClass[] };

export function matches(med: Medication, matcher: MedMatcher): boolean {
  if (matcher.kind === "generic") return matcher.names.includes(med.genericName);
  return matcher.classes.includes(med.class);
}

export interface DrugDrugPair {
  id: string;
  a: MedMatcher;
  b: MedMatcher;
  severity: RiskSeverity;
  title: string;
  explanation: string;
  nextStep: string;
  /** Symptoms in the recent log that make this pair more concerning. */
  aggravatingSymptoms?: string[];
}

/** Illustrative pairwise drug-drug rules. */
export const DRUG_DRUG_PAIRS: readonly DrugDrugPair[] = [
  {
    id: "warfarin+antiplatelet",
    a: { kind: "generic", names: ["warfarin"] },
    b: { kind: "class", classes: ["antiplatelet", "nsaid"] },
    severity: "high",
    title: "Two medicines that both reduce clotting",
    explanation:
      "Warfarin thins the blood, and aspirin (or similar anti-platelet or anti-inflammatory medicines) also makes it harder for blood to clot. Taken together, the chance of bleeding or bruising goes up — especially when the INR is already above target.",
    nextStep:
      "Ask your doctor whether taking both is intended, and whether your INR target or check-in schedule should change now that both are on your list.",
    aggravatingSymptoms: ["bruising", "nosebleed", "bleeding"],
  },
  {
    id: "warfarin+amiodarone",
    a: { kind: "generic", names: ["warfarin"] },
    b: { kind: "generic", names: ["amiodarone"] },
    severity: "high",
    title: "Amiodarone can strengthen warfarin",
    explanation: "Amiodarone slows the breakdown of warfarin, so the same dose can have a stronger blood-thinning effect.",
    nextStep: "Ask your doctor whether your warfarin dose and INR checks should be adjusted while you take amiodarone.",
  },
  {
    id: "ace+potassium-sparing",
    a: { kind: "class", classes: ["ace-inhibitor", "arb"] },
    b: { kind: "class", classes: ["potassium-sparing-diuretic"] },
    severity: "moderate",
    title: "Two medicines that can raise potassium",
    explanation: "Both of these can push potassium up. High potassium can affect heart rhythm and is not something you can feel coming.",
    nextStep: "Ask your doctor how often your potassium should be checked while you take both.",
  },
  {
    id: "ssri+zdrug-sedation",
    a: { kind: "class", classes: ["ssri", "snri"] },
    b: { kind: "class", classes: ["z-drug", "benzodiazepine", "antihistamine"] },
    severity: "moderate",
    title: "Combination that can add up to drowsiness",
    explanation:
      "An antidepressant plus a sleep aid (and especially an over-the-counter antihistamine like diphenhydramine) can add up to more daytime drowsiness, unsteadiness and fogginess — which raises the chance of a fall.",
    nextStep: "Ask your doctor whether all of these are still needed together, and mention any fogginess, unsteadiness or falls.",
    aggravatingSymptoms: ["foggy", "dizziness", "fall", "drowsy"],
  },
  {
    id: "sulfonylurea+beta-blocker",
    a: { kind: "class", classes: ["sulfonylurea", "insulin"] },
    b: { kind: "class", classes: ["beta-blocker"] },
    severity: "low",
    title: "A beta-blocker can hide low blood sugar",
    explanation:
      "Beta-blockers can mask the racing heart and shakiness that normally warn you of low blood sugar, so a low may sneak up on you when you also take a medicine that lowers glucose.",
    nextStep: "Ask your doctor which warning signs of low blood sugar to watch for (sweating is usually still noticeable).",
  },
  {
    id: "multiple-bp-lowering+dizziness",
    a: { kind: "class", classes: ["ace-inhibitor", "arb", "diuretic"] },
    b: { kind: "class", classes: ["beta-blocker", "calcium-channel-blocker", "nitrate"] },
    severity: "low",
    title: "Several blood-pressure medicines with dizziness reported",
    explanation:
      "Taking more than one blood-pressure-lowering medicine is common and often intended, but dizziness on standing suggests the combined effect may be dropping your pressure more than needed at times.",
    nextStep: "Ask your doctor about checking your blood pressure standing as well as sitting, and whether timing or doses should change.",
    aggravatingSymptoms: ["dizziness"],
  },
];

/* ---- Patient Passport rules (vitals, allergies, screenings, kidneys) ------ */

/** Classes that lower blood pressure (as a main or side effect). */
export const BP_LOWERING_CLASSES: ReadonlySet<MedicationClass> = new Set<MedicationClass>([
  "ace-inhibitor",
  "arb",
  "diuretic",
  "potassium-sparing-diuretic",
  "beta-blocker",
  "calcium-channel-blocker",
  "nitrate",
]);

/** A reading counts as "low" below either of these (mmHg). */
export const LOW_BP_SYSTOLIC = 100;
export const LOW_BP_DIASTOLIC = 60;
/** How many low readings in the lookback window before we raise it. */
export const LOW_BP_MIN_READINGS = 3;
export const LOW_BP_LOOKBACK_DAYS = 14;
/** Any reading below this systolic makes the flag high severity. */
export const VERY_LOW_BP_SYSTOLIC = 90;

/** Resting heart rate below this (beats/min) counts as low. */
export const LOW_RESTING_HR = 50;
export const LOW_RESTING_HR_MIN_DAYS = 3;
export const LOW_RESTING_HR_LOOKBACK_DAYS = 14;
/** Below this, the flag is high severity. */
export const VERY_LOW_RESTING_HR = 45;

/** PHQ-9: a rise of this many points after a medication change is worth raising. */
export const PHQ9_MEANINGFUL_RISE = 5;
/** …or crossing into this band (Moderate) or higher. */
export const PHQ9_MODERATE = 10;
/** Latest score at or above this (Moderately severe) → high severity. */
export const PHQ9_HIGH = 15;
export const PHQ9_LOOKBACK_DAYS = 90;

/**
 * Medicines whose dose is usually reviewed when kidney function falls.
 * Illustrative subset (metformin labeling: reassess below eGFR 45, avoid
 * below 30; sulfonylureas accumulate; NSAIDs can worsen kidney function).
 */
export const RENAL_REVIEW: readonly { match: MedMatcher; note: string }[] = [
  { match: { kind: "generic", names: ["metformin"] }, note: "metformin is cleared by the kidneys; its dose is usually reviewed as eGFR falls, especially below 45" },
  { match: { kind: "generic", names: ["glipizide", "glyburide", "glimepiride"] }, note: "sulfonylureas can build up and cause low blood sugar when kidney function falls" },
  { match: { kind: "class", classes: ["nsaid"] }, note: "anti-inflammatory painkillers can reduce kidney function further" },
  { match: { kind: "generic", names: ["spironolactone"] }, note: "spironolactone can raise potassium more when kidney function falls" },
];
/** eGFR (mL/min) below which kidney function is reduced. */
export const EGFR_REDUCED = 60;
/** eGFR at or below which the flag is high severity. */
export const EGFR_HIGH_CONCERN = 45;
/** A fall of at least this many points, or this fraction, across results within a year. */
export const EGFR_DECLINE_POINTS = 5;
export const EGFR_DECLINE_FRACTION = 0.1;
export const EGFR_LOOKBACK_DAYS = 365;
