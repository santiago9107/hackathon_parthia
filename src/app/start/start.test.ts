import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "app", "start", "page.tsx"), "utf8");

describe("master page", () => {
  it("offers exactly the patient side and the clinician side, each starting on Margaret", () => {
    expect(source).toContain('href="/"');
    expect(source).toContain('href="/clinician/"');
    expect(source.match(/setPatientId\("p-margaret"\)/g)).toHaveLength(2);
  });

  it("says the Photon screening is live and never claims a medicine is changed", () => {
    expect(source).toContain("Screen a draft prescription with Photon Health");
    expect(source).not.toMatch(/—/);
  });
});
