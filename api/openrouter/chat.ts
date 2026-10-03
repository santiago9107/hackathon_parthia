import { askOpenRouter } from "../../src/lib/integrations/server";

interface RequestLike { method?: string; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const body = request.body as { question?: unknown; patientName?: unknown; evidence?: unknown } | undefined;
  if (!body || typeof body.question !== "string" || typeof body.patientName !== "string" || typeof body.evidence !== "string" || body.question.length > 600 || body.patientName.length > 120 || body.evidence.length > 12_000) {
    return response.status(400).json({ error: "Invalid grounded-agent request" });
  }
  try {
    const result = await askOpenRouter({ question: body.question, patientName: body.patientName, evidence: body.evidence });
    return response.status(200).json({ ...result, source: "OpenRouter" });
  } catch (error) {
    return response.status(503).json({ error: "Grounded model unavailable", detail: error instanceof Error ? error.message : "Unknown error" });
  }
}
