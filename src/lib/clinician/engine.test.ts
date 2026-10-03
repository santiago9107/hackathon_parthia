import { describe, expect, it } from "vitest";
import { runClinicianAgent } from "./agent";
import { buildClinicianCase, CLINICIAN_COHORT } from "./cases";
import { FDA_ADVIL_LABEL_URL } from "./evidence";
import type { AgentRun, ClinicianCase } from "./types";

const WARFARIN_ANTIPLATELET = "drug-drug/known-pairs/warfarin+antiplatelet";
const EM_DASH = /[\u2014\u2013]/;

function haroldConfirmed(): AgentRun {
  return runClinicianAgent(buildClinicianCase("p-harold"), { confirmations: { "passport:otc-ibuprofen": true }, resumed: true });
}

/** Harold's Passport with only atorvastatin current, whose one rule flag is moderate. */
function moderateOnlyCase(): ClinicianCase {
  const base = buildClinicianCase("p-harold");
  return {
    ...base,
    sources: base.sources.map((s) => ({ ...s, lastUpdated: "2026-09-18" })),
    records: base.records.filter((r) => r.ingredient === "atorvastatin" && r.status === "active"),
  };
}

describe("full Parthia engine in the clinician agent", () => {
  it("raises Harold's recorded NSAID allergy against the ibuprofen he confirmed", () => {
    const allergy = haroldConfirmed().findings.filter((f) => f.kind === "drug-allergy");
    expect(allergy).toHaveLength(1);
    expect(allergy[0].priority).toBe("high");
    expect(allergy[0].route).toBe("pharmacist");
    expect(allergy[0].ingredients).toContain("ibuprofen");
    expect(allergy[0].supportingRules?.[0].ruleId).toMatch(/^allergy\/medication-conflict/);
    expect(allergy[0].supportingRules?.[0].severity).toBe("high");
  });

  it("raises warfarin plus aspirin as its own finding from Parthia's pair table", () => {
    const finding = haroldConfirmed().findings.find((f) => f.id === "interaction:aspirin+warfarin");
    expect(finding).toBeDefined();
    expect(finding!.priority).toBe("high");
    expect(finding!.ingredients).toEqual(expect.arrayContaining(["warfarin", "aspirin"]));
    expect(finding!.citation).toBeUndefined();
    expect(finding!.supportingRules?.map((r) => r.ruleId)).toContain(WARFARIN_ANTIPLATELET);
  });

  it("keeps warfarin plus ibuprofen as one finding carrying the label passage and the rule id", () => {
    const findings = haroldConfirmed().findings;
    const pair = findings.filter((f) => f.ingredients.includes("warfarin") && f.ingredients.includes("ibuprofen"));
    expect(pair).toHaveLength(1);
    expect(pair[0].id).toBe("interaction:ibuprofen+warfarin");
    expect(pair[0].citation?.url).toBe(FDA_ADVIL_LABEL_URL);
    expect(pair[0].citation?.passage).toContain("blood thinning (anticoagulant)");
    expect(pair[0].supportingRules?.map((r) => r.ruleId)).toContain(WARFARIN_ANTIPLATELET);
    expect(findings.filter((f) => f.id.startsWith("rule:drug-drug"))).toEqual([]);
  });

  it("still waits for the patient before checking an unconfirmed medicine", () => {
    const run = runClinicianAgent(buildClinicianCase("p-harold"));
    expect(run.stage).toBe("clarify");
    // The only ibuprofen item is the question itself. No rule has looked at it yet.
    expect(run.findings.filter((f) => f.ingredients.includes("ibuprofen")).map((f) => f.kind)).toEqual(["needs-confirmation"]);
    expect(run.findings.filter((f) => f.supportingRules && f.ingredients.includes("ibuprofen"))).toEqual([]);
  });

  it("does not run the rules when a case carries no Passport record", () => {
    const run = runClinicianAgent(buildClinicianCase("p-luis"));
    const step = run.trace.find((entry) => entry.tool === "run_parthia_engine");
    expect(step?.status).toBe("info");
    expect(step?.summary).toContain("no Passport record");
    expect(run.findings.filter((f) => f.supportingRules)).toEqual([]);
  });

  it("maps every rule family it raised onto a reviewer question, never an instruction", () => {
    const run = runClinicianAgent(buildClinicianCase("p-margaret"), { confirmations: { "passport:otc-diphenhydramine": true }, resumed: true });
    const kinds = new Set(run.findings.filter((f) => f.supportingRules).map((f) => f.kind));
    expect(kinds).toEqual(new Set(["anticholinergic-burden", "drug-mood", "drug-kidney", "interaction"]));
    for (const finding of run.findings) expect(finding.question).not.toMatch(/^(stop|start|increase|decrease|switch|prescribe)\b/i);
  });

  it("gives every finding split out of one pair rule its own title", () => {
    const run = runClinicianAgent(buildClinicianCase("p-margaret"), { confirmations: { "passport:otc-diphenhydramine": true }, resumed: true });
    const sedation = run.findings.filter((f) => f.supportingRules?.some((r) => r.ruleId === "drug-drug/known-pairs/ssri+zdrug-sedation"));
    expect(sedation).toHaveLength(2);
    expect(new Set(sedation.map((f) => f.title)).size).toBe(2);
    for (const finding of sedation) for (const ingredient of finding.ingredients) expect(finding.title.toLowerCase()).toContain(ingredient);

    // Harold's warfarin pairs: aspirin keeps its own heading, ibuprofen keeps the label-backed one.
    const aspirin = haroldConfirmed().findings.find((f) => f.id === "interaction:aspirin+warfarin");
    expect(aspirin!.title).toBe("Two medicines that both reduce clotting: Warfarin and Aspirin");
  });

  it("reports the merge count that merge() actually performed", () => {
    const harold = haroldConfirmed();
    const step = harold.trace.find((entry) => entry.tool === "run_parthia_engine");
    // One engine flag folded into the label-backed warfarin plus ibuprofen finding.
    expect(step?.summary).toContain("3 rule flag(s), 3 new finding(s), 1 merged");
    const haroldRules = harold.findings.flatMap((f) => f.supportingRules ?? []).length;
    expect(haroldRules).toBe(4);

    // Nothing to merge into here, so every engine finding is reported as new.
    const margaret = runClinicianAgent(buildClinicianCase("p-margaret"), { confirmations: { "passport:otc-diphenhydramine": true }, resumed: true });
    const margaretStep = margaret.trace.find((entry) => entry.tool === "run_parthia_engine");
    const margaretRules = margaret.findings.flatMap((f) => f.supportingRules ?? []).length;
    expect(margaretStep?.summary).toContain(`${margaretRules} new finding(s), 0 merged`);
  });

  it("does not reach complete on a moderate-only case, because the finding still needs a human", () => {
    const run = runClinicianAgent(moderateOnlyCase());
    const priorities = new Set(run.findings.map((f) => f.priority));
    expect(run.findings.length).toBeGreaterThan(0);
    expect(priorities).toEqual(new Set(["moderate"]));
    expect(run.findings.every((f) => f.blocking)).toBe(true);
    expect(run.stage).not.toBe("complete");
    expect(run.status).toBe("review-required");
    expect(run.humanCount).toBe(run.findings.length);
  });

  it("leaves a case with an unmappable medication not clean, and guesses nothing about it", () => {
    const base = buildClinicianCase("p-rosa");
    const clean = runClinicianAgent(base);
    expect(clean.status).toBe("complete");

    const run = runClinicianAgent({
      ...base,
      records: [...base.records, {
        id: "hospital:r-rivaroxaban", ingredient: "rivaroxaban", display: "Rivaroxaban 20 mg", dose: "20 mg",
        status: "active", recordType: "prescribed", sourceId: "hospital", sourceLabel: "Hospital EHR", recordedOn: "2026-09-18",
      }],
    });
    const finding = run.findings.find((f) => f.id === "unmapped:rivaroxaban");
    expect(finding).toBeDefined();
    expect(finding!.kind).toBe("unmapped-medication");
    expect(finding!.priority).toBe("data-quality");
    expect(finding!.blocking).toBe(true);
    expect(finding!.supportingRules).toBeUndefined();
    expect(finding!.ingredients).toEqual(["rivaroxaban"]);
    expect(run.status).toBe("incomplete");
    expect(run.stage).not.toBe("complete");
    const step = run.trace.find((entry) => entry.tool === "run_parthia_engine");
    expect(step?.summary).toContain("could not be mapped to a verified ingredient (rivaroxaban)");
  });

  it("routes every finding to a human at any severity, on both the engine and the agent path", () => {
    for (const patient of CLINICIAN_COHORT) {
      for (const options of [{}, { confirmations: { "passport:otc-ibuprofen": true, "passport:otc-diphenhydramine": true } }]) {
        const run = runClinicianAgent(buildClinicianCase(patient.id), options);
        for (const finding of run.findings) expect(finding.blocking, `${patient.id} ${finding.id}`).toBe(true);
        if (run.findings.length) expect(run.stage, patient.id).not.toBe("complete");
      }
    }
  });

  it("carries no em dash into any clinician finding", () => {
    for (const patient of CLINICIAN_COHORT) {
      for (const options of [{}, { confirmations: { "passport:otc-ibuprofen": true, "passport:otc-diphenhydramine": true } }]) {
        for (const finding of runClinicianAgent(buildClinicianCase(patient.id), options).findings) {
          const text = [finding.title, finding.detail, finding.question, ...(finding.supportingRules ?? []).flatMap((r) => [r.ruleName, ...r.evidence])].join(" ");
          expect(EM_DASH.test(text), `${patient.id} ${finding.id}`).toBe(false);
        }
      }
    }
  });
});
