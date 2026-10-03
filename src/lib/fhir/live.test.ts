import { describe, expect, it } from "vitest";
import { getSeedRecord } from "../mockData";
import { createMemoryBackend } from "../passport/backend";
import { PassportStore } from "../passport/store";
import { pendingEntries } from "../passport/ops";
import type { Medication } from "../types";
import {
  LIVE_SOURCE_LABEL,
  RXNAV_PROVENANCE,
  SANDBOX_UNAVAILABLE,
  enrichLiveMedications,
  fetchSandboxBundle,
  listSandboxPatients,
  liveProvenance,
  resolveIngredient,
  runLiveSandboxImport,
  type FetchLike,
} from "./live";

/**
 * Every test here mocks the network. Nothing in this file reaches the public
 * FHIR sandbox or RxNav, so the suite stays offline and deterministic.
 */

interface Route {
  match: string;
  body?: unknown;
  ok?: boolean;
  /** Reject instead of answering, as an offline browser would. */
  throws?: boolean;
}

function mockFetch(routes: Route[]) {
  const calls: { url: string; accept: string | undefined }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const accept = (init?.headers as Record<string, string> | undefined)?.Accept;
    calls.push({ url, accept });
    const route = routes.find((r) => url.includes(r.match));
    if (!route) return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    if (route.throws) throw new TypeError("Failed to fetch");
    return { ok: route.ok ?? true, status: route.ok === false ? 503 : 200, json: async () => route.body } as unknown as Response;
  };
  return { fetchImpl, calls };
}

const relatedBody = (ingredients: { rxcui: string; name: string }[]) => ({
  relatedGroup: { conceptGroup: [{ tty: "IN", conceptProperties: ingredients }] },
});

/** A combination product whose ingredients are both outside Parthia's dictionary. */
const COMBINATION_TEXT = "Dutasteride 0.5 MG / tamsulosin hydrochloride 0.4 MG Oral Capsule";
const COMBINATION = relatedBody([
  { rxcui: "237159", name: "dutasteride" },
  { rxcui: "77492", name: "tamsulosin" },
]);

const med = (over: Partial<Medication> = {}): Medication => ({
  id: "ehr-1",
  name: "Simvistatin",
  genericName: "simvistatin",
  class: "other",
  dose: "10 mg",
  frequency: "once daily",
  startDate: "2026-01-04",
  rxNormCode: "316672",
  status: "active",
  source: { kind: "ehr", label: LIVE_SOURCE_LABEL, importedAt: "2026-10-03T09:00:00Z", verified: false, originalText: "Simvistatin 10 MG" },
  ...over,
});

