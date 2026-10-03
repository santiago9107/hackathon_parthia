import { syncPhotonPatient } from "../../src/lib/integrations/server";
/** Only the method is read. No body, no query, no header is ever consulted. */
interface RequestLike { method?: string }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }
/**
 * Creates the synthetic demo patient in the Photon Neutron sandbox once, with
 * his allergies and medication history, and returns the same Photon patient id
 * on every later call. Credentials come from PHOTON_CLIENT_ID and
 * PHOTON_CLIENT_SECRET in the server environment and are never returned.
 *
 * Takes no caller-controlled input by design. The request body and query
 * string are ignored entirely: the patient, his externalId, his allergens and
 * his medication history all come from the committed catalog in
 * src/lib/clinician/photonTreatments.json, so a caller cannot choose who is
 * synced or what is attached to him. The worst an anonymous caller can do is
 * re-sync the one synthetic patient, which is idempotent and a no-op.
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
  try {
    return response.status(200).json(await syncPhotonPatient());
  } catch (error) {
    return response.status(503).json({ error: "Photon patient sync unavailable", detail: error instanceof Error ? error.message : "Unknown error" });
  }
}
