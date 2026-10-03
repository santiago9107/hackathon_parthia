import { computeMeasures } from "@/lib/measures";
import { evaluatePatient } from "@/lib/safetyEngine";
import type { PatientRecord } from "@/lib/types";
import { factsFrom, runSpecialists, type Fact, type SpecialistItem, type SpecialistOutput } from "./specialists";

export interface HandoffMessage { from: string; to: string; factIds: string[]; summary: string; }
export interface Orchestration { facts: Fact[]; outputs: SpecialistOutput[]; linked: SpecialistItem[]; messages: HandoffMessage[]; }

export function orchestrate(record: PatientRecord, now: Date): Orchestration {
  const facts = factsFrom(evaluatePatient(record, { now }), computeMeasures(record, now));
  const outputs = runSpecialists(facts);
  const linked: SpecialistItem[] = [];
  const messages: HandoffMessage[] = [];
  const all = outputs.flatMap((output) => output.items);
  const byIngredient = new Map<string, SpecialistItem[]>();
  const linkedKeys = new Set<string>();
  for (const item of all) for (const ingredient of item.ingredients) byIngredient.set(ingredient.toLowerCase(), [...(byIngredient.get(ingredient.toLowerCase()) ?? []), item]);
  for (const [ingredient, items] of byIngredient.entries()) {
    const distinct = [...new Map(items.map((item) => [item.specialist, item])).values()];
    if (distinct.length < 2) continue;
    const linkedKey = ingredient.toLowerCase();
    if (linkedKeys.has(linkedKey)) continue;
    linkedKeys.add(linkedKey);
    const factIds = distinct.flatMap((item) => item.factIds);
    const evidence = distinct.map((item) => item.clinicianText.split(/(?<=[.!?])\s+/)[0]).join(" ");
    const linkedItem: SpecialistItem = {
      id: `linked:${ingredient}`, specialist: "pharmacist", ingredients: [ingredient], factIds,
      patientText: `Several reviewers found related evidence about ${ingredient}. Your care team can review it together.`,
      clinicianText: `${ingredient}: ${evidence}`,
    };
    linked.push(linkedItem);
    messages.push({ from: distinct[0].specialist, to: distinct[1].specialist, factIds, summary: `Linked ${ingredient} across specialist reviews.` });
  }
  return { facts, outputs, linked, messages };
}
