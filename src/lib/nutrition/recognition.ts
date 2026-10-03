import type { NutritionInput } from "../log/entries";
import type { NutritionTag } from "../types";

export type RecognitionConfidence = "low" | "medium" | "high";

export interface MealRecognition {
  description: string;
  suggestedMeal: NutritionInput["meal"];
  portion: string;
  ingredients: string[];
  tags: NutritionTag[];
  nutrients: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbohydratesG: number | null;
    sodiumMg: number | null;
    sugarG: number | null;
    potassiumMg: number | null;
    vitaminKMcg: number | null;
  };
  possibleAllergens: string[];
  uncertainties: string[];
  confidence: RecognitionConfidence;
}

const VALID_TAGS = new Set<NutritionTag>([
  "balanced", "high-vitamin-k", "grapefruit", "high-sodium",
  "high-sugar", "high-potassium", "alcohol", "caffeine",
]);
const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function nutrient(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value * 10) / 10 : null;
}

export function parseMealRecognition(value: unknown): MealRecognition {
  if (!value || typeof value !== "object") throw new Error("The AI returned an unreadable meal estimate.");
  const item = value as Record<string, unknown>;
  const nutrients = item.nutrients && typeof item.nutrients === "object" ? item.nutrients as Record<string, unknown> : {};
  const description = typeof item.description === "string" ? item.description.trim() : "";
  if (!description) throw new Error("The AI could not identify a meal in this photo.");
  return {
    description,
    suggestedMeal: typeof item.suggestedMeal === "string" && VALID_MEALS.has(item.suggestedMeal) ? item.suggestedMeal as MealRecognition["suggestedMeal"] : null,
    portion: typeof item.portion === "string" ? item.portion.trim() : "",
    ingredients: strings(item.ingredients),
    tags: strings(item.tags).filter((tag): tag is NutritionTag => VALID_TAGS.has(tag as NutritionTag)),
    nutrients: {
      caloriesKcal: nutrient(nutrients.caloriesKcal),
      proteinG: nutrient(nutrients.proteinG),
      carbohydratesG: nutrient(nutrients.carbohydratesG),
      sodiumMg: nutrient(nutrients.sodiumMg),
      sugarG: nutrient(nutrients.sugarG),
      potassiumMg: nutrient(nutrients.potassiumMg),
      vitaminKMcg: nutrient(nutrients.vitaminKMcg),
    },
    possibleAllergens: strings(item.possibleAllergens),
    uncertainties: strings(item.uncertainties),
    confidence: item.confidence === "high" || item.confidence === "medium" ? item.confidence : "low",
  };
}

const field = (value: number | null) => value === null ? "" : String(value);

/** Apply suggestions without marking them confirmed; the patient must review them. */
export function applyMealRecognition(current: NutritionInput, result: MealRecognition): NutritionInput {
  return {
    ...current,
    meal: current.meal ?? result.suggestedMeal,
    description: result.description,
    portion: result.portion,
    ingredients: result.ingredients.join(", "),
    tags: result.tags,
    tagsConfirmed: false,
    caloriesKcal: field(result.nutrients.caloriesKcal),
    proteinG: field(result.nutrients.proteinG),
    carbohydratesG: field(result.nutrients.carbohydratesG),
    sodiumMg: field(result.nutrients.sodiumMg),
    sugarG: field(result.nutrients.sugarG),
    potassiumMg: field(result.nutrients.potassiumMg),
    vitaminKMcg: field(result.nutrients.vitaminKMcg),
  };
}

export async function recognizeMeal(imageDataUrl: string, signal?: AbortSignal): Promise<MealRecognition> {
  const endpoint = process.env.NEXT_PUBLIC_MEAL_RECOGNITION_ENDPOINT
    ?? (process.env.NODE_ENV === "development" ? "http://localhost:7071/api/recognize-meal" : "/api/recognize-meal");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
    signal,
  });
  const payload = await response.json().catch(() => ({})) as { analysis?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error || "Meal recognition is unavailable right now.");
  return parseMealRecognition(payload.analysis);
}
