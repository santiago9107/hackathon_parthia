import { describe, expect, it } from "vitest";
import { runClinicianAgent } from "./agent";
import { buildClinicianCase } from "./cases";
import { countsBySystem, systemsFor } from "./bodySystems";

const run = (id: string) => runClinicianAgent(buildClinicianCase(id));
const find = (id: string, pattern: RegExp) => run(id).findings.find((f) => pattern.test(f.title))!;

describe("body systems for findings", () => {
  it("maps Margaret's anticholinergic burden to brain and gut", () => {
    expect(systemsFor(find("p-margaret", /Anticholinergic burden/))).toEqual(["gastrointestinal", "neurological"]);
  });

  it("maps the drowsiness combinations and the mood findings to neurological", () => {
    expect(systemsFor(find("p-margaret", /drowsiness: Sertraline and Diphenhydramine/))).toEqual(["neurological"]);
    expect(systemsFor(find("p-margaret", /Mood has dropped/))).toEqual(["neurological"]);
  });

  it("maps falling kidney function to renal", () => {
    expect(systemsFor(find("p-margaret", /Kidney function is falling/))).toEqual(["renal"]);
  });

  it("does not force a system onto a finding with no honest mapping", () => {
    expect(systemsFor(find("p-margaret", /beta-blocker can hide low blood sugar/i))).toEqual([]);
    expect(systemsFor(find("p-margaret", /Confirm Benadryl/))).toEqual([]);
    expect(systemsFor(find("p-harold", /Cardiology EHR is stale/))).toEqual([]);
  });

  it("maps Harold's two clotting findings to the circulatory system", () => {
    expect(systemsFor(find("p-harold", /both reduce clotting/))).toContain("circulatory");
    expect(systemsFor(find("p-harold", /ciprofloxacin monitoring/))).toContain("circulatory");
  });

  it("counts every finding that touches a system, and neurological leads for Margaret", () => {
    const counts = countsBySystem(run("p-margaret").findings);
    expect(counts.neurological).toBeGreaterThan(counts.renal);
    expect(counts.neurological).toBeGreaterThan(counts.circulatory);
    expect(counts.renal).toBeGreaterThanOrEqual(1);
  });
});