describe("live ingredient mapping", () => {
  it("uses Parthia's own dictionary first and makes no network call", async () => {
    const { fetchImpl, calls } = mockFetch([]);
    const mapping = await resolveIngredient({ rxcui: "7258", text: "Naproxen sodium 220 MG Oral Tablet" }, fetchImpl);
    expect(mapping).toEqual({ method: "dictionary", generic: "naproxen", rxcui: "7258", combination: false, ingredientCount: 1 });
    expect(calls).toHaveLength(0);
  });

  it("recognises a dictionary medicine from its text when the code is unknown", async () => {
    const { fetchImpl, calls } = mockFetch([]);
    const mapping = await resolveIngredient({ rxcui: "999999999", text: "warfarin sodium 5 MG Oral Tablet" }, fetchImpl);
    expect(mapping.method).toBe("dictionary");
    expect(mapping.generic).toBe("warfarin");
    expect(calls).toHaveLength(0);
  });

  it("asks RxNav for the ingredient behind a code the dictionary does not know", async () => {
    const { fetchImpl, calls } = mockFetch([
      { match: "/rxcui/316672/related.json", body: relatedBody([{ rxcui: "36567", name: "simvastatin" }]) },
    ]);
    const mapping = await resolveIngredient({ rxcui: "316672", text: "Simvistatin 10 MG" }, fetchImpl);
    expect(mapping).toEqual({ method: "rxnav-code", generic: "simvastatin", rxcui: "36567", combination: false, ingredientCount: 1 });
    expect(calls).toHaveLength(1);
  });

  it("never sends the FHIR media type to RxNav, which answers 406 for it", async () => {
    const { fetchImpl, calls } = mockFetch([
      { match: "/rxcui/316672/related.json", body: relatedBody([{ rxcui: "36567", name: "simvastatin" }]) },
    ]);
    await resolveIngredient({ rxcui: "316672" }, fetchImpl);
    expect(calls[0].url).toContain("rxnav.nlm.nih.gov");
    expect(calls[0].accept).toBe("application/json");
    expect(calls.every((c) => c.accept !== "application/fhir+json")).toBe(true);
  });

  it("matches on text through approximateTerm when there is no code at all", async () => {
    const { fetchImpl, calls } = mockFetch([
      { match: "/approximateTerm.json", body: { approximateGroup: { candidate: [{ rxcui: "1256", score: "75" }] } } },
      { match: "/rxcui/1256/related.json", body: relatedBody([{ rxcui: "1256", name: "azathioprine" }]) },
    ]);
    const mapping = await resolveIngredient({ text: "azaTHIOprine (IMURAN) tablet" }, fetchImpl);
    expect(mapping.method).toBe("rxnav-text");
    expect(mapping.generic).toBe("azathioprine");
    expect(calls[0].url).toContain("term=azaTHIOprine%20(IMURAN)%20tablet");
    expect(calls).toHaveLength(2);
  });

  it("takes the first ingredient of a combination product and says it is one", async () => {
    const { fetchImpl } = mockFetch([{ match: "/rxcui/862001/related.json", body: COMBINATION }]);
    const mapping = await resolveIngredient({ rxcui: "862001", text: COMBINATION_TEXT }, fetchImpl);
    expect(mapping.generic).toBe("dutasteride");
    expect(mapping.combination).toBe(true);
    expect(mapping.ingredientCount).toBe(2);
    expect(liveProvenance(COMBINATION_TEXT, mapping)).toContain("combination product, imported as the first of its 2 ingredients");
    expect(liveProvenance(COMBINATION_TEXT, mapping)).toContain(RXNAV_PROVENANCE);
  });

  it("leaves a medicine unmapped rather than guessing when RxNav knows nothing", async () => {
    const { fetchImpl } = mockFetch([{ match: "/rxcui/123/related.json", body: { relatedGroup: { conceptGroup: [] } } }]);
    const mapping = await resolveIngredient({ rxcui: "123", text: "Mystery compound" }, fetchImpl);
    expect(mapping.method).toBe("unmapped");
    expect(mapping.generic).toBeUndefined();
  });

  it("leaves a medicine unmapped when RxNav itself is unreachable", async () => {
    const { fetchImpl } = mockFetch([{ match: "rxnav.nlm.nih.gov", throws: true }]);
    const mapping = await resolveIngredient({ rxcui: "316672", text: "Simvistatin 10 MG" }, fetchImpl);
    expect(mapping.method).toBe("unmapped");
  });
});

