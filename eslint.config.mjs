import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party OCR engine files copied from node_modules (scripts/copy-ocr-assets.mjs)
    "public/ocr/**",
    // Holistic analysis module: self-contained package with its own deps, typecheck and tests (CI job "analytics")
    "analytics/**",
  ]),
]);

export default eslintConfig;
