import { photonToken } from "./token";

interface RequestLike { method?: string; body?: unknown }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void }

const SCREEN_QUERY = `query PrescriptionScreen($draftedPrescriptions: [DraftedPrescriptionInput!]!, $patientId: ID!) {
  prescriptionScreen(draftedPrescriptions: $draftedPrescriptions, patientId: $patientId) {
    alerts {
      description severity type
      involvedEntities {
        ... on PrescriptionScreeningAlertInvolvedAllergen { id name }
        ... on PrescriptionScreeningAlertInvolvedDraftedPrescription { id name }
        ... on PrescriptionScreeningAlertInvolvedExistingPrescription { id name }
      }
    }
  }
}`;

const safeId = /^[A-Za-z0-9_-]{1,120}$/;

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const body = request.body as { patientId?: unknown; treatmentIds?: unknown } | undefined;
  if (!body || typeof body.patientId !== "string" || !safeId.test(body.patientId) || !Array.isArray(body.treatmentIds) || body.treatmentIds.length < 1 || body.treatmentIds.length > 5 || body.treatmentIds.some((id) => typeof id !== "string" || !safeId.test(id))) {
    return response.status(400).json({ error: "Invalid screening request" });
  }
  const configured = new Set((process.env.PHOTON_ALLOWED_TREATMENT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!configured.size || body.treatmentIds.some((id) => !configured.has(id as string))) return response.status(422).json({ error: "Treatment is not in the demo allow-list" });
  try {
    const token = await photonToken();
    const upstream = await fetch(process.env.PHOTON_GRAPHQL_URL ?? "https://clinical-api.neutron.health/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "x-photon-auth-token": token, "x-photon-auth-token-type": "auth0" },
      body: JSON.stringify({ query: SCREEN_QUERY, variables: { patientId: body.patientId, draftedPrescriptions: body.treatmentIds.map((treatmentId) => ({ treatmentId })) } }),
    });
    const result = await upstream.json() as { data?: { prescriptionScreen?: { alerts?: unknown[] } }; errors?: unknown };
    if (!upstream.ok || result.errors) return response.status(502).json({ error: "Photon screening failed", detail: result.errors });
    return response.status(200).json({ source: "Photon Neutron sandbox", live: true, alerts: result.data?.prescriptionScreen?.alerts ?? [] });
  } catch (error) {
    return response.status(503).json({ error: "Photon screening unavailable", detail: error instanceof Error ? error.message : "Unknown error" });
  }
}