describe("enriching mapped medications", () => {
  it("records the RxNav provenance on the item and keeps the server's own wording", async () => {
    const { fetchImpl } = mockFetch([
      { match: "/rxcui/316672/related.json", body: relatedBody([{ rxcui: "36567", name: "simvastatin" }]) },
    ]);
    const { medications, counts } = await enrichLiveMedications([med()], fetchImpl);
    expect(medications[0].genericName).toBe("simvastatin");
    expect(medications[0].rxNormCode).toBe("36567");
    expect(medications[0].source.originalText).toBe(`Simvistatin 10 MG · simvastatin: ${RXNAV_PROVENANCE}`);
    expect(counts).toEqual({ dictionary: 0, rxnav: 1, unmapped: 0, combinations: 0 });
  });

  it("labels a combination product in its name and provenance", async () => {
    const { fetchImpl } = mockFetch([{ match: "/rxcui/862001/related.json", body: COMBINATION }]);
    const incoming = med({ id: "ehr-2", name: "Dutasteride and tamsulosin", genericName: "dutasteride and tamsulosin", rxNormCode: "862001", source: { ...med().source, originalText: COMBINATION_TEXT } });
    const { medications, counts } = await enrichLiveMedications([incoming], fetchImpl);
    expect(medications[0].name).toBe("Dutasteride and tamsulosin (combination)");
    expect(medications[0].genericName).toBe("dutasteride");
    expect(medications[0].source.originalText).toContain("first of its 2 ingredients");
    expect(counts.combinations).toBe(1);
  });

  it("leaves dictionary medicines exactly as the shared mapper produced them", async () => {
    const { fetchImpl, calls } = mockFetch([]);
    const dictionary = med({ name: "Naproxen", genericName: "naproxen", class: "nsaid", rxNormCode: "7258", source: { ...med().source, originalText: "Naproxen sodium 220 MG Oral Tablet" } });
    const { medications, counts } = await enrichLiveMedications([dictionary], fetchImpl);
    expect(medications[0]).toEqual(dictionary);
    expect(medications[0].source.originalText).not.toContain(RXNAV_PROVENANCE);
    expect(counts).toEqual({ dictionary: 1, rxnav: 0, unmapped: 0, combinations: 0 });
    expect(calls).toHaveLength(0);
  });

  it("asks RxNav once for a product that appears twice", async () => {
    const { fetchImpl, calls } = mockFetch([
      { match: "/rxcui/316672/related.json", body: relatedBody([{ rxcui: "36567", name: "simvastatin" }]) },
    ]);
    const { medications } = await enrichLiveMedications([med(), med({ id: "ehr-2" })], fetchImpl);
    expect(medications).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});

describe("reading the sandbox", () => {
  const patientBody = { resourceType: "Patient", id: "p1", name: [{ given: ["Rick697"], family: "Prohaska492" }], birthDate: "1950-08-03" };

  it("lists patients who have active prescriptions, busiest first", async () => {
    const { fetchImpl, calls } = mockFetch([
      {
        match: "/MedicationRequest?status=active",
        body: {
          resourceType: "Bundle",
          entry: [
            { resource: { subject: { reference: "Patient/p1" } } },
            { resource: { subject: { reference: "Patient/p2" } } },
            { resource: { subject: { reference: "Patient/p2" } } },
            { resource: { subject: { reference: "Group/g1" } } },
          ],
        },
      },
      {
        match: "/Patient?_id=",
        body: {
          resourceType: "Bundle",
          entry: [{ resource: patientBody }, { resource: { resourceType: "Patient", id: "p2", name: [{ given: ["Lonnie"], family: "Von" }] } }],
        },
      },
    ]);
    const patients = await listSandboxPatients(8, fetchImpl);
    expect(patients.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(patients[1].name).toBe("Rick Prohaska");
    expect(patients[0].activeMedications).toBe(2);
    expect(calls[0].accept).toBe("application/fhir+json");
  });

  it("degrades to a clear message instead of crashing when the sandbox is down", async () => {
    const { fetchImpl } = mockFetch([{ match: "r4.smarthealthit.org", throws: true }]);
    await expect(listSandboxPatients(8, fetchImpl)).rejects.toThrow(SANDBOX_UNAVAILABLE);
    await expect(fetchSandboxBundle("p1", fetchImpl)).rejects.toThrow(SANDBOX_UNAVAILABLE);
  });

  it("degrades to a clear message when the sandbox answers with an error status", async () => {
    const { fetchImpl } = mockFetch([{ match: "r4.smarthealthit.org", ok: false }]);
    await expect(listSandboxPatients(8, fetchImpl)).rejects.toThrow(SANDBOX_UNAVAILABLE);
  });

  it("names medicines the server described only by reference, and drops nameless ones", async () => {
    const { fetchImpl } = mockFetch([
      { match: "/Patient/p1", body: patientBody },
      {
        match: "/MedicationRequest?patient=",
        body: {
          resourceType: "Bundle",
          entry: [
            { resource: { resourceType: "MedicationRequest", id: "m1", status: "active", medicationReference: { reference: "Medication/x", display: "azaTHIOprine (IMURAN) tablet" } } },
            { resource: { resourceType: "MedicationRequest", id: "m2", status: "active", medicationCodeableConcept: { coding: [{ display: "Naproxen sodium 220 MG Oral Tablet" }] } } },
            { resource: { resourceType: "MedicationRequest", id: "m3", status: "active", medicationReference: { reference: "Medication/y" } } },
          ],
        },
      },
      { match: "/Condition?patient=", body: { resourceType: "Bundle", entry: [] } },
    ]);
    const bundle = await fetchSandboxBundle("p1", fetchImpl);
    const texts = (bundle.entry ?? [])
      .map((e) => (e.resource as { medicationCodeableConcept?: { text?: string } }).medicationCodeableConcept?.text)
      .filter(Boolean);
    expect(texts).toEqual(["azaTHIOprine (IMURAN) tablet", "Naproxen sodium 220 MG Oral Tablet"]);
  });
});

describe("the live import as a whole", () => {
  const routes: Route[] = [
    { match: "/Patient/p1", body: { resourceType: "Patient", id: "p1", name: [{ given: ["Rick697"], family: "Prohaska492" }], birthDate: "1950-08-03" } },
    {
      match: "/MedicationRequest?patient=",
      body: {
        resourceType: "Bundle",
        entry: [
          {
            resource: {
              resourceType: "MedicationRequest",
              id: "m1",
              status: "active",
              authoredOn: "2026-02-01T10:00:00Z",
              medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "316672", display: "Simvistatin 10 MG" }], text: "Simvistatin 10 MG" },
              dosageInstruction: [{ timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } }, doseAndRate: [{ doseQuantity: { value: 10, unit: "mg" } }] }],
            },
          },
        ],
      },
    },
    {
      match: "/Condition?patient=",
      body: {
        resourceType: "Bundle",
        entry: [
          { resource: { resourceType: "Condition", id: "c1", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }], text: "Diabetes mellitus" }, onsetDateTime: "2015-04-02T00:00:00Z" } },
        ],
      },
    },
    { match: "/rxcui/316672/related.json", body: relatedBody([{ rxcui: "36567", name: "simvastatin" }]) },
  ];

  it("leaves everything waiting in Review, with the live provenance visible", async () => {
    const { fetchImpl } = mockFetch(routes);
    const store = new PassportStore(createMemoryBackend());
    const seed = getSeedRecord("p-harold")!;
    const sandboxPatient = { id: "p1", name: "Rick Prohaska", birthDate: "1950-08-03", activeMedications: 1 };
    const result = await runLiveSandboxImport(sandboxPatient, "p-harold", seed, fetchImpl, store);

    expect(result.counts.rxnav).toBe(1);
    const pending = pendingEntries(store.get("p-harold"));
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((e) => e.status === "pending" && e.item.source.verified === false)).toBe(true);
    expect(pending.every((e) => e.item.source.label === LIVE_SOURCE_LABEL)).toBe(true);

    const medication = pending.find((e) => e.collection === "medications");
    expect(medication?.item.source.originalText).toContain(RXNAV_PROVENANCE);
    expect((medication?.item as Medication).genericName).toBe("simvastatin");
    expect(pending.some((e) => e.collection === "conditions")).toBe(true);
  });

  it("registers the source honestly: a real connection, not a simulated one, and without a snapshot", async () => {
    const { fetchImpl } = mockFetch(routes);
    const store = new PassportStore(createMemoryBackend());
    const seed = getSeedRecord("p-harold")!;
    await runLiveSandboxImport({ id: "p1", name: "Rick Prohaska", activeMedications: 1 }, "p-harold", seed, fetchImpl, store);
    const connection = store.get("p-harold")?.connections.find((c) => c.name === LIVE_SOURCE_LABEL);
    expect(connection?.simulated).toBe(false);
    expect(connection?.kind).toBe("ehr");
    expect(connection?.snapshot).toBeUndefined();
  });

  it("changes nothing in the Passport when the sandbox fails mid-import", async () => {
    const { fetchImpl } = mockFetch([{ match: "r4.smarthealthit.org", throws: true }]);
    const store = new PassportStore(createMemoryBackend());
    const seed = getSeedRecord("p-harold")!;
    await expect(runLiveSandboxImport({ id: "p1", name: "Rick Prohaska", activeMedications: 1 }, "p-harold", seed, fetchImpl, store)).rejects.toThrow(SANDBOX_UNAVAILABLE);
    expect(pendingEntries(store.get("p-harold"))).toHaveLength(0);
  });
});
