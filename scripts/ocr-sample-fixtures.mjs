#!/usr/bin/env node
/**
 * Runs real Tesseract OCR (the same engine and English data the app ships) on the
 * synthetic sample documents and saves the recognized text as test fixtures in
 * src/lib/ocr/fixtures/. Re-run after changing scripts/generate-sample-documents.mjs.
 */
import { createWorker } from "tesseract.js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const worker = await createWorker("eng", 1, { langPath: `${root}/public/ocr/lang`, gzip: true, cacheMethod: "none" });
for (const f of ["sample-prescription-harold", "sample-lab-report-margaret", "sample-visit-summary-rosa"]) {
  const t0 = Date.now();
  const { data } = await worker.recognize(`${root}/public/samples/${f}.png`);
  writeFileSync(`${root}/src/lib/ocr/fixtures/${f}.txt`, data.text);
  console.log(`== ${f} (${Date.now() - t0} ms, confidence ${Math.round(data.confidence)})\n${data.text}`);
}
await worker.terminate();
