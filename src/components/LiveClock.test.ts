import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatClock, LiveClock } from "./LiveClock";

describe("live clock", () => {
  it("formats the real date and time, with or without seconds", () => {
    const moment = new Date("2026-10-03T19:02:14Z"); // 3:02:14 PM in New York
    expect(formatClock(moment, { timeZone: "America/New_York" })).toBe("Saturday, October 3 · 3:02:14 PM");
    expect(formatClock(moment, { timeZone: "America/New_York", seconds: false })).toBe("Saturday, October 3 · 3:02 PM");
    expect(formatClock(moment, { timeZone: "America/New_York", withDate: false, seconds: false })).toBe("3:02 PM");
  });

  it("renders an empty placeholder on the server so the browser never mismatches", () => {
    const markup = renderToStaticMarkup(createElement(LiveClock));
    expect(markup).not.toMatch(/\d:\d\d/);
  });
});
