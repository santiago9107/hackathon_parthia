import { describe, expect, it } from "vitest";
import { buildStages } from "./stages";
import { RULES } from "@/lib/safetyEngine";

describe("architecture stages", () => {
  const stages = buildStages(RULES.length);

  it("has the five stages in pipeline order", () => {
    expect(stages.map((s) => s.id)).toEqual(["capture", "store", "analyze", "agents", "share"]);
  });

  it("runs something at every stage and marks planned parts as next", () => {
    for (const stage of stages) expect(stage.nodes.some((n) => n.status === "running")).toBe(true);
    const planned = stages.flatMap((s) => s.nodes).filter((n) => n.status === "next").map((n) => n.id);
    expect(planned).toEqual(expect.arrayContaining(["epic", "cloud", "model", "link"]));
  });

  it("states the real rule count and never claims a database or HIPAA compliance as running", () => {
    expect(stages[2]!.nodes.find((n) => n.id === "rules")!.lines[0]).toContain(String(RULES.length));
    const text = JSON.stringify(stages.flatMap((s) => s.nodes.filter((n) => n.status === "running")));
    expect(text).not.toMatch(/postgres|hipaa|openai|chatgpt/i);
  });

  it("keeps node text short enough for the diagram and free of em dashes", () => {
    for (const node of stages.flatMap((s) => s.nodes)) {
      for (const line of node.lines) expect((line ?? "").length).toBeLessThanOrEqual(32);
      expect(node.title.length).toBeLessThanOrEqual(24);
    }
    expect(JSON.stringify(stages)).not.toMatch(/—/);
  });
});
