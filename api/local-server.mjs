import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handleMealRecognition } = require("./shared/recognize-meal.cjs");
const headers = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, headers); return res.end(); }
  if (req.method !== "POST" || req.url !== "/api/recognize-meal") { res.writeHead(404, headers); return res.end(JSON.stringify({ error: "Not found." })); }
  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 600_000) throw new Error("Request too large");
    }
    const result = await handleMealRecognition(JSON.parse(raw || "{}"));
    res.writeHead(result.status, headers);
    res.end(JSON.stringify(result.body));
  } catch {
    res.writeHead(400, headers);
    res.end(JSON.stringify({ error: "The meal-analysis request was invalid." }));
  }
}).listen(7071, "127.0.0.1", () => console.log("Meal AI API: http://localhost:7071/api/recognize-meal"));
