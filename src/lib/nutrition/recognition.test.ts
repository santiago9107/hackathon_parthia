import { describe, expect, it } from "vitest";
import type { NutritionInput } from "../log/entries";
import { applyMealRecognition, parseMealRecognition } from "./recognition";

const input: NutritionInput = {
  meal: null, description: "", tags: [], tagsConfirmed: false, portion: "", ingredients: "",
  caloriesKcal: "", proteinG: "", carbohydratesG: "", sodiumMg: "", sugarG: "", potassiumMg: "", vitaminKMcg: "",
  photoDataUrl: "data:image/jpeg;base64,YQ==",
};

describe("meal photo recognition", () => {
  it("normalizes model output and ignores unsupported safety tags", () => {
    const result = parseMealRecognition({
      description: "Chicken and spinach salad", suggestedMeal: "lunch", portion: "about 2 cups",
      ingredients: ["spinach", "chicken"], tags: ["balanced", "allergen-free"],
      nutrients: { caloriesKcal: 430.26, proteinG: 31, carbohydratesG: 18, sodiumMg: 640, sugarG: 5, potassiumMg: 780, vitaminKMcg: 145 },
      possibleAllergens: ["tree nuts"], uncertainties: ["dressing ingredients are not visible"], confidence: "medium",
    });
    expect(result.tags).toEqual(["balanced"]);
    expect(result.nutrients.caloriesKcal).toBe(430.3);
  });

  it("fills editable fields but never confirms AI suggestions", () => {
    const result = parseMealRecognition({
      description: "Oatmeal with berries", suggestedMeal: "breakfast", portion: "1 bowl",
      ingredients: ["oats", "berries"], tags: ["balanced"],
      nutrients: { caloriesKcal: 320, proteinG: 9, carbohydratesG: 55, sodiumMg: null, sugarG: 14, potassiumMg: 330, vitaminKMcg: null },
      possibleAllergens: [], uncertainties: [], confidence: "high",
    });
    const applied = applyMealRecognition({ ...input, tagsConfirmed: true }, result);
    expect(applied).toMatchObject({ meal: "breakfast", description: "Oatmeal with berries", ingredients: "oats, berries", caloriesKcal: "320", tagsConfirmed: false });
  });
});
