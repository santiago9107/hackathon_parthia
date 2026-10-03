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
    expect(run.findings.find((f) => f.id === "interaction:ibuprofen+warfarin")?.citation?.url)
      .toBe("https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/211733Orig1s007lbl.pdf");
    expect(run.findings.find((f) => f.id === "interaction:ciprofloxacin+warfarin")?.citation?.url)
      .toBe("https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=b064286b-fedc-be68-e053-2995a90aae52&type=display");
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
