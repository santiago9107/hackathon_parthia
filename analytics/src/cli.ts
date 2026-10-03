#!/usr/bin/env node
/**
 * CLI: analyze a fixture (or any PatientSnapshot JSON file) and print the bundle.
 *
 *   npx tsx src/cli.ts fixtures/margaret.json [--as-of 2026-10-03T12:00:00Z] [--mode development|clinical]
 */
import { readFileSync } from "node:fs";
import { analyzePatient } from "./analyze";
import type { KnowledgeMode } from "./knowledge/index";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !["development", "clinical"].includes(a) && !/^\d{4}-/.test(a));
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file) {
  console.error("Usage: tsx src/cli.ts <snapshot.json> [--as-of ISO] [--mode development|clinical]");
  process.exit(2);
}
// The default as_of matches the synthetic fixtures. The CLI never reads the clock, so output is reproducible.
const asOf = flag("as-of") ?? "2026-10-03T12:00:00Z";
const mode = (flag("mode") ?? "development") as KnowledgeMode;
const snapshot = JSON.parse(readFileSync(file, "utf-8"));
process.stdout.write(JSON.stringify(analyzePatient(snapshot, asOf, { knowledge_mode: mode }), null, 2) + "\n");
