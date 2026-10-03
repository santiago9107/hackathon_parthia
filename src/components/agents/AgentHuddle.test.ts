import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentHuddle } from "./AgentHuddle";
import { buildHuddle } from "@/lib/agents/huddle";
import { MARGARET_HUDDLE_FIXTURE } from "@/lib/agents/huddle.fixture";

const huddle = buildHuddle(MARGARET_HUDDLE_FIXTURE, {
  answeredBy: "rules",
  segments: [{ kind: "authored", text: "Ask your care team about the source-backed findings." }],
  citations: [{ label: "Medication records" }],
  suggestions: [],
});

describe("AgentHuddle", () => {
  it("renders a labelled dialog, Nova, agent cards and the live log", () => {
    const html = renderToStaticMarkup(createElement(AgentHuddle, { open: true, onClose: () => undefined, huddle }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Nova");
    expect(html).toContain("Reid");
    expect(html).toContain("Iris");
    expect(html).toContain("Rule-based agents, no language model.");
    expect(html).toContain('aria-live="polite"');
  });

  it("does not render the huddle for urgent symptoms", () => {
    const html = renderToStaticMarkup(createElement(AgentHuddle, { open: true, onClose: () => undefined, huddle, urgent: "physical" }));
    expect(html).toContain("911");
    expect(html).not.toContain('role="dialog"');
  });
});
