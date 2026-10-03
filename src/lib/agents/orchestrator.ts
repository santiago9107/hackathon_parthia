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
  for (const item of all) for (const ingredient of item.ingredients) byIngredient.set(ingredient.toLowerCase(), [...(byIngredient.get(ingredient.toLowerCase()) ?? []), item]);
  for (const items of byIngredient.values()) {
    const distinct = [...new Map(items.map((item) => [item.specialist, item])).values()];
    if (distinct.length < 2) continue;
    const ingredients = distinct[0].ingredients.filter((ingredient) => distinct.every((item) => item.ingredients.map((x) => x.toLowerCase()).includes(ingredient.toLowerCase())));
    const factIds = distinct.flatMap((item) => item.factIds);
    const linkedItem: SpecialistItem = {
      id: `linked:${ingredients.join("+")}`, specialist: "pharmacist", ingredients, factIds,
      patientText: `Several reviewers found related evidence about ${ingredients.join(" and ")}. Your care team can review it together.`,
      clinicianText: `${ingredients.join(" and ")}: related findings were linked across ${distinct.map((item) => item.specialist).join(" and ")}.`,
    };
    linked.push(linkedItem);
    messages.push({ from: distinct[0].specialist, to: distinct[1].specialist, factIds, summary: `Linked ${ingredients.join(" and ")} across specialist reviews.` });
  }
  return { facts, outputs, linked, messages };
}
