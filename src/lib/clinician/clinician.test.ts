import { describe, expect, it } from "vitest";
import { buildClinicianCase } from "./cases";
import { runClinicianAgent } from "./agent";
import { answerClinician } from "./chat";
import { runEvaluation } from "./eval";

describe("clinician agent", () => {
  it("pauses before checking an unconfirmed patient medicine", () => {
    const run = runClinicianAgent(buildClinicianCase("p-harold"));
    expect(run.stage).toBe("clarify");
    expect(run.findings.map((f) => f.id)).not.toContain("interaction:ibuprofen+warfarin");
  });
  it("resumes and finds both label-backed interactions", () => {
    const run = runClinicianAgent(buildClinicianCase("p-harold"), { confirmations: { "passport:otc-ibuprofen": true }, resumed: true });
    expect(run.findings.map((f) => f.id)).toContain("interaction:ibuprofen+warfarin");
    expect(run.findings.map((f) => f.id)).toContain("interaction:ciprofloxacin+warfarin");
  });
  it("refuses medication changes", () => {
    const run = runClinicianAgent(buildClinicianCase("p-harold"), { confirmations: { "passport:otc-ibuprofen": true } });
    expect(answerClinician("Stop ibuprofen", run, []).refused).toBe(true);
  });
  it("passes the declared prototype cases", () => {
    const failures = runEvaluation().filter((result) => !result.passed);
    expect(failures).toEqual([]);
  });
});
