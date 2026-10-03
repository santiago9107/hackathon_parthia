import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AGENTS } from "@/lib/agents/roster";
import { AgentFace } from "./AgentFace";

describe("agent faces", () => {
  it("has a face for every roster id", () => {
    for (const agent of AGENTS) {
      const markup = renderToStaticMarkup(createElement(AgentFace, { id: agent.id }));
      expect(markup).toContain("<svg");
      expect(markup).toContain(`aria-label=\"${agent.id} agent face\"`);
    }
  });

  it("renders a neutral fallback for an unknown id", () => {
    expect(renderToStaticMarkup(createElement(AgentFace, { id: "unknown", size: 24 }))).toContain("width=\"24\"");
  });
});
