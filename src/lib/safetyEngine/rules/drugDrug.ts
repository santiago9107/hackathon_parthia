import type { RiskFlag } from "../../types";
import { DRUG_DRUG_PAIRS, matches } from "../knowledge";
import { makeFlag, withinLastDays, type RuleDefinition } from "./types";

/**
 * RULE: Pairwise drug-drug interactions from the knowledge table.
 * Some pairs only fire (or fire harder) when matching symptoms were logged
 * in the last two weeks — see `aggravatingSymptoms` in the knowledge table.
 */
export const drugDrugPairsRule: RuleDefinition = {
  id: "drug-drug/known-pairs",
  category: "drug-drug",
  name: "Known medicine-to-medicine interactions",
  description: "Checks every pair of medicines on your list against a curated table of interactions, and looks for matching symptoms in your log.",
  evaluate(record, ctx) {
    const flags: RiskFlag[] = [];
    const meds = record.patient.medications;
    const recentSymptoms = withinLastDays(record.symptoms, 14, ctx.now);

    for (const pair of DRUG_DRUG_PAIRS) {
      const as = meds.filter((m) => matches(m, pair.a));
      const bs = meds.filter((m) => matches(m, pair.b) && !as.includes(m));
      if (as.length === 0 || bs.length === 0) continue;

      const symptomHits = pair.aggravatingSymptoms
        ? recentSymptoms.filter((s) => pair.aggravatingSymptoms!.some((k) => s.symptom.toLowerCase().includes(k)))
        : [];

      // Symptom-gated pairs (low severity ones) only fire when symptoms are present.
      if (pair.severity === "low" && pair.aggravatingSymptoms && symptomHits.length === 0) continue;

      const involved = [...as, ...bs].map((m) => m.name);
      const evidence = [
        `On the list: ${involved.join(", ")}.`,
        ...(symptomHits.length > 0
          ? [`${symptomHits.length} related symptom entries in the last 14 days (${[...new Set(symptomHits.map((s) => s.symptom))].join(", ")}).`]
          : []),
      ];
      flags.push(
        makeFlag(
          {
            patientId: record.patient.id,
            ruleId: `${drugDrugPairsRule.id}/${pair.id}`,
            category: "drug-drug",
            severity: pair.severity,
            title: pair.title,
            medications: involved,
            explanation: pair.explanation,
            suggestedNextStep: pair.nextStep,
            evidence,
          },
          ctx,
        ),
      );
    }
    return flags;
  },
};

export const drugDrugRules: RuleDefinition[] = [drugDrugPairsRule];
