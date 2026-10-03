#!/usr/bin/env node
/**
 * Copies the Tesseract.js worker, WebAssembly core and English language data
 * from node_modules into public/ocr/ so on-device OCR works with no CDN calls
 * and offline. Runs automatically before `dev` and `build` (see package.json).
 * public/ocr/ is git-ignored; it's rebuilt from the installed packages.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const out = join(root, "public", "ocr");

const files = [
  [join(pkgDir("tesseract.js"), "dist", "worker.min.js"), join(out, "worker.min.js")],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"].map((f) => [join(pkgDir("tesseract.js-core"), f), join(out, "core", f)]),
  [join(pkgDir("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"), join(out, "lang", "eng.traineddata.gz")],
];

let copied = 0;
for (const [from, to] of files) {
  if (!existsSync(from)) throw new Error(`Missing OCR asset: ${from}`);
  mkdirSync(dirname(to), { recursive: true });
  if (!existsSync(to) || statSync(to).size !== statSync(from).size) {
    copyFileSync(from, to);
    copied++;
  }
}
console.log(`OCR assets ready in public/ocr (${copied} copied, ${files.length - copied} up to date).`);
