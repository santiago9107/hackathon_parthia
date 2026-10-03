import { afterEach, describe, expect, it, vi } from "vitest";
import { askOpenRouter, screenPhoton } from "./server";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("rejects Photon treatment IDs outside the server allow-list", async () => {
    process.env.PHOTON_ALLOWED_TREATMENT_IDS = "allowed-id";
    await expect(screenPhoton({ patientId: "patient-1", treatmentIds: ["other-id"] })).rejects.toThrow("not in PHOTON_ALLOWED_TREATMENT_IDS");
  });

  it("uses the Neutron token exchange and read-only screening query", async () => {
    process.env.PHOTON_ALLOWED_TREATMENT_IDS = "treatment-1";
    process.env.PHOTON_CLIENT_ID = "client";
    process.env.PHOTON_CLIENT_SECRET = "secret";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { prescriptionScreen: { alerts: [{ severity: "MODERATE" }] } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(screenPhoton({ patientId: "patient-1", treatmentIds: ["treatment-1"] })).resolves.toMatchObject({ live: true, source: "Photon Neutron sandbox" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, screenInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(String(screenInit.body)).toContain("prescriptionScreen");
    expect(String(screenInit.body)).not.toContain("createPrescription");
  });
});
