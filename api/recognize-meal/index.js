// Azure Functions v3 loads this entry point as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleMealRecognition } = require("../shared/recognize-meal.cjs");

const attempts = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 12;
const DEFAULT_ORIGINS = ["https://app.parthiahealth.com", "https://gentle-meadow-0edc5790f.6.azurestaticapps.net"];

function allowedOrigin(req) {
  const origin = req.headers.origin;
  const configured = (process.env.MEAL_AI_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  return origin && [...DEFAULT_ORIGINS, ...configured].includes(origin);
}

function rateLimited(req) {
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

module.exports = async function (context, req) {
  try {
    if (!allowedOrigin(req)) {
      context.res = { status: 403, body: { error: "Meal recognition is only available from the Parthia app." } };
      return;
    }
    if (rateLimited(req)) {
      context.res = { status: 429, headers: { "Retry-After": "3600" }, body: { error: "Meal recognition limit reached. Please try again later." } };
      return;
    }
    const result = await handleMealRecognition(req.body);
    context.res = { status: result.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: result.body };
  } catch (error) {
    context.log.error(error);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: "Meal recognition failed unexpectedly." } };
  }
};
