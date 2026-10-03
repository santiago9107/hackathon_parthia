import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PhotonScreenResultView } from "@/components/clinician/PhotonScreenPanel";
import { photonTreatmentId } from "./photonCatalog";
import {
  PHOTON_LIVE_LABEL,
  PHOTON_RECORDED_LABEL,
  PHOTON_SYNTHETIC_LABEL,
  PHOTON_SYNC_LIVE_LABEL,
  photonFallback,
  photonProvenanceLabel,
  runPhotonScreen,
  syncPhotonPatient,
} from "./photonScreen";
import { PHOTON_MARGARET_RECORDED_SCREENS, PHOTON_RECORDED_SCREENS, type RecordedPhotonScreen } from "./photonRecorded";
const liveAlert = {
  type: "DRUG",
  severity: "MAJOR",
  description: "Ciprofloxacin may increase the anticoagulant effect of warfarin.",
  involvedEntities: [{ id: "med_1", name: "Ciprofloxacin HCl Oral Tablet 500 MG", kind: "drafted" }],
};
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
describe("Photon screening client", () => {
  it("sends only treatment ids and labels a successful call live", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ alerts: [liveAlert], patientId: "pat_1", screenedAt: "2026-10-03T14:00:00.000Z" }));
    const outcome = await runPhotonScreen(["ciprofloxacin-500-mg"], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.provenance).toBe("live");
    expect(outcome.label).toBe(PHOTON_LIVE_LABEL);
    expect(outcome.alerts).toHaveLength(1);
    expect(outcome.patientId).toBe("pat_1");
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/photon/screen");
    const body = JSON.parse(String(init.body)) as { treatmentIds: string[] };
    expect(body.treatmentIds).toEqual([photonTreatmentId("ciprofloxacin-500-mg")]);
    expect(String(init.body)).not.toContain("token");
  });
  it("falls back to the captured sandbox response when the live call fails, for example an expired user token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Photon screening unavailable", detail: "Could not get user for request" }, 503));
    const outcome = await runPhotonScreen(["ibuprofen-200-mg"], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.label).toBe(PHOTON_RECORDED_LABEL);
    expect(outcome.label).not.toBe(PHOTON_LIVE_LABEL);
    expect(outcome.reason).toContain("Could not get user for request");
    expect(outcome.alerts.filter((alert) => alert.type === "DRUG")).toHaveLength(3);
    expect(outcome.alerts.filter((alert) => alert.type === "ALLERGEN")).toHaveLength(1);
    expect(outcome.alerts.some((alert) => alert.severity === "MAJOR" && /aspirin/i.test(alert.description))).toBe(true);
  });
  it("says where to run the function when it is not served, even though the 404 body is HTML", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<!DOCTYPE html><title>404</title>", { status: 404, headers: { "content-type": "text/html" } }));
    const outcome = await runPhotonScreen(["ibuprofen-200-mg"], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.reason).toContain("vercel dev");
    expect(outcome.reason).not.toContain("could not be reached");
  });
  it("stamps a merged fallback with the latest capture time, not the first one", () => {
    const recorded: Record<string, RecordedPhotonScreen> = {
      "ciprofloxacin-500-mg": { recordedAt: "2026-10-03T14:00:00.000Z", treatmentKey: "ciprofloxacin-500-mg", alerts: [liveAlert] },
      "amoxicillin-500-mg": { recordedAt: "2026-10-03T14:05:00.000Z", treatmentKey: "amoxicillin-500-mg", alerts: [liveAlert] },
    };
    const outcome = photonFallback(["ciprofloxacin-500-mg", "amoxicillin-500-mg"], "live call failed", recorded);
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.alerts).toHaveLength(2);
    expect(outcome.screenedAt).toBe("2026-10-03T14:05:00.000Z");
  });
  it("falls back when the function is not reachable at all", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const outcome = await runPhotonScreen(["amoxicillin-500-mg"], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.alerts.map((alert) => alert.type)).toEqual(["DRUG", "ALLERGEN"]);
  });
  it("labels a synthetic example as synthetic when no capture exists for the draft", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Photon screening unavailable" }, 503));
    const outcome = await runPhotonScreen(["ciprofloxacin-500-mg"], { fetchImpl: fetchImpl as unknown as typeof fetch, recorded: {} });
    expect(outcome.provenance).toBe("synthetic");
    expect(outcome.label).toBe(PHOTON_SYNTHETIC_LABEL);
    expect(outcome.label).not.toContain(PHOTON_RECORDED_LABEL);
  });
  it("sends Margaret's catalog patient and uses her recorded fallback", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Photon screening unavailable" }, 503));
    const outcome = await runPhotonScreen(["tramadol-50-mg"], { patientId: "p-margaret", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.alerts).toHaveLength(2);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ demoPatientId: "p-margaret" });
    expect(String(init.body)).not.toContain("token");
  });
  it("prefers a real captured response over a synthetic example", () => {
    const recorded: Record<string, RecordedPhotonScreen> = {
      "ciprofloxacin-500-mg": { recordedAt: "2026-10-03T14:30:00.000Z", treatmentKey: "ciprofloxacin-500-mg", alerts: [liveAlert] },
    };
    const outcome = photonFallback(["ciprofloxacin-500-mg"], "live call failed", recorded);
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.label).toBe(PHOTON_RECORDED_LABEL);
    expect(outcome.screenedAt).toBe("2026-10-03T14:30:00.000Z");
  });
  it("keeps the three provenance labels distinct and reserves the live one", () => {
    expect(photonProvenanceLabel("live")).toBe("Photon screening (Neutron sandbox, live)");
    expect(photonProvenanceLabel("recorded")).toBe("Recorded sandbox response");
    expect(photonProvenanceLabel("synthetic")).toContain("synthetic");
    expect(photonProvenanceLabel("synthetic")).not.toContain("live)");
  });
  it("rejects a draft outside the demo catalog without calling the network", async () => {
    const fetchImpl = vi.fn();
    const outcome = await runPhotonScreen(["oxycodone-5-mg"], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome.provenance).toBe("synthetic");
    expect(outcome.reason).toContain("not in the demo screening catalog");
  });
});
describe("Photon patient sync client", () => {
  it("labels a successful sync live and reports the patient id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ patientId: "pat_1", externalId: "parthia-harold-okafor", created: false, updated: false }));
    const outcome = await syncPhotonPatient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.live).toBe(true);
    expect(outcome.label).toBe(PHOTON_SYNC_LIVE_LABEL);
    expect(outcome.patientId).toBe("pat_1");
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/photon/sync-patient");
  });
  it("never claims live when the sync call fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Photon patient sync unavailable", detail: "credentials missing" }, 503));
    const outcome = await syncPhotonPatient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.live).toBe(false);
    expect(outcome.label).not.toContain("live");
    expect(outcome.reason).toContain("credentials missing");
  });
});
describe("captured sandbox responses", () => {
  it("has a real capture for each demo draft, so the fallback is recorded rather than synthetic", () => {
    for (const key of ["ciprofloxacin-500-mg", "amoxicillin-500-mg", "ibuprofen-200-mg"]) {
      const capture = PHOTON_RECORDED_SCREENS[key];
      expect(capture, `missing capture for ${key}`).toBeDefined();
      expect(capture.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(capture.alerts.length).toBeGreaterThan(0);
      expect(JSON.stringify(capture)).not.toMatch(/token|secret|bearer/i);
    }
    expect(photonFallback(["ciprofloxacin-500-mg"], "live call failed").provenance).toBe("recorded");
  });
  it("has recorded captures for Margaret's three Photon drafts", () => {
    expect(PHOTON_MARGARET_RECORDED_SCREENS["tramadol-50-mg"].alerts).toHaveLength(2);
    expect(PHOTON_MARGARET_RECORDED_SCREENS["ibuprofen-200-mg"].alerts).toHaveLength(2);
    expect(PHOTON_MARGARET_RECORDED_SCREENS["diphenhydramine-25-mg"].alerts).toHaveLength(0);
    expect(JSON.stringify(PHOTON_MARGARET_RECORDED_SCREENS)).not.toMatch(/token|secret|bearer/i);
  });
  it("matches the alert sets the sandbox actually returned, extra alerts included", () => {
    const cipro = PHOTON_RECORDED_SCREENS["ciprofloxacin-500-mg"].alerts;
    expect(cipro).toHaveLength(1);
    expect(cipro[0]).toMatchObject({ type: "DRUG", severity: "MODERATE" });
    expect(cipro[0].description).toMatch(/warfarin/i);
    const amox = PHOTON_RECORDED_SCREENS["amoxicillin-500-mg"].alerts;
    expect(amox.map((alert) => alert.type)).toEqual(["DRUG", "ALLERGEN"]);
    expect(amox[0].description).toMatch(/warfarin/i);
    expect(amox[1].description).toMatch(/penicillin/i);
    const ibu = PHOTON_RECORDED_SCREENS["ibuprofen-200-mg"].alerts;
    expect(ibu).toHaveLength(4);
    expect(ibu.filter((alert) => alert.type === "DRUG")).toHaveLength(3);
    expect(ibu.find((alert) => alert.severity === "MAJOR")?.description).toMatch(/aspirin/i);
    expect(ibu.some((alert) => /warfarin/i.test(alert.description))).toBe(true);
    expect(ibu.some((alert) => /metoprolol/i.test(alert.description))).toBe(true);
    expect(ibu.filter((alert) => alert.type === "ALLERGEN")).toHaveLength(1);
  });
  it("renders every alert, so the MAJOR aspirin interaction is never dropped", () => {
    const outcome = photonFallback(["ibuprofen-200-mg"], "live call failed");
    const html = renderToStaticMarkup(createElement(PhotonScreenResultView, { outcome }));
    expect(outcome.alerts).toHaveLength(4);
    expect(html.match(/MODERATE|MAJOR/g) ?? []).toHaveLength(4);
    expect(html).toContain("MAJOR");
    expect(html).toContain("Recorded sandbox response");
  });
});
describe("raw sandbox evidence", () => {
  /**
   * `fixtures/photon/raw/*.json` are the raw clinical-API envelopes from the
   * first live run, kept as evidence and read by no runtime code. This test is
   * the guard that keeps them from drifting back into contradicting the
   * generated fallback the UI actually reads, which is what made two capture
   * sets a problem in the first place.
   */
  interface RawCapture {
    recordedAt: string;
    patientId: string;
    response: { data: { prescriptionScreen: { alerts: { type: string; severity: string; involvedEntities: { id: string }[] }[] } } };
  }
  function rawCapture(treatmentKey: string): RawCapture {
    return JSON.parse(readFileSync(join(process.cwd(), "fixtures", "photon", "raw", `${treatmentKey}-raw.json`), "utf8")) as RawCapture;
  }
  it("agrees with the generated fallback on the drug screened and the alerts returned", () => {
    for (const key of ["ciprofloxacin-500-mg", "amoxicillin-500-mg", "ibuprofen-200-mg"]) {
      const raw = rawCapture(key);
      const rawAlerts = raw.response.data.prescriptionScreen.alerts;
      const recorded = PHOTON_RECORDED_SCREENS[key];
      const shape = (alerts: { type: string; severity: string }[]) => alerts.map((alert) => `${alert.type}/${alert.severity}`).sort();
      expect(shape(rawAlerts), `raw and recorded disagree for ${key}`).toEqual(shape(recorded.alerts));
      const screened = photonTreatmentId(key);
      expect(rawAlerts.some((alert) => alert.involvedEntities.some((entity) => entity.id === screened))).toBe(true);
      expect(recorded.alerts.some((alert) => alert.involvedEntities.some((entity) => entity.id === screened))).toBe(true);
      expect(raw.patientId).toBe("pat_01M412P6SKKHQH8TXN43N4BV4Q");
      expect(raw.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(JSON.stringify(raw)).not.toMatch(/token|secret|bearer/i);
    }
  });
});
describe("Photon screening panel view", () => {
  it("renders live alerts under the live label", () => {
    const html = renderToStaticMarkup(createElement(PhotonScreenResultView, {
      outcome: {
        provenance: "live",
        label: PHOTON_LIVE_LABEL,
        drafts: [{ treatmentKey: "ciprofloxacin-500-mg", label: "Ciprofloxacin 500 mg", expects: "" }],
        alerts: [liveAlert],
        screenedAt: "2026-10-03T14:00:00.000Z",
      },
    }));
    expect(html).toContain("Photon screening (Neutron sandbox, live)");
    expect(html).toContain("DRUG");
    expect(html).not.toContain("Recorded sandbox response");
    expect(html).toContain("does not prescribe");
  });
  it("renders the fallback path with its own label and never the live one", () => {
    const html = renderToStaticMarkup(createElement(PhotonScreenResultView, {
      outcome: photonFallback(["ibuprofen-200-mg"], "The sandbox screening call did not succeed.", {}),
    }));
    expect(html).toContain("Example screening response (synthetic). Live Neutron screening unavailable.");
    expect(html).not.toContain("Photon screening (Neutron sandbox, live)");
    expect(html).not.toContain("Recorded sandbox response");
    expect(html).toContain("ALLERGEN");
  });
  it("renders a captured sandbox response under the recorded label", () => {
    const recorded: Record<string, RecordedPhotonScreen> = {
      "ciprofloxacin-500-mg": { recordedAt: "2026-10-03T14:30:00.000Z", treatmentKey: "ciprofloxacin-500-mg", alerts: [liveAlert] },
    };
    const html = renderToStaticMarkup(createElement(PhotonScreenResultView, {
      outcome: photonFallback(["ciprofloxacin-500-mg"], "The sandbox screening call did not succeed.", recorded),
    }));
    expect(html).toContain("Recorded sandbox response");
    expect(html).not.toContain("Photon screening (Neutron sandbox, live)");
  });
});
