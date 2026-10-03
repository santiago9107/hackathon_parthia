import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".json") ? [] : [path];
  });
}

describe("icon policy", () => {
  it("keeps emoji and decorative glyphs out of source copy", () => {
    const decorative = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/u;
    const offenders = sourceFiles(join(process.cwd(), "src"))
      .filter((path) => decorative.test(readFileSync(path, "utf8")))
      .map((path) => path.replace(`${process.cwd()}/`, ""));
    expect(offenders).toEqual([]);
  });
});
