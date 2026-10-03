const TAGS = ["balanced", "high-vitamin-k", "grapefruit", "high-sodium", "high-sugar", "high-potassium", "alcohol", "caffeine"];
const MAX_IMAGE_DATA_URL = 500_000;

const schema = {
  type: "object",
  properties: {
    description: { type: "string" },
    suggestedMeal: { type: ["string", "null"], enum: ["breakfast", "lunch", "dinner", "snack", null] },
    portion: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string", enum: TAGS } },
    nutrients: {
      type: "object",
      properties: Object.fromEntries(["caloriesKcal", "proteinG", "carbohydratesG", "sodiumMg", "sugarG", "potassiumMg", "vitaminKMcg"].map((name) => [name, { type: ["number", "null"], minimum: 0 }])),
      required: ["caloriesKcal", "proteinG", "carbohydratesG", "sodiumMg", "sugarG", "potassiumMg", "vitaminKMcg"],
      additionalProperties: false,
    },
    possibleAllergens: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["description", "suggestedMeal", "portion", "ingredients", "tags", "nutrients", "possibleAllergens", "uncertainties", "confidence"],
  additionalProperties: false,
};

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function handleMealRecognition(body, env = process.env) {
  const imageDataUrl = body && body.imageDataUrl;
  if (typeof imageDataUrl !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageDataUrl)) {
    return { status: 400, body: { error: "Send a JPEG, PNG, or WebP meal photo." } };
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL) return { status: 413, body: { error: "The compact meal photo is too large to analyze." } };
  if (!env.OPENAI_API_KEY) return { status: 503, body: { error: "AI meal recognition is not configured. Add OPENAI_API_KEY to .env.local." } };

  const model = env.OPENAI_VISION_MODEL || "gpt-6-astra";
  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_output_tokens: 900,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Analyze this meal photo. Identify only visually plausible foods. Estimate the portion and nutrients for the entire pictured serving. Use null when a nutrient cannot be reasonably estimated. List possible allergens or hidden ingredients as possibilities, never as confirmed facts. Never claim the meal is allergen-free. Put ambiguity, unseen sauces, preparation method, and portion uncertainty in uncertainties. Choose tags only when supported by visible food. Keep the description concise and do not provide medical advice." },
          { type: "input_image", image_url: imageDataUrl, detail: "low" },
        ],
      }],
      text: { format: { type: "json_schema", name: "meal_photo_analysis", strict: true, schema } },
    }),
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("OpenAI meal recognition failed", apiResponse.status, detail.slice(0, 500));
    return { status: 502, body: { error: "The AI could not analyze this photo right now. Please try again." } };
  }
  const response = await apiResponse.json();
  const text = outputText(response);
  if (!text) return { status: 502, body: { error: "The AI did not return a meal estimate." } };
  try {
    return { status: 200, body: { analysis: JSON.parse(text), model } };
  } catch {
    return { status: 502, body: { error: "The AI returned an unreadable meal estimate." } };
  }
}

module.exports = { handleMealRecognition, schema };
