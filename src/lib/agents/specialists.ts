import type { Measure } from "@/lib/measures";
import type { RiskFlag } from "@/lib/types";

export type SpecialistId = "pharmacist" | "cardiology" | "nutrition" | "behavioral";
export interface Fact {
  id: string;
  ruleId: string;
  ingredients: string[];
  basisIds: string[];
  text: string;
  value?: number;
}
export interface SpecialistItem {
  id: string;
  specialist: SpecialistId;
  patientText: string;
  clinicianText: string;
  factIds: string[];
  ingredients: string[];
}
export interface SpecialistOutput { specialist: SpecialistId; items: SpecialistItem[]; }

export const ROUTING: Record<string, SpecialistId[]> = {
  "drug-drug": ["pharmacist"], "drug-allergy": ["pharmacist"], "drug-kidney": ["pharmacist"],
  "anticholinergic-burden": ["pharmacist"], "drug-mood": ["pharmacist", "behavioral"],
  "drug-vitals": ["cardiology"], "drug-nutrient": ["nutrition", "pharmacist"],
  "measure/weight-change-3d": ["cardiology"], "measure/bp-trend-14d": ["cardiology"],
  "measure/hr-trend-14d": ["cardiology"], "measure/potassium-trend": ["nutrition"],
  "measure/egfr-trend": ["pharmacist"], "measure/phq9-change": ["behavioral"],
};

export function factsFrom(flags: RiskFlag[], measures: Measure[]): Fact[] {
  const flagFacts = flags.map((flag) => ({ id: flag.id, ruleId: flag.category, ingredients: flag.medications, basisIds: flag.evidence, text: flag.explanation }));
  const measureFacts = measures.filter((measure) => measure.value !== null).map((measure) => ({
    id: measure.id, ruleId: `measure/${measure.id}`, ingredients: [], basisIds: measure.basis,
    text: `${measure.label}: ${measure.value} ${measure.unit}.`, value: measure.value ?? undefined,
  }));
  return [...flagFacts, ...measureFacts];
}

function specialistItem(specialist: SpecialistId, fact: Fact): SpecialistItem {
  return {
    id: `${specialist}:${fact.id}`, specialist, factIds: [fact.id], ingredients: fact.ingredients,
    patientText: `A record pattern is worth discussing with your care team: ${fact.text}`,
    clinicianText: `${fact.text} Review the cited evidence before deciding on next steps.`,
  };
}

export function routeFacts(facts: Fact[]): Map<SpecialistId, Fact[]> {
  const routed = new Map<SpecialistId, Fact[]>([["pharmacist", []], ["cardiology", []], ["nutrition", []], ["behavioral", []]]);
  for (const fact of facts) for (const specialist of ROUTING[fact.ruleId] ?? ROUTING[fact.ruleId.split("/")[0]] ?? []) routed.get(specialist)!.push(fact);
  return routed;
}

export function runSpecialist(specialist: SpecialistId, facts: Fact[]): SpecialistOutput {
  return { specialist, items: facts.map((fact) => specialistItem(specialist, fact)) };
}

export function runSpecialists(facts: Fact[]): SpecialistOutput[] {
  return [...routeFacts(facts)].map(([specialist, routed]) => runSpecialist(specialist, routed));
}
