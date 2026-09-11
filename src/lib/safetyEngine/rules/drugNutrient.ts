import type { NutritionEntry, RiskFlag } from "../../types";
import { GRAPEFRUIT_STATIN_SENSITIVITY } from "../knowledge";
import { dateOnly, formatDate, makeFlag, withinLastDays, type RuleDefinition } from "./types";

const LOOKBACK_DAYS = 28;

function daysWithTag(entries: NutritionEntry[], tag: NutritionEntry["tags"][number]): string[] {
  return [...new Set(entries.filter((e) => e.tags.includes(tag)).map((e) => dateOnly(e.timestamp)))].sort();
}

/**
 * RULE: Warfarin + variable / low vitamin K intake.
 *
 * Warfarin works against vitamin K. What matters is *consistency*: a diet
 * that swings between leafy-green-heavy and green-free weeks makes the INR
 * hard to keep in range. We look at the last 4 weeks of nutrition entries,
 * count the days with a high-vitamin-K meal per week, and flag when the
 * week-to-week spread is large, or when intake is consistently very low.
 */
export const warfarinVitaminKRule: RuleDefinition = {
  id: "drug-nutrient/warfarin-vitamin-k",
  category: "drug-nutrient",
  name: "Warfarin and vitamin K consistency",
  description:
    "If you take warfarin, checks whether your logged leafy-green (vitamin K) intake swings a lot from week to week, or is consistently very low.",
  evaluate(record, ctx) {
    const warfarin = record.patient.medications.find((m) => m.genericName === "warfarin");
    if (!warfarin) return [];

    const recent = withinLastDays(record.nutrition, LOOKBACK_DAYS, ctx.now);
    const loggedDays = new Set(recent.map((e) => dateOnly(e.timestamp)));
    if (loggedDays.size < 10) return []; // not enough data to say anything

    // Bucket high-vitamin-K days by week (0 = most recent week).
    const weekCounts = [0, 0, 0, 0];
    for (const day of daysWithTag(recent, "high-vitamin-k")) {
      const age = Math.floor((ctx.now.getTime() - new Date(`${day}T12:00:00`).getTime()) / 86_400_000);
      const week = Math.min(3, Math.floor(age / 7));
      weekCounts[week] += 1;
    }
    const max = Math.max(...weekCounts);
    const min = Math.min(...weekCounts);
    const total = weekCounts.reduce((a, b) => a + b, 0);

    const flags: RiskFlag[] = [];
    const inr = record.patient.labs.find((l) => l.name === "INR");
    const inrEvidence = inr ? `Most recent INR: ${inr.value} on ${formatDate(inr.date)} (target ${inr.referenceRange.low}–${inr.referenceRange.high}).` : null;

    if (max - min >= 3) {
      flags.push(
        makeFlag(
          {
            patientId: record.patient.id,
            ruleId: warfarinVitaminKRule.id,
            category: "drug-nutrient",
            severity: inr && inr.status === "abnormal" ? "high" : "moderate",
            title: "Leafy-green intake swings week to week while on warfarin",
            medications: [warfarin.name],
            explanation:
              "Warfarin works by blocking vitamin K, and leafy greens like kale, spinach and broccoli are rich in it. Eating a lot one week and almost none the next makes your INR harder to keep in range — some weeks the warfarin works too well, other weeks not enough. The goal is not to avoid greens, but to keep the amount steady.",
            suggestedNextStep:
              "Ask your doctor or anticoagulation clinic what a steady weekly amount of greens looks like for you, and whether your recent INR reading could be related to this.",
            evidence: [
              `High-vitamin-K days per week (most recent first): ${weekCounts.join(", ")}.`,
              `${total} of the last ${loggedDays.size} logged days included a high-vitamin-K meal.`,
              ...(inrEvidence ? [inrEvidence] : []),
            ],
          },
          ctx,
        ),
      );
    } else if (total <= 1) {
      flags.push(
        makeFlag(
          {
            patientId: record.patient.id,
            ruleId: warfarinVitaminKRule.id,
            category: "drug-nutrient",
            severity: "low",
            title: "Very little vitamin K logged while on warfarin",
            medications: [warfarin.name],
            explanation:
              "A diet very low in vitamin K can make warfarin's effect stronger and less predictable. Steady, moderate intake usually gives the most stable INR.",
            suggestedNextStep: "Ask your doctor whether your diet and warfarin dose are well matched.",
            evidence: [`Only ${total} high-vitamin-K meal(s) logged in the last ${LOOKBACK_DAYS} days.`],
          },
          ctx,
        ),
      );
    }
    return flags;
  },
};

/**
 * RULE: Statin + grapefruit in the nutrition log.
 *
 * Grapefruit blocks the gut enzyme (CYP3A4) that breaks down some statins,
 * so more of the drug reaches the bloodstream. Sensitivity differs by statin;
 * the knowledge table says which ones matter.
 */
