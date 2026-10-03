import type { RiskFlag } from "../../types";
import {
  ACB_SIGNIFICANT_THRESHOLD,
  ANTICHOLINERGIC_BURDEN,
  POLYPHARMACY_THRESHOLD,
  PSYCHOTROPIC_CLASSES,
} from "../knowledge";
import { makeFlag, withinLastDays, type RuleDefinition } from "./types";

/**
 * RULE: Polypharmacy count.
 * Ten or more active medicines is a widely used threshold for "hyper-
 * polypharmacy", where the chance of interactions and side effects climbs.
 */
export const polypharmacyCountRule: RuleDefinition = {
  id: "burden/polypharmacy-count",
  category: "anticholinergic-burden",
  name: "Number of medicines",
  description: `Flags when the active medication list reaches ${POLYPHARMACY_THRESHOLD} or more.`,
  evaluate(record, ctx) {
    const n = record.patient.medications.length;
    if (n < POLYPHARMACY_THRESHOLD) return [];
    return [
      makeFlag(
        {
          patientId: record.patient.id,
          ruleId: polypharmacyCountRule.id,
          category: "anticholinergic-burden",
          severity: "moderate",
          title: `${n} medicines on the active list`,
          medications: record.patient.medications.map((m) => m.name),
          explanation:
            "Every medicine is there for a reason, but once the list gets this long the chance that two of them interact — or that one is no longer needed — goes up. A periodic review is the standard response.",
          suggestedNextStep: "Ask your doctor or pharmacist for a full medication review to see whether anything can be simplified.",
          evidence: [`${n} active medications (threshold: ${POLYPHARMACY_THRESHOLD}).`],
        },
        ctx,
      ),
    ];
  },
};

/**
 * RULE: Multiple psychotropics.
 * Two or more medicines that act on the brain (antidepressants, sleep aids,
 * antipsychotics, benzodiazepines) compound sedation and fall risk in older adults.
 */
export const multiplePsychotropicsRule: RuleDefinition = {
  id: "burden/multiple-psychotropics",
  category: "anticholinergic-burden",
  name: "Multiple psychotropic medicines",
  description: "Flags when two or more medicines that act on the brain (antidepressants, sleep aids, antipsychotics) are taken together.",
  evaluate(record, ctx) {
    const psychotropics = record.patient.medications.filter((m) => PSYCHOTROPIC_CLASSES.has(m.class));
    if (psychotropics.length < 2) return [];
    return [
      makeFlag(
        {
          patientId: record.patient.id,
          ruleId: multiplePsychotropicsRule.id,
          category: "anticholinergic-burden",
          severity: record.patient.age >= 65 ? "moderate" : "low",
          title: `${psychotropics.length} medicines that act on the brain`,
          medications: psychotropics.map((m) => m.name),
          explanation:
            `${psychotropics.map((m) => m.name).join(" and ")} each affect the brain. Together they can add up to more drowsiness, slower reactions and unsteadiness — and for adults over 65 that means a higher chance of a fall.`,
          suggestedNextStep: "Ask your doctor whether each of these is still needed, and whether the sleep aid in particular could be tapered.",
          evidence: psychotropics.map((m) => `${m.name} (${m.class.replace(/-/g, " ")}) since ${m.startDate}.`),
        },
        ctx,
      ),
    ];
  },
};

/**
 * RULE: Anticholinergic burden (ACB) score.
 * Sums the ACB score of every medicine on the list. A total of 3+ is
 * associated with confusion, dry mouth, constipation and falls in older adults.
 */
export const anticholinergicBurdenRule: RuleDefinition = {
  id: "burden/anticholinergic-score",
  category: "anticholinergic-burden",
  name: "Anticholinergic burden score",
  description: `Adds up the anticholinergic score (1–3) of each medicine. Flags a total of ${ACB_SIGNIFICANT_THRESHOLD} or more.`,
  evaluate(record, ctx) {
    const contributors = record.patient.medications
      .map((m) => ({ med: m, score: ANTICHOLINERGIC_BURDEN[m.genericName] ?? 0 }))
      .filter((c) => c.score > 0);
    const total = contributors.reduce((s, c) => s + c.score, 0);
    if (total < ACB_SIGNIFICANT_THRESHOLD) return [];

    // Symptoms that fit an anticholinergic picture strengthen the flag.
    const recentSymptoms = withinLastDays(record.symptoms, 14, ctx.now);
    const matching = recentSymptoms.filter((s) => /dry mouth|fogg|forget|confus|constipat|blurry/i.test(s.symptom));
    const strong = contributors.filter((c) => c.score === 3);

    const flags: RiskFlag[] = [
      makeFlag(
        {
          patientId: record.patient.id,
          ruleId: anticholinergicBurdenRule.id,
          category: "anticholinergic-burden",
          severity: total >= 5 || (total >= 3 && matching.length >= 3) ? "high" : "moderate",
          title: `Anticholinergic burden score of ${total}`,
          medications: contributors.map((c) => c.med.name),
          explanation:
            `Several of your medicines have "anticholinergic" effects — they block a chemical messenger the body uses for memory, saliva, digestion and bladder control. Each one alone is mild, but the effects add up. A total score of ${total} is in the range linked with dry mouth, fogginess, constipation and a higher risk of falls in older adults.` +
            (strong.length > 0 ? ` ${strong.map((c) => c.med.name).join(" and ")} contribute the most.` : ""),
          suggestedNextStep:
            "Ask your doctor or pharmacist whether any of the higher-scoring medicines have a gentler alternative — over-the-counter sleep aids like diphenhydramine are often the easiest to swap.",
          evidence: [
            ...contributors.map((c) => `${c.med.name}: score ${c.score}`),
            ...(matching.length > 0
              ? [`${matching.length} matching symptom entries in the last 14 days (${[...new Set(matching.map((s) => s.symptom))].join(", ")}).`]
              : []),
          ],
        },
        ctx,
      ),
    ];
    return flags;
  },
};

export const burdenRules: RuleDefinition[] = [
  polypharmacyCountRule,
  multiplePsychotropicsRule,
  anticholinergicBurdenRule,
];
