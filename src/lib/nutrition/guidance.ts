import type { PatientRecord } from "../types";

export interface FoodGuidance {
  id: string;
  kind: "consider" | "caution";
  title: string;
  detail: string;
  basis: string;
}

/**
 * Conservative, inspectable food guidance from confirmed Passport facts.
 * This intentionally avoids calorie targets, treatment claims, supplements,
 * and individualized restrictions that require a clinician or dietitian.
 */
export function buildFoodGuidance(record: PatientRecord): FoodGuidance[] {
  const conditions = record.patient.conditions.filter((condition) => condition.source.verified && condition.clinicalStatus !== "resolved");
  const medications = record.patient.medications.filter((medication) => medication.source.verified && (medication.status ?? "active") === "active");
  const foodAllergies = record.allergies.filter((allergy) => allergy.source.verified && allergy.category === "food");
  const categories = new Set(conditions.map((condition) => condition.category));
  const generics = new Set(medications.map((medication) => medication.genericName));
  const guidance: FoodGuidance[] = [];

  if (categories.has("hypertension") || categories.has("cardiovascular")) {
    guidance.push({
      id: "heart-pattern",
      kind: "consider",
      title: "Build meals from minimally processed foods",
      detail: "Vegetables, fruit, whole grains, beans, unsalted nuts, fish or poultry are practical starting points. Compare labels and choose lower-sodium versions when you can.",
      basis: "Your Passport includes a heart or blood-pressure condition.",
    });
  }

  if (categories.has("diabetes")) {
    guidance.push({
      id: "diabetes-pattern",
      kind: "consider",
      title: "Pair higher-fiber foods with protein",
      detail: "Try vegetables, beans or lentils, whole grains and whole fruit alongside a protein food. Log the portion and any glucose response you already monitor.",
      basis: "Your Passport includes diabetes or prediabetes.",
    });
  }

  if (!guidance.some((item) => item.kind === "consider")) {
    guidance.push({
      id: "balanced-pattern",
      kind: "consider",
      title: "Aim for variety across mostly whole foods",
      detail: "Vegetables, fruit, whole grains and a protein food are a useful flexible pattern. Fit choices to your culture, budget and care plan.",
      basis: "General food guidance; no condition-specific eating pattern is confirmed yet.",
    });
  }

  if (generics.has("warfarin")) {
    guidance.push({
      id: "warfarin-vitamin-k",
      kind: "caution",
      title: "Keep vitamin K foods consistent — do not automatically avoid greens",
      detail: "Large changes in leafy greens or vitamin K supplements can change how warfarin works. Ask your anticoagulation team what a steady amount looks like for you.",
      basis: "Warfarin is on your confirmed medication list.",
    });
  }

  if ([...generics].some((name) => name === "simvastatin" || name === "atorvastatin" || name === "lovastatin")) {
    guidance.push({
      id: "statin-grapefruit",
      kind: "caution",
      title: "Check grapefruit with your pharmacist",
      detail: "Some statins are affected more than others. Confirm whether grapefruit or grapefruit juice fits your exact medicine before making it routine.",
      basis: "A grapefruit-sensitive statin may be on your confirmed list.",
    });
  }

  if ([...generics].some((name) => name === "lisinopril" || name === "losartan" || name === "spironolactone")) {
    guidance.push({
      id: "potassium-products",
      kind: "caution",
      title: "Ask before using potassium salt substitutes or supplements",
      detail: "Your medicine can affect potassium. Ordinary foods may still fit, but concentrated products and supplements need context from kidney labs and your care team.",
      basis: "A potassium-affecting medicine is on your confirmed list.",
    });
  }

  if (foodAllergies.length > 0) {
    guidance.push({
      id: "allergy-labels",
      kind: "caution",
      title: "Verify labels and preparation for recorded allergies",
      detail: `Your confirmed food-allergy list includes ${foodAllergies.map((allergy) => allergy.substance).join(", ")}. A photo cannot establish ingredients or cross-contact.`,
      basis: `${foodAllergies.length} confirmed food ${foodAllergies.length === 1 ? "allergy or intolerance" : "allergies or intolerances"} in your Passport.`,
    });
  }

  return guidance;
}
