import { validateNeutral } from "@/lib/patientAgent/neutral";
import type { Fact, SpecialistItem } from "./specialists";

export interface ReviewBlock { itemId: string; reason: string; }
export interface SafetyReview { passed: SpecialistItem[]; blocked: ReviewBlock[]; }

const DIAGNOSIS = /\b(?:you have|diagnosed with|diagnosis:)\b/i;
const INVENTED_NUMBER = /\b\d+(?:\.\d+)?\s*(?:mg|kg|mmhg|bpm|points|days|%)\b/i;

export function reviewSpecialistItems(items: SpecialistItem[], facts: Fact[]): SafetyReview {
  const known = new Set(facts.map((fact) => fact.id));
  const passed: SpecialistItem[] = [];
  const blocked: ReviewBlock[] = [];
  for (const item of items) {
    const missing = item.factIds.some((id) => !known.has(id));
    const neutralPatient = validateNeutral(item.patientText);
    const neutralClinician = validateNeutral(item.clinicianText);
    const diagnosis = DIAGNOSIS.test(`${item.patientText} ${item.clinicianText}`);
    const citedFacts = item.factIds.map((id) => facts.find((fact) => fact.id === id)).filter((fact): fact is Fact => !!fact);
    const numbers = [...`${item.patientText} ${item.clinicianText}`.matchAll(new RegExp(INVENTED_NUMBER.source, "gi"))]
      .some((match) => !citedFacts.some((fact) => fact.text.includes(match[0])));
    const reason = missing ? "unknown fact id" : neutralPatient || neutralClinician || (diagnosis ? "diagnosis wording" : numbers ? "number not present in cited facts" : null);
    if (reason) blocked.push({ itemId: item.id, reason }); else passed.push(item);
  }
  return { passed, blocked };
}
