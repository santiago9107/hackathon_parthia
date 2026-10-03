import { type PhotonDemoPatient, photonAllowedTreatmentIds, photonDemoPatient } from "../clinician/photonCatalog";
/**
 * Server-only integrations. These run in Vercel Functions under the root `api/`
 * directory and in the local MCP server, never in the browser: they read
 * PHOTON_CLIENT_ID, PHOTON_CLIENT_SECRET and OPENROUTER_API_KEY from the
 * environment and those must never be shipped to a client bundle.
 *
 * Photon screening here is read-only decision support. There is no code path
 * that creates, changes, stops or doses a prescription, and screening itself
 * writes nothing at all: the only mutations in this file are in
 * `syncPhotonPatient`, on the one synthetic sandbox patient the demo uses.
 */
export interface PhotonScreenInput {
  /** Optional. Defaults to the synthetic sandbox patient for the demo. */
  patientId?: string;
  /** Synthetic catalog patient to resolve when patientId is omitted. */
  demoPatientId?: "p-harold" | "p-margaret";
  treatmentIds: string[];
}
export interface PhotonAlert {
  type: string;
  severity: string;
  description: string;
  involvedEntities: { id: string; name: string; kind: string }[];
}
export interface PhotonScreenResult {
  source: string;
  live: true;
  patientId: string;
  screenedAt: string;
  treatmentIds: string[];
  alerts: PhotonAlert[];
}
export interface PhotonSyncResult {
  source: string;
  live: true;
  patientId: string;
  externalId: string;
  created: boolean;
  updated: boolean;
  syncedAt: string;
}
export interface GroundedAgentInput {
  question: string;
  patientName: string;
  evidence: string;
}
const PHOTON_SOURCE = "Photon Neutron sandbox";
const MAIN_API_URL = "https://api.neutron.health/graphql";
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
/** Test seam. The token is cached for its full lifetime, so tests must clear it. */
export function resetPhotonTokenCache(): void {
  photonTokenCache = null;
}
/**
 * Neutron exposes two endpoints with two different header styles: the main API
 * takes `Authorization: Bearer`, the clinical API takes `x-photon-auth-token`
 * plus `x-photon-auth-token-type: auth0`. Sending the wrong pair fails.
 *
 * The clinical API resolves a user for `prescriptionScreen`, and a machine to
 * machine client has no user, so PHOTON_USER_TOKEN carries a user access token
 * for that one read-only query when it is configured. Everything else, token
 * exchange, lookups, createPatient and updatePatient, keeps using the machine
 * to machine credentials. `withUserToken` is opt in per call and refuses to
 * carry a mutation, so the user token can never write.
 */
