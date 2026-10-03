import { afterEach, describe, expect, it, vi } from "vitest";
import screenHandler from "../../../api/photon/screen";
import syncHandler from "../../../api/photon/sync-patient";
import { photonTreatmentId } from "../clinician/photonCatalog";
import { resetPhotonTokenCache } from "./server";
/**
 * Handler-level tests for the two root `api/photon` Vercel functions. They
 * call the default export with a request and response pair shaped like
 * Vercel's, the same way `scripts/photon-live-check.mts` does, with the
 * network mocked so nothing here needs credentials or the sandbox.
 */
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
function collector() {
  const captured: { code: number; body: unknown; headers: Record<string, string> } = { code: 0, body: null, headers: {} };
  const response = {
    status(code: number) { captured.code = code; return response; },
    json(body: unknown) { captured.body = body; },
    setHeader(name: string, value: string) { captured.headers[name] = value; },
  };
  return { response, captured };
}
const CIPRO = photonTreatmentId("ciprofloxacin-500-mg");
describe("api/photon/screen handler", () => {
  it("refuses anything but POST and never reaches the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const method of ["GET", "PUT", "DELETE", undefined]) {
      const { response, captured } = collector();
      await screenHandler({ method, body: { treatmentIds: [CIPRO] } }, response);
      expect(captured.code).toBe(405);
      expect(captured.body).toEqual({ error: "Method not allowed" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("tells caches not to store a screening result", async () => {
    const { response, captured } = collector();
    await screenHandler({ method: "GET" }, response);
    expect(captured.headers["Cache-Control"]).toBe("no-store");
  });
  it("rejects a malformed screening request with 400 and no network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bad: unknown[] = [
      undefined,
      {},
      { treatmentIds: [] },
      { treatmentIds: CIPRO },
      { treatmentIds: [CIPRO, CIPRO, CIPRO, CIPRO, CIPRO, CIPRO] },
      { treatmentIds: [42] },
      { treatmentIds: ["med_01; DROP"] },
      { treatmentIds: [`med_${"x".repeat(200)}`] },
      { treatmentIds: [CIPRO], patientId: 7 },
      { treatmentIds: [CIPRO], patientId: "pat with spaces" },
      { treatmentIds: [CIPRO], patientId: "" },
    ];
    for (const body of bad) {
      const { response, captured } = collector();
      await screenHandler({ method: "POST", body }, response);
      expect(captured.code, `expected 400 for ${JSON.stringify(body)}`).toBe(400);
      expect(captured.body).toEqual({ error: "Invalid screening request" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts up to five treatment ids and returns the live screening result", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ prescriptionScreen: { alerts: [{ type: "DRUG", severity: "MODERATE", description: "warfarin interaction", involvedEntities: [] }] } }));
    vi.stubGlobal("fetch", fetchMock);
    const { response, captured } = collector();
    await screenHandler({ method: "POST", body: { patientId: "pat_1", treatmentIds: [CIPRO] } }, response);
    expect(captured.code).toBe(200);
    expect(captured.body).toMatchObject({ live: true, patientId: "pat_1", treatmentIds: [CIPRO] });
    expect((captured.body as { alerts: unknown[] }).alerts).toHaveLength(1);
  });
  it("answers 503 with the failure detail when the sandbox refuses the screen", async () => {
    photonCredentials();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: "Could not get user for request" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { response, captured } = collector();
    await screenHandler({ method: "POST", body: { patientId: "pat_1", treatmentIds: [CIPRO] } }, response);
    expect(captured.code).toBe(503);
    expect(captured.body).toMatchObject({ error: "Photon screening unavailable" });
    expect((captured.body as { detail: string }).detail).toContain("Could not get user for request");
  });
  it("answers 503 for a well-formed id outside the screening allow-list, before any sandbox call", async () => {
    photonCredentials();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { response, captured } = collector();
    await screenHandler({ method: "POST", body: { patientId: "pat_1", treatmentIds: ["med_01NOTINCATALOG"] } }, response);
    expect(captured.code).toBe(503);
    expect((captured.body as { detail: string }).detail).toContain("not in the Photon screening allow-list");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("never returns a credential or a token in its response body", async () => {
    photonCredentials();
    process.env.PHOTON_USER_TOKEN = "user-access-token";
    const fetchMock = vi.fn().mockResolvedValueOnce(graphqlResponse({ prescriptionScreen: { alerts: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const { response, captured } = collector();
    await screenHandler({ method: "POST", body: { patientId: "pat_1", treatmentIds: [CIPRO] } }, response);
    expect(JSON.stringify(captured.body)).not.toMatch(/user-access-token|secret|client/i);
  });
});
describe("api/photon/sync-patient handler", () => {
  it("refuses anything but POST and never writes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const method of ["GET", "PUT", "DELETE", undefined]) {
      const { response, captured } = collector();
      await syncHandler({ method }, response);
      expect(captured.code).toBe(405);
      expect(captured.body).toEqual({ error: "Method not allowed" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("tells caches not to store a sync result", async () => {
    const { response, captured } = collector();
    await syncHandler({ method: "GET" }, response);
    expect(captured.headers["Cache-Control"]).toBe("no-store");
  });
  it("returns the synthetic patient id and creates him only once", async () => {
    photonCredentials();
    const existing = { id: "pat_1", externalId: "parthia-harold-okafor", allergies: [], medicationHistory: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(graphqlResponse({ patients: [] }))
      .mockResolvedValueOnce(graphqlResponse({ createPatient: { id: "pat_1", externalId: "parthia-harold-okafor" } }))
      .mockResolvedValueOnce(graphqlResponse({ patients: [{ ...existing, allergies: [], medicationHistory: [] }] }))
      .mockResolvedValueOnce(graphqlResponse({ updatePatient: { id: "pat_1", externalId: "parthia-harold-okafor" } }));
    vi.stubGlobal("fetch", fetchMock);
    const first = collector();
    await syncHandler({ method: "POST" }, first.response);
    expect(first.captured.code).toBe(200);
    expect(first.captured.body).toMatchObject({ patientId: "pat_1", created: true, live: true });
    const second = collector();
    await syncHandler({ method: "POST" }, second.response);
    expect(second.captured.code).toBe(200);
    expect(second.captured.body).toMatchObject({ patientId: "pat_1", created: false });
    const creates = fetchMock.mock.calls.filter((call) => String((call[1] as RequestInit).body ?? "").includes("createPatient"));
    expect(creates).toHaveLength(1);
  });
  it("answers 503 without leaking the credential names' values when sync fails", async () => {
    delete process.env.PHOTON_CLIENT_ID;
    delete process.env.PHOTON_CLIENT_SECRET;
    const { response, captured } = collector();
    await syncHandler({ method: "POST" }, response);
    expect(captured.code).toBe(503);
    expect(captured.body).toMatchObject({ error: "Photon patient sync unavailable" });
    expect((captured.body as { detail: string }).detail).toContain("not configured");
  });
});
