import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Duck } from "./Duck";

describe("closing slide duck", () => {
  it("is an accessible SVG and stops moving for reduced motion", () => {
    const markup = renderToStaticMarkup(createElement(Duck));
    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-label="A rubber duck floating on water"');
    expect(markup).toContain("prefers-reduced-motion: reduce");
  });
});
