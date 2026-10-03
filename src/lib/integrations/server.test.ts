import { afterEach, describe, expect, it, vi } from "vitest";
import { photonDemoPatient, photonTreatmentId } from "../clinician/photonCatalog";
import { askOpenRouter, findPhotonDemoPatientId, resetPhotonTokenCache, screenPhoton, syncPhotonPatient } from "./server";
const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
  resetPhotonTokenCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function photonCredentials() {
  process.env.PHOTON_CLIENT_ID = "client";
  process.env.PHOTON_CLIENT_SECRET = "secret";
  delete process.env.PHOTON_USER_TOKEN;
  delete process.env.PHOTON_ALLOWED_TREATMENT_IDS;
}
function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 });
}
function graphqlResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200 });
}
const CIPRO = photonTreatmentId("ciprofloxacin-500-mg");
describe("credential-gated integrations", () => {
  it("fails closed when OpenRouter is not configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(askOpenRouter({ question: "What is flagged?", patientName: "Test Patient", evidence: "none" })).rejects.toThrow("not configured");
  });
  it("sends only grounded evidence to OpenRouter", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ model: "test/model", choices: [{ message: { content: "Source-backed answer" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(askOpenRouter({ question: "What is flagged?", patientName: "Test Patient", evidence: "Hospital record: warfarin" })).resolves.toMatchObject({ text: "Source-backed answer", live: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.messages[0].content).toContain("Never diagnose");
    expect(body.messages[1].content).toContain("Hospital record: warfarin");
  });
  it("fails closed when Photon credentials are missing", async () => {
    delete process.env.PHOTON_CLIENT_ID;
    delete process.env.PHOTON_CLIENT_SECRET;
    await expect(syncPhotonPatient()).rejects.toThrow("not configured");
  });
  it("rejects Photon treatment IDs outside the server allow-list", async () => {
    process.env.PHOTON_ALLOWED_TREATMENT_IDS = "allowed-id";
    await expect(screenPhoton({ patientId: "patient-1", treatmentIds: ["other-id"] })).rejects.toThrow("not in the Photon screening allow-list");
  });
  it("rejects a treatment outside the catalog when no allow-list is configured", async () => {
    photonCredentials();
    await expect(screenPhoton({ patientId: "patient-1", treatmentIds: ["med_not_in_catalog"] })).rejects.toThrow("not in the Photon screening allow-list");
  });
  it("uses the Neutron token exchange and read-only screening query", async () => {
    photonCredentials();
    process.env.PHOTON_ALLOWED_TREATMENT_IDS = CIPRO;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ prescriptionScreen: { alerts: [{ type: "DRUG", severity: "MODERATE", description: "warfarin interaction", involvedEntities: [{ __typename: "PrescriptionScreeningAlertInvolvedExistingPrescription", id: "rx_1", name: "Warfarin" }] }] } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await screenPhoton({ patientId: "patient-1", treatmentIds: [CIPRO] });
    expect(result).toMatchObject({ live: true, source: "Photon Neutron sandbox", patientId: "patient-1" });
    expect(result.alerts[0].involvedEntities[0]).toEqual({ id: "rx_1", name: "Warfarin", kind: "existing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [screenUrl, screenInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(screenUrl).toContain("clinical-api.neutron.health");
    const headers = screenInit.headers as Record<string, string>;
    expect(headers["x-photon-auth-token-type"]).toBe("auth0");
    expect(headers.authorization).toBeUndefined();
    const body = String(screenInit.body);
    expect(body).toContain("prescriptionScreen");
    expect(body).not.toContain("createPrescription");
    expect(body).not.toContain("mutation");
  });
  it("sends each drafted prescription as a treatment object, not a treatmentId", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ prescriptionScreen: { alerts: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await screenPhoton({ patientId: "patient-1", treatmentIds: [CIPRO] });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as { variables: { draftedPrescriptions: { treatment: { id: string } }[] } };
    expect(sent.variables.draftedPrescriptions).toEqual([{ treatment: { id: CIPRO } }]);
  });
  it("never sends the user token with a mutation, even on the clinical API", async () => {
    photonCredentials();
    process.env.PHOTON_USER_TOKEN = "user-access-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [] }))
      .mockResolvedValueOnce(graphqlResponse({ createPatient: { id: "pat_new" } }));
    vi.stubGlobal("fetch", fetchMock);
    await syncPhotonPatient();
    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-photon-auth-token"]).toBeUndefined();
      expect(headers.authorization ?? "").not.toContain("user-access-token");
    }
  });
  it("uses a configured user access token for the read-only screen only", async () => {
    photonCredentials();
    process.env.PHOTON_USER_TOKEN = "user-access-token";
    const fetchMock = vi.fn().mockResolvedValueOnce(graphqlResponse({ prescriptionScreen: { alerts: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await screenPhoton({ patientId: "patient-1", treatmentIds: [CIPRO] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("clinical-api.neutron.health");
    expect((init.headers as Record<string, string>)["x-photon-auth-token"]).toBe("user-access-token");
  });
  it("surfaces the sandbox error message when screening is refused", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: "Could not get user for request" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(screenPhoton({ patientId: "patient-1", treatmentIds: [CIPRO] })).rejects.toThrow("Could not get user for request");
  });
});
describe("synthetic sandbox patient sync", () => {
  it("creates the patient once, with his allergies and medication history", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [] }))
      .mockResolvedValueOnce(graphqlResponse({ createPatient: { id: "pat_new", externalId: "parthia-harold-okafor" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await syncPhotonPatient();
    expect(result).toMatchObject({ patientId: "pat_new", created: true, updated: false, live: true });
    const [lookupUrl, lookupInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(lookupUrl).toContain("api.neutron.health/graphql");
    expect((lookupInit.headers as Record<string, string>).authorization).toBe("Bearer token");
    const demo = photonDemoPatient();
    const created = JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body)) as { query: string; variables: Record<string, unknown> };
    expect(created.query).toContain("createPatient");
    expect(created.variables).toMatchObject({
      externalId: demo.externalId,
      dateOfBirth: demo.dateOfBirth,
      sex: "MALE",
      phone: demo.phone,
      allergies: demo.allergenIds.map((allergenId) => ({ allergenId })),
      medicationHistory: demo.medicationIds.map((medicationId) => ({ medicationId, active: true })),
    });
  });
  it("is idempotent: an existing in-sync patient is returned without any mutation", async () => {
    photonCredentials();
    const demo = photonDemoPatient();
    const existing = {
      id: "pat_existing",
      externalId: demo.externalId,
      allergies: demo.allergenIds.map((id) => ({ allergen: { id } })),
      medicationHistory: demo.medicationIds.map((id) => ({ active: true, medication: { id } })),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [existing] }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await syncPhotonPatient();
    expect(first).toMatchObject({ patientId: "pat_existing", created: false, updated: false });
    fetchMock.mockResolvedValueOnce(graphqlResponse({ patients: [existing] }));
    const second = await syncPhotonPatient();
    expect(second.patientId).toBe(first.patientId);
    expect(second.created).toBe(false);
    const bodies = fetchMock.mock.calls.map((call) => String((call[1] as RequestInit).body ?? ""));
    expect(bodies.some((body) => body.includes("createPatient"))).toBe(false);
    expect(bodies.some((body) => body.includes("updatePatient"))).toBe(false);
  });
  it("refreshes an existing patient whose allergies drifted, keeping the same id", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [{ id: "pat_existing", externalId: "parthia-harold-okafor", allergies: [], medicationHistory: [] }] }))
      .mockResolvedValueOnce(graphqlResponse({ updatePatient: { id: "pat_existing", externalId: "parthia-harold-okafor" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await syncPhotonPatient();
    expect(result).toMatchObject({ patientId: "pat_existing", created: false, updated: true });
    expect(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body)).toContain("updatePatient");
  });
  it("ignores a patient with a different externalId instead of reusing it", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [{ id: "pat_other", externalId: "someone-else", allergies: [], medicationHistory: [] }] }))
      .mockResolvedValueOnce(graphqlResponse({ createPatient: { id: "pat_new" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(syncPhotonPatient()).resolves.toMatchObject({ patientId: "pat_new", created: true });
  });
  it("looks the synthetic patient up when no patient id is supplied, and writes nothing", async () => {
    photonCredentials();
    const demo = photonDemoPatient();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [{ id: "pat_existing", externalId: demo.externalId, allergies: [], medicationHistory: [] }] }))
      .mockResolvedValueOnce(graphqlResponse({ prescriptionScreen: { alerts: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await screenPhoton({ treatmentIds: [CIPRO] });
    expect(result.patientId).toBe("pat_existing");
    const sent = JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body)) as { variables: { patientId: string } };
    expect(sent.variables.patientId).toBe("pat_existing");
    // A screen is a read. It must never create or change a patient record,
    // even one whose allergies drifted from the catalog.
    const bodies = fetchMock.mock.calls.map((call) => String((call[1] as RequestInit).body ?? ""));
    expect(bodies.some((body) => body.includes("mutation"))).toBe(false);
    expect(bodies.some((body) => body.includes("createPatient"))).toBe(false);
    expect(bodies.some((body) => body.includes("updatePatient"))).toBe(false);
  });
  it("fails closed instead of creating the patient when he is not in the org yet", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(screenPhoton({ treatmentIds: [CIPRO] })).rejects.toThrow("not in the Photon org yet");
    const bodies = fetchMock.mock.calls.map((call) => String((call[1] as RequestInit).body ?? ""));
    expect(bodies.some((body) => body.includes("createPatient"))).toBe(false);
  });
  it("resolves the demo patient id read-only, with no mutation in any request", async () => {
    photonCredentials();
    const demo = photonDemoPatient();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [{ id: "pat_existing", externalId: demo.externalId, allergies: [], medicationHistory: [] }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(findPhotonDemoPatientId()).resolves.toBe("pat_existing");
    expect(fetchMock.mock.calls.every((call) => !String((call[1] as RequestInit).body ?? "").includes("mutation"))).toBe(true);
  });
});
