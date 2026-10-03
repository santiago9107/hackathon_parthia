import { computeMeasures } from "../../measures";
import { formatDate, makeFlag, type RuleDefinition } from "./types";

const WEIGHT_GAIN_KG = 1.36;
const AHA_WEIGHT_URL = "https://www.heart.org/en/health-topics/heart-failure/treatment-options-for-heart-failure/lifestyle-changes-for-heart-failure";
const AHA_WEIGHT_PASSAGE = "Notify your healthcare professional if you gain two to three pounds in one day for several days in a row, or five or more pounds in one week.";

/** A narrow, source-backed escalation for people with a heart-failure profile. */
export const heartFailureWeightGainRule: RuleDefinition = {
  id: "heart-failure/rapid-weight-gain",
  category: "drug-vitals",
  name: "Rapid weight gain with a heart-failure profile",
  description: "Flags a gain of at least 1.36 kg across the last three days so a care team can decide whether follow-up is needed.",
  evaluate(record, ctx) {
    if (!record.heartFailure) return [];
    const measure = computeMeasures(record, ctx.now).find((item) => item.id === "weight-change-3d");
    if (!measure || measure.value === null || measure.value < WEIGHT_GAIN_KG) return [];
    const latest = measure.window.to;
    return [makeFlag({
      patientId: record.patient.id,
      ruleId: this.id,
      category: "drug-vitals",
      severity: "moderate",
      title: "Recent weight gain needs a heart-failure review",
      medications: record.patient.medications.map((medication) => medication.name),
      explanation: `Your weight increased ${measure.value} kg over the last three days. In a heart-failure profile, that change is worth sharing with your care team rather than interpreting it alone.`,
      suggestedNextStep: "Could your care team review this weight trend and tell you whether any follow-up is needed?",
      evidence: [
        `Weight trend: +${measure.value} kg from ${measure.window.from} through ${formatDate(`${latest}T12:00:00`)}; readings ${measure.basis.join(", ")}.`,
        `Heart-failure profile: ${record.heartFailure.phenotype}${record.heartFailure.nyhaClass ? `, NYHA class ${record.heartFailure.nyhaClass}` : ""}.`,
        `American Heart Association guidance: “${AHA_WEIGHT_PASSAGE}”`,
        `Source: ${AHA_WEIGHT_URL}`,
      ],
    }, ctx)];
  },
};

export const heartFailureRules: RuleDefinition[] = [heartFailureWeightGainRule];
