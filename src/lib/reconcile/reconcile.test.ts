import { describe, expect, it } from "vitest";
import { getSeedRecord } from "../mockData";
import { mergeRecord } from "../passport/merge";
import { createMemoryBackend } from "../passport/backend";
import { PassportStore } from "../passport/store";
import { resolveReconIssue } from "../passport/actions";
import { runFhirImport } from "../fhir/importer";
import type { FhirSource } from "../fhir/source";
import type { FhirBundle } from "../fhir/types";
import haroldJson from "../fhir/bundles/p-harold.json";
import margaretJson from "../fhir/bundles/p-margaret.json";
import rosaJson from "../fhir/bundles/p-rosa.json";
import { findIssues, openIssues, questionsForClinician } from ".";

const BUNDLES: Record<string, FhirBundle> = { "p-harold": haroldJson as unknown as FhirBundle, "p-margaret": margaretJson as unknown as FhirBundle, "p-rosa": rosaJson as unknown as FhirBundle };
const fakeEpic: FhirSource = {
  id: "epic-simulated", name: "Epic MyChart (simulated)", simulated: true, scopes: [], organization: () => "Test Health",
  authorize: async (pid) => ({ accessToken: "t", patient: pid, scope: "", expiresAt: "", simulated: true }),
  fetchEverything: async (_s, pid) => BUNDLES[pid],
};

async function afterEpicImport(patientId: string) {
  const store = new PassportStore(createMemoryBackend());
  const seed = getSeedRecord(patientId)!;
  await runFhirImport(fakeEpic, patientId, seed, store);
  const view = () => {
    const local = store.get(patientId);
    const record = mergeRecord(seed, local);
    return { record, local, issues: findIssues(record, local) };
  };
  return { store, view };
}

const kinds = (issues: ReturnType<typeof findIssues>) => issues.map((i) => i.id).sort();

describe("reconciliation after a (simulated) Epic import", () => {
  it("no issues before any record is connected", () => {
    for (const id of ["p-harold", "p-margaret", "p-rosa"]) expect(findIssues(getSeedRecord(id)!, undefined)).toEqual([]);
  });

  it("HAROLD: metoprolol dose conflict, aspirin missing from Epic, omeprazole possibly stopped", async () => {
    const { view } = await afterEpicImport("p-harold");
    const { issues } = view();
    expect(kinds(issues)).toEqual([
      "dose-conflict:metoprolol",
      "missing-from-source:epic-simulated:aspirin",
      "possibly-stopped:epic-simulated:omeprazole",
    ]);
    const dose = issues.find((i) => i.kind === "dose-conflict")!;
    expect(dose.medications.map((e) => [e.item.dose, e.state])).toEqual([["50 mg", "confirmed"], ["25 mg", "pending"]]);
    expect(dose.question).toMatch(/Which dose of Metoprolol succinate/);
    expect(issues.find((i) => i.kind === "missing-from-source")!.explanation).toMatch(/over the counter or prescribed elsewhere/);
  });

  it("MARGARET: furosemide dose conflict and diphenhydramine missing; the new potassium chloride is not a conflict", async () => {
    const { view } = await afterEpicImport("p-margaret");
    expect(kinds(view().issues)).toEqual(["dose-conflict:furosemide", "missing-from-source:epic-simulated:diphenhydramine"]);
  });

  it("ROSA: metformin schedule conflict and levothyroxine missing; her allergy is on both records", async () => {
    const { view } = await afterEpicImport("p-rosa");
    const { issues } = view();
    expect(kinds(issues)).toEqual(["frequency-conflict:metformin", "missing-from-source:epic-simulated:levothyroxine"]);
    expect(issues[0].explanation).toMatch(/twice daily with meals; Epic MyChart \(simulated\) says once daily/);
  });

  it("an allergy missing from the hospital record is raised", async () => {
    const { store, view } = await afterEpicImport("p-rosa");
    await store.update("p-rosa", (p) => ({ ...p, connections: p.connections.map((c) => ({ ...c, snapshot: { ...c.snapshot!, allergies: [] } })) }));
    expect(view().issues.map((i) => i.kind)).toContain("allergy-missing-from-source");
  });
});

describe("resolving issues", () => {
  it("keep-only: choosing 50 mg discards Epic's pending 25 mg and closes the issue", async () => {
    const { store, view } = await afterEpicImport("p-harold");
    const issue = view().issues.find((i) => i.kind === "dose-conflict")!;
    const keep50 = issue.options.find((o) => o.label.startsWith("50 mg"))!;
    await resolveReconIssue("p-harold", issue, keep50, "2026-10-03", store);
    const after = view();
    expect(after.issues.find((i) => i.id === issue.id)).toBeUndefined();
    expect(after.record.patient.medications.filter((m) => m.genericName === "metoprolol").map((m) => m.dose)).toEqual(["50 mg"]);
    expect(store.get("p-harold")!.activity[0].summary).toMatch(/^Reconciled: Metoprolol succinate/);
  });

  it("keep-only the imported dose: removes the seed entry and confirms Epic's", async () => {
    const { store, view } = await afterEpicImport("p-harold");
    const issue = view().issues.find((i) => i.kind === "dose-conflict")!;
    await resolveReconIssue("p-harold", issue, issue.options.find((o) => o.label.startsWith("25 mg"))!, "2026-10-03", store);
    const meto = view().record.patient.medications.filter((m) => m.genericName === "metoprolol");
    expect(meto.map((m) => [m.dose, m.source.kind])).toEqual([["25 mg", "ehr"]]);
  });

  it("mark-stopped moves the medicine to past medications with a history entry", async () => {
    const { store, view } = await afterEpicImport("p-harold");
    const issue = view().issues.find((i) => i.kind === "possibly-stopped")!;
    await resolveReconIssue("p-harold", issue, issue.options.find((o) => o.id === "stopped")!, "2026-10-03", store);
    const { record, issues } = view();
    expect(record.patient.medications.map((m) => m.genericName)).not.toContain("omeprazole");
    expect(record.pastMedications.find((m) => m.genericName === "omeprazole")).toMatchObject({ status: "stopped", stoppedOn: "2026-10-03" });
    expect(record.patient.medicationHistory.some((e) => e.type === "stopped" && e.medicationName === "Omeprazole")).toBe(true);
    expect(openIssues(issues).map((i) => i.kind)).not.toContain("possibly-stopped");
  });

  it("ask-clinician closes the issue on the dashboard but keeps the question for the visit summary", async () => {
    const { store, view } = await afterEpicImport("p-harold");
    const missing = view().issues.find((i) => i.kind === "missing-from-source")!;
    await resolveReconIssue("p-harold", missing, missing.options.find((o) => o.id === "ask")!, "2026-10-03", store);
    const { issues } = view();
    expect(openIssues(issues).map((i) => i.id)).not.toContain(missing.id);
    expect(questionsForClinician(issues)).toContain("Can you add Aspirin 81 mg to my record? I take it, but it isn't on my medication list with you.");
  });

  it("acknowledge closes the issue without a question", async () => {
    const { store, view } = await afterEpicImport("p-margaret");
    const missing = view().issues.find((i) => i.kind === "missing-from-source")!;
    await resolveReconIssue("p-margaret", missing, missing.options.find((o) => o.id === "ack")!, "2026-10-03", store);
    expect(questionsForClinician(view().issues).join(" ")).not.toMatch(/Diphenhydramine/);
  });
});
