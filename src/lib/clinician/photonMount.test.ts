import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotonScreenResultView } from "@/components/clinician/PhotonScreenPanel";
import { PHOTON_DRAFT_OPTIONS, runPhotonScreen } from "./photonScreen";

/**
 * Guards the wiring of the screening panel into the clinician workspace.
 *
 * The panel itself is covered by `photonScreen.test.ts`. What is covered here
 * is that it is actually mounted, that the workspace carries no second,
 * hand-written Photon result beside it, and that the recorded path a browser
 * on `next dev` takes renders every alert the sandbox returned with MAJOR
 * visually separated from MODERATE.
 */
function workspaceSource(): string {
  return readFileSync(join(process.cwd(), "src", "components", "clinician", "ClinicianWorkspace.tsx"), "utf8");
}

describe("Photon screening panel, mounted in the clinician workspace", () => {
  it("is imported and rendered by the clinician workspace", () => {
    const source = workspaceSource();
    expect(source).toContain('import { PhotonScreenPanel } from "./PhotonScreenPanel"');
    // Rendered once, with the active synthetic patient passed in, and shown under the review queue once a run exists.
    expect(source).toMatch(/<PhotonScreenPanel\s[^>]*patientId=/);
    expect(source).toContain("photon={photonSection}");
  });

  it("is the only Photon screening result in the workspace", () => {
    const source = workspaceSource();
    // The workspace used to render a hand-written moderate interaction with its
    // own provenance wording, which could label fixed copy as a live result.
    expect(source).not.toContain("MODERATE INTERACTION");
    expect(source).not.toContain("Live Neutron");
    expect(source).not.toContain("Recorded fallback");
    expect(source).not.toContain("screenPhoton");
  });

  it("offers all three demo drafts for Harold", () => {
    expect(PHOTON_DRAFT_OPTIONS.map((draft) => draft.treatmentKey)).toEqual([
      "ciprofloxacin-500-mg",
      "amoxicillin-500-mg",
      "ibuprofen-200-mg",
    ]);
  });
});

describe("the recorded path a browser takes without the api functions", () => {
  /** What `next dev` does to the panel's call: the function is not served. */
  const notServed = async () => new Response("<!doctype html><title>404</title>", {
    status: 404,
    headers: { "content-type": "text/html" },
  });

  it("shows every ibuprofen alert, MAJOR apart from moderate, under the recorded label", async () => {
    const outcome = await runPhotonScreen(["ibuprofen-200-mg"], { fetchImpl: notServed as unknown as typeof fetch });
    expect(outcome.provenance).toBe("recorded");
    expect(outcome.alerts).toHaveLength(4);

    const html = renderToStaticMarkup(createElement(PhotonScreenResultView, { outcome }));
    expect(html).toContain("Recorded sandbox response");
    expect(html).not.toContain("Photon screening (Neutron sandbox, live)");
    // Nothing is truncated or collapsed: one list item per returned alert.
    expect(html.split("<li").length - 1).toBe(outcome.alerts.length);
    // MAJOR carries the red treatment, the moderate alerts the amber one.
    expect(html).toContain("border-red-200 bg-red-50 text-red-800");
    expect(html).toContain("border-amber-200 bg-amber-50 text-amber-800");
    expect(html).toContain("aspirin");
    expect(html).toContain("Warfarin");
    expect(html).toContain("Metoprolol");
    expect(html).toContain("ALLERGEN");
    expect(html).toContain("does not prescribe");
  });

  it("keeps the upstream reason visible so a lapsed token is diagnosable", async () => {
    const tokenLapsed = async () => new Response(JSON.stringify({ detail: "Could not get user for request" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
    const outcome = await runPhotonScreen(["ciprofloxacin-500-mg"], { fetchImpl: tokenLapsed as unknown as typeof fetch });
    const html = renderToStaticMarkup(createElement(PhotonScreenResultView, { outcome }));
    expect(html).toContain("Recorded sandbox response");
    expect(html).toContain("Could not get user for request");
  });
});
