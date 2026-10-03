import { syncPhotonPatient } from "../../src/lib/integrations/server";
interface RequestLike { method?: string; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }
/**
 * Creates the synthetic demo patient in the Photon Neutron sandbox once, with
 * his allergies and medication history, and returns the same Photon patient id
 * on every later call. Credentials come from PHOTON_CLIENT_ID and
 * PHOTON_CLIENT_SECRET in the server environment and are never returned.
 *
 * The optional catalog patient id is allow-listed. The patient, externalId,
 * allergens and medication history all come from the committed catalog in
 * src/lib/clinician/photonTreatments.json, so a caller cannot choose arbitrary
 * records or medication ids.
 *
 * Unauthenticated by design for the demo. Its blast radius is that single
 * synthetic sandbox patient plus sandbox quota. It needs a caller credential
 * before it ever points at anything non-synthetic.
 *
 * Synthetic patient only. Nothing here prescribes.
 */
export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const patientId = (request.body as { patientId?: unknown } | undefined)?.patientId;
  if (patientId !== undefined && patientId !== "p-harold" && patientId !== "p-margaret") {
    return response.status(400).json({ error: "Unknown synthetic patient" });
  }
  try {
    return response.status(200).json(await syncPhotonPatient(patientId as "p-harold" | "p-margaret" | undefined));
  } catch (error) {
    return response.status(503).json({ error: "Photon patient sync unavailable", detail: error instanceof Error ? error.message : "Unknown error" });
  }
}
