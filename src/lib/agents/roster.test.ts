import { describe, expect, it } from "vitest";
import { AGENTS, guardrails } from "./roster";
import { runClinicianAgent } from "@/lib/clinician/agent";
import { buildClinicianCase } from "@/lib/clinician/cases";

describe("agent roster", () => {
  it("credits each host and sponsor exactly once", () => {
    const tributes = AGENTS.slice(0, 5).map((a) => a.tribute);
    expect(new Set(tributes).size).toBe(5);
    expect(tributes).toEqual(expect.arrayContaining(["DxAngels", "Redesign Health", "Photon Health", "TechNovaTime", "Visualize AI"]));
  });

  it("gives a sponsor tribute only to the five named agents, with Iris as the one for Visualize AI", () => {
    expect(AGENTS.filter((a) => a.tribute).map((a) => a.id)).toEqual(["patient", "records", "safety", "photon", "liaison"]);
    expect(AGENTS.find((a) => a.tribute === "Visualize AI")!.id).toBe("liaison");
  });

  it("never lists a tool the policy denies", () => {
    const denied = new Set(guardrails().map((g) => g.tool));
    for (const agent of AGENTS) for (const tool of agent.tools) expect(denied.has(tool)).toBe(false);
  });

  it("refuses every guardrail action with a reason", () => {
    for (const g of guardrails()) {
      expect(g.allowed).toBe(false);
      expect(g.reason.length).toBeGreaterThan(10);
    }
  });

  it("maps the records and safety agents onto real steps in Harold's run", () => {
    const run = runClinicianAgent(buildClinicianCase("p-harold"));
    const used = new Set(run.trace.map((t) => t.tool));
    expect(AGENTS.find((a) => a.id === "records")!.tools.some((t) => used.has(t))).toBe(true);
    expect(AGENTS.find((a) => a.id === "safety")!.tools.some((t) => used.has(t))).toBe(true);
  });

  it("uses no em dashes in any copy", () => {
    expect(JSON.stringify(AGENTS)).not.toMatch(/—/);
  });

  it("includes the specialist and review roles", () => {
    expect(AGENTS.map((agent) => agent.id)).toEqual(expect.arrayContaining(["cardiology", "nutrition", "behavioral", "orchestrator", "reviewer"]));
  });
});