async function photonGraphql<T>(
  api: "main" | "clinical",
  query: string,
  variables: Record<string, unknown>,
  options: { withUserToken?: boolean } = {},
): Promise<T> {
  const userToken = options.withUserToken ? process.env.PHOTON_USER_TOKEN?.trim() : undefined;
  if (userToken && /\bmutation\b/.test(query)) throw new Error("The Photon user token is read-only and must not carry a mutation");
  const token = userToken ?? await photonToken();
  const url = api === "main"
    ? (process.env.PHOTON_MAIN_GRAPHQL_URL ?? MAIN_API_URL)
    : (process.env.PHOTON_GRAPHQL_URL ?? "https://clinical-api.neutron.health/graphql");
  const headers: Record<string, string> = api === "main"
    ? { "content-type": "application/json", authorization: `Bearer ${token}` }
    : { "content-type": "application/json", "x-photon-auth-token": token, "x-photon-auth-token-type": "auth0" };
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const json = await response.json() as { data?: T; errors?: { message?: string }[] };
  if (!response.ok || json.errors?.length) {
    const detail = json.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(`Photon ${api} API call failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  if (!json.data) throw new Error(`Photon ${api} API returned no data`);
  return json.data;
}
const PATIENT_LOOKUP_QUERY = `query PatientLookup($name: String!) {
  patients(filter: { name: $name }, first: 50) {
    id
    externalId
    allergies { allergen { id } }
    medicationHistory { active medication { id } }
  }
}`;
const CREATE_PATIENT_MUTATION = `mutation CreateDemoPatient($externalId: ID!, $name: NameInput!, $dateOfBirth: AWSDate!, $sex: SexType!, $phone: AWSPhone!, $allergies: [AllergenInput]!, $medicationHistory: [MedHistoryInput]!) {
  createPatient(externalId: $externalId, name: $name, dateOfBirth: $dateOfBirth, sex: $sex, phone: $phone, allergies: $allergies, medicationHistory: $medicationHistory) { id externalId }
}`;
const UPDATE_PATIENT_MUTATION = `mutation UpdateDemoPatient($id: ID!, $allergies: [AllergenInput], $medicationHistory: [MedHistoryInput]) {
  updatePatient(id: $id, allergies: $allergies, medicationHistory: $medicationHistory) { id externalId }
}`;
interface SandboxPatientRow {
  id: string;
  externalId?: string | null;
  allergies?: ({ allergen?: { id?: string | null } | null } | null)[] | null;
  medicationHistory?: ({ active?: boolean | null; medication?: { id?: string | null } | null } | null)[] | null;
}
/**
 * Creates the synthetic demo patient on the main API (the clinical API's
 * createPatient carries no allergy field) exactly once, then keeps its
 * allergies and medication history in step with the catalog.
 *
 * Idempotent: `patients(filter: { name })` is the only filter the schema
 * offers, so the externalId match happens here. A second call returns the same
 * Photon patient id and creates nothing.
 *
 * Known assumption, accepted for a synthetic demo patient: idempotency rests
 * on the name filter seeing a create immediately. If that index ever lagged a
 * create, a call in the same moment would not find him and would create a
 * second record. Observed behaviour is read-after-write consistent, and the
 * org holds exactly one Harold Okafor after repeated calls. The lookup also
 * caps at the first 50 same-named patients.
 */
async function lookupDemoPatient(demo: PhotonDemoPatient): Promise<SandboxPatientRow | undefined> {
  const fullName = `${demo.firstName} ${demo.lastName}`;
  const lookup = await photonGraphql<{ patients?: SandboxPatientRow[] }>("main", PATIENT_LOOKUP_QUERY, { name: fullName });
  return (lookup.patients ?? []).find((patient) => patient.externalId === demo.externalId);
}
/**
 * Read-only resolve of the synthetic demo patient's Photon id. This is the
 * path screening uses, so a screen never creates or changes a patient record:
 * if he has not been synced yet, screening fails rather than writing.
 */
export async function findPhotonDemoPatientId(patientId: "p-harold" | "p-margaret" = "p-harold"): Promise<string | undefined> {
  return (await lookupDemoPatient(photonDemoPatient(patientId)))?.id;
}
export async function syncPhotonPatient(patientId: "p-harold" | "p-margaret" = "p-harold"): Promise<PhotonSyncResult> {
  const demo = photonDemoPatient(patientId);
  const existing = await lookupDemoPatient(demo);
  const allergies = demo.allergenIds.map((allergenId) => ({ allergenId }));
  const medicationHistory = demo.medicationIds.map((medicationId) => ({ medicationId, active: true }));
  if (!existing) {
    const created = await photonGraphql<{ createPatient?: { id?: string } }>("main", CREATE_PATIENT_MUTATION, {
      externalId: demo.externalId,
      name: { first: demo.firstName, last: demo.lastName },
      dateOfBirth: demo.dateOfBirth,
      sex: demo.sex,
      phone: demo.phone,
      allergies,
      medicationHistory,
    });
    const patientId = created.createPatient?.id;
    if (!patientId) throw new Error("Photon createPatient returned no patient id");
    return { source: PHOTON_SOURCE, live: true, patientId, externalId: demo.externalId, created: true, updated: false, syncedAt: new Date().toISOString() };
  }
  const haveAllergens = new Set((existing.allergies ?? []).map((entry) => entry?.allergen?.id).filter(Boolean));
  const haveMedications = new Set((existing.medicationHistory ?? []).filter((entry) => entry?.active).map((entry) => entry?.medication?.id).filter(Boolean));
  const inSync = demo.allergenIds.every((id) => haveAllergens.has(id)) && demo.medicationIds.every((id) => haveMedications.has(id));
  if (inSync) {
    return { source: PHOTON_SOURCE, live: true, patientId: existing.id, externalId: demo.externalId, created: false, updated: false, syncedAt: new Date().toISOString() };
  }
  const updated = await photonGraphql<{ updatePatient?: { id?: string } }>("main", UPDATE_PATIENT_MUTATION, { id: existing.id, allergies, medicationHistory });
  return { source: PHOTON_SOURCE, live: true, patientId: updated.updatePatient?.id ?? existing.id, externalId: demo.externalId, created: false, updated: true, syncedAt: new Date().toISOString() };
}
const SCREEN_QUERY = `query PrescriptionScreen($patientId: ID!, $draftedPrescriptions: [DraftedPrescriptionInput!]!) {
  prescriptionScreen(patientId: $patientId, draftedPrescriptions: $draftedPrescriptions) {
    alerts {
      type
      severity
      description
      involvedEntities {
        __typename
        id
        name
      }
    }
  }
}`;
interface RawAlert {
  type?: string | null;
  severity?: string | null;
  description?: string | null;
  involvedEntities?: ({ __typename?: string | null; id?: string | null; name?: string | null } | null)[] | null;
}
const ENTITY_KIND: Record<string, string> = {
  PrescriptionScreeningAlertInvolvedAllergen: "allergen",
  PrescriptionScreeningAlertInvolvedCondition: "condition",
  PrescriptionScreeningAlertInvolvedDraftedPrescription: "drafted",
  PrescriptionScreeningAlertInvolvedExistingPrescription: "existing",
};
/**
 * Read-only screen of drafted prescriptions against the sandbox patient's
 * medication history and allergies. Rules decide: every alert below is the
 * sandbox's own output, never a model's.
 *
 * Nothing in this path mutates the Photon org. The patient is resolved by
 * lookup, so an unsynced patient makes screening fail closed instead of
 * creating a record as a side effect of a read.
 */
export async function screenPhoton(input: PhotonScreenInput): Promise<PhotonScreenResult> {
  const configured = (process.env.PHOTON_ALLOWED_TREATMENT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const allowed = new Set(configured.length ? configured : photonAllowedTreatmentIds());
  if (!input.treatmentIds.length || input.treatmentIds.some((id) => !allowed.has(id))) {
    throw new Error("Requested treatment is not in the Photon screening allow-list");
  }
  // Read-only all the way: the patient is looked up, never created or updated,
  // so no screen can write to the Photon org.
  const photonPatientId = input.patientId ?? await findPhotonDemoPatientId(input.demoPatientId);
  if (!photonPatientId) throw new Error("The synthetic sandbox patient is not in the Photon org yet. Run the patient sync once before screening");
  const data = await photonGraphql<{ prescriptionScreen?: { alerts?: RawAlert[] | null } }>("clinical", SCREEN_QUERY, {
    patientId: photonPatientId,
    draftedPrescriptions: input.treatmentIds.map((id) => ({ treatment: { id } })),
  }, { withUserToken: true });
  const alerts: PhotonAlert[] = (data.prescriptionScreen?.alerts ?? []).map((alert) => ({
    type: alert.type ?? "UNKNOWN",
    severity: alert.severity ?? "UNKNOWN",
    description: alert.description ?? "",
    involvedEntities: (alert.involvedEntities ?? []).filter(Boolean).map((entity) => ({
      id: entity?.id ?? "",
      name: entity?.name ?? "",
      kind: ENTITY_KIND[entity?.__typename ?? ""] ?? "other",
    })),
  }));
  return { source: PHOTON_SOURCE, live: true, patientId: photonPatientId, screenedAt: new Date().toISOString(), treatmentIds: input.treatmentIds, alerts };
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
