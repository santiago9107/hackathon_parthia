import { syncPhotonPatient } from "../../src/lib/integrations/server";
interface RequestLike { method?: string }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }
/**
 * Creates the synthetic demo patient in the Photon Neutron sandbox once, with
 * his allergies and medication history, and returns the same Photon patient id
 * on every later call. Credentials come from PHOTON_CLIENT_ID and
 * PHOTON_CLIENT_SECRET in the server environment and are never returned.
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
