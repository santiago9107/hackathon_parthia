import { screenPhoton } from "../../src/lib/integrations/server";
interface RequestLike { method?: string; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }
const safeId = /^[A-Za-z0-9_-]{1,120}$/;
/**
 * Read-only drug-drug and drug-allergy screen of drafted prescriptions.
 * `patientId` is optional: when it is absent the synthetic demo patient is
 * used. Treatment ids are checked again server-side against the screening
 * allow-list, so this never reaches the sandbox with an arbitrary drug.
 *
 * This endpoint cannot prescribe, change, stop or dose a medication.
 */
export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const body = request.body as { patientId?: unknown; treatmentIds?: unknown } | undefined;
  const patientId = body?.patientId;
  const treatmentIds = body?.treatmentIds;
  if (
    !body
    || (patientId !== undefined && (typeof patientId !== "string" || !safeId.test(patientId)))
    || !Array.isArray(treatmentIds)
    || treatmentIds.length < 1
    || treatmentIds.length > 5
    || treatmentIds.some((id) => typeof id !== "string" || !safeId.test(id))
  ) {
    return response.status(400).json({ error: "Invalid screening request" });
  }
  try {
    return response.status(200).json(await screenPhoton({
      patientId: typeof patientId === "string" ? patientId : undefined,
      treatmentIds: treatmentIds as string[],
    }));
  } catch (error) {
    return response.status(503).json({ error: "Photon screening unavailable", detail: error instanceof Error ? error.message : "Unknown error" });
  }
}
