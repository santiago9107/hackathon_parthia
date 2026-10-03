import { screenPhoton } from "../../src/lib/integrations/server";

interface RequestLike { method?: string; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }

const safeId = /^[A-Za-z0-9_-]{1,120}$/;

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const body = request.body as { patientId?: unknown; treatmentIds?: unknown } | undefined;
  if (!body || typeof body.patientId !== "string" || !safeId.test(body.patientId) || !Array.isArray(body.treatmentIds) || body.treatmentIds.length < 1 || body.treatmentIds.length > 5 || body.treatmentIds.some((id) => typeof id !== "string" || !safeId.test(id))) {
    return response.status(400).json({ error: "Invalid screening request" });
  }
  try {
    return response.status(200).json(await screenPhoton({ patientId: body.patientId, treatmentIds: body.treatmentIds as string[] }));
  } catch (error) {
    return response.status(503).json({ error: "Photon screening unavailable", detail: error instanceof Error ? error.message : "Unknown error" });
  }
}
