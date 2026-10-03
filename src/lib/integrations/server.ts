export interface PhotonScreenInput {
  patientId: string;
  treatmentIds: string[];
}

export interface GroundedAgentInput {
  question: string;
  patientName: string;
  evidence: string;
}

let photonTokenCache: { value: string; expiresAt: number } | null = null;

async function photonToken(): Promise<string> {
  if (photonTokenCache && photonTokenCache.expiresAt > Date.now() + 60_000) return photonTokenCache.value;
  const clientId = process.env.PHOTON_CLIENT_ID;
  const clientSecret = process.env.PHOTON_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Photon sandbox credentials are not configured");
  const response = await fetch(process.env.PHOTON_AUTH_URL ?? "https://auth.neutron.health/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: process.env.PHOTON_AUDIENCE ?? "https://api.neutron.health",
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) throw new Error(`Photon token request failed (${response.status})`);
  const json = await response.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Photon token response did not include an access token");
  photonTokenCache = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

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

export async function screenPhoton(input: PhotonScreenInput) {
  const allowed = new Set((process.env.PHOTON_ALLOWED_TREATMENT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!allowed.size || input.treatmentIds.some((id) => !allowed.has(id))) {
    throw new Error("Requested treatment is not in PHOTON_ALLOWED_TREATMENT_IDS");
  }
  const token = await photonToken();
  const response = await fetch(process.env.PHOTON_GRAPHQL_URL ?? "https://clinical-api.neutron.health/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-photon-auth-token": token,
      "x-photon-auth-token-type": "auth0",
    },
    body: JSON.stringify({
      query: SCREEN_QUERY,
      variables: {
        patientId: input.patientId,
        draftedPrescriptions: input.treatmentIds.map((treatmentId) => ({ treatmentId })),
      },
    }),
  });
  const json = await response.json() as { data?: { prescriptionScreen?: { alerts?: unknown[] } }; errors?: unknown };
  if (!response.ok || json.errors) throw new Error(`Photon screening failed (${response.status})`);
  return { source: "Photon Neutron sandbox", live: true as const, alerts: json.data?.prescriptionScreen?.alerts ?? [] };
}

const OPENROUTER_SYSTEM = `You are the evidence explainer inside Parthia Health's medication reconciliation prototype.
Answer only from the patient evidence supplied in the user message. Be concise and name the source records behind each claim.
Never diagnose, recommend a medication, decide whether a patient should start or stop a medication, change a dose, or imply that a prescription was submitted.
If asked to change care, refuse and say that an authorized clinician must decide. If evidence is incomplete, say exactly what is missing.
This is decision support, not clinical validation.`;

export async function askOpenRouter(input: GroundedAgentInput) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://parthia.health",
      "X-OpenRouter-Title": "Parthia Health",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 350,
      messages: [
        { role: "system", content: OPENROUTER_SYSTEM },
        { role: "user", content: `Patient: ${input.patientName}\nQuestion: ${input.question}\nEvidence:\n${input.evidence}` },
      ],
    }),
  });
  const json = await response.json() as { choices?: { message?: { content?: string } }[]; model?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message ?? `OpenRouter request failed (${response.status})`);
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned an empty response");
  return { text, model: json.model ?? process.env.OPENROUTER_MODEL ?? "configured model", live: true as const };
}