export const statinGrapefruitRule: RuleDefinition = {
  id: "drug-nutrient/statin-grapefruit",
  category: "drug-nutrient",
  name: "Statin and grapefruit",
  description:
    "If you take a statin that is affected by grapefruit, checks whether grapefruit or grapefruit juice shows up in your nutrition log.",
  evaluate(record, ctx) {
    const statins = record.patient.medications.filter((m) => m.class === "statin");
    if (statins.length === 0) return [];
    const recent = withinLastDays(record.nutrition, LOOKBACK_DAYS, ctx.now);
    const grapefruitDays = daysWithTag(recent, "grapefruit");
    if (grapefruitDays.length === 0) return [];

    const flags: RiskFlag[] = [];
    for (const statin of statins) {
      const sensitivity = GRAPEFRUIT_STATIN_SENSITIVITY[statin.genericName] ?? "moderate";
      if (sensitivity === "minimal") continue;
      flags.push(
        makeFlag(
          {
            patientId: record.patient.id,
            ruleId: statinGrapefruitRule.id,
            category: "drug-nutrient",
            severity: sensitivity === "high" ? "high" : "moderate",
            title: `Grapefruit logged while taking ${statin.name}`,
            medications: [statin.name],
            explanation:
              `Grapefruit and grapefruit juice slow down the way your body clears ${statin.name.toLowerCase()}, so the same dose can build up to a higher level. That raises the chance of muscle aches and, rarely, muscle damage. ` +
              (sensitivity === "high"
                ? "This statin is one of the most affected."
                : "This statin is moderately affected — an occasional serving is a smaller concern than a daily habit."),
            suggestedNextStep:
              "Ask your doctor whether grapefruit is okay with your statin, or whether a different statin would fit your breakfast habits better.",
            evidence: [
              `Grapefruit logged on ${grapefruitDays.length} day(s) in the last ${LOOKBACK_DAYS} days: ${grapefruitDays.map(formatDate).join(", ")}.`,
              `${statin.name} sensitivity to grapefruit: ${sensitivity}.`,
            ],
          },
          ctx,
        ),
      );
    }
    return flags;
  },
};

/** RULE: ACE inhibitor / ARB + high-potassium foods or salt substitutes. */
export const aceInhibitorPotassiumRule: RuleDefinition = {
  id: "drug-nutrient/ace-potassium",
  category: "drug-nutrient",
  name: "Blood-pressure medicine and high-potassium foods",
  description:
    "If you take an ACE inhibitor or ARB, checks whether potassium-rich foods or salt substitutes appear often in your log.",
  evaluate(record, ctx) {
    const meds = record.patient.medications.filter((m) => m.class === "ace-inhibitor" || m.class === "arb");
    if (meds.length === 0) return [];
    const recent = withinLastDays(record.nutrition, LOOKBACK_DAYS, ctx.now);
    const days = daysWithTag(recent, "high-potassium");
    if (days.length < 3) return [];
    return [
      makeFlag(
        {
          patientId: record.patient.id,
          ruleId: aceInhibitorPotassiumRule.id,
          category: "drug-nutrient",
          severity: "low",
          title: "Potassium-rich foods logged with a potassium-raising medicine",
          medications: meds.map((m) => m.name),
          explanation:
            `${meds.map((m) => m.name).join(" and ")} can make your body hold on to potassium. Bananas, potatoes and especially "low-sodium" salt substitutes (which are mostly potassium) add to that. High potassium usually has no symptoms but can affect heart rhythm.`,
          suggestedNextStep:
            "Ask your doctor whether your potassium level should be checked, and whether salt substitutes are a good fit for you.",
          evidence: [`High-potassium items logged on ${days.length} day(s): ${days.map(formatDate).join(", ")}.`],
        },
        ctx,
      ),
    ];
  },
};

/** RULE: Metformin + alcohol logged. */
export const metforminAlcoholRule: RuleDefinition = {
  id: "drug-nutrient/metformin-alcohol",
  category: "drug-nutrient",
  name: "Metformin and alcohol",
  description: "If you take metformin, checks whether alcohol appears regularly in your nutrition log.",
  evaluate(record, ctx) {
    const metformin = record.patient.medications.find((m) => m.genericName === "metformin");
    if (!metformin) return [];
    const days = daysWithTag(withinLastDays(record.nutrition, LOOKBACK_DAYS, ctx.now), "alcohol");
    if (days.length < 2) return [];
    return [
      makeFlag(
        {
          patientId: record.patient.id,
          ruleId: metforminAlcoholRule.id,
          category: "drug-nutrient",
          severity: "low",
          title: "Alcohol logged while taking metformin",
          medications: [metformin.name],
          explanation:
            "Occasional alcohol is usually fine with metformin, but regular or heavy drinking raises the chance of low blood sugar and of a rare but serious build-up of lactic acid.",
          suggestedNextStep: "Ask your doctor what amount of alcohol is reasonable for you with metformin.",
          evidence: [`Alcohol logged on ${days.length} day(s): ${days.map(formatDate).join(", ")}.`],
        },
        ctx,
      ),
    ];
  },
};

export const drugNutrientRules: RuleDefinition[] = [
  warfarinVitaminKRule,
  statinGrapefruitRule,
  aceInhibitorPotassiumRule,
  metforminAlcoholRule,
];
