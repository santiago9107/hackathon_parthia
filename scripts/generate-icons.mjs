/**
 * Generates the PWA icon set from an inline SVG using sharp.
 *   node scripts/generate-icons.mjs
 * Outputs: public/icons/icon-{192,512}.png, icon-maskable-{192,512}.png,
 *          apple-touch-icon.png (180), badge-96.png, favicon.png (48)
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const TEAL = "#0E5C56";
const GOLD = "#C9962B";
const CREAM = "#F7F4EE";
/**
 * The mark, drawn in a 64x64 space so it matches src/components/Wordmark.tsx:
 * three record lines merge into one line that ends in a node (the reconciled
 * list), with one small accent dot (a finding surfaced for a clinician).
 */
function mark({ line, accent }) {
  return `
  <g fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round">
    <path d="M12 17 C24.5 17 25.5 32 36.5 32"/>
    <path d="M12 32 H36.5"/>
    <path d="M12 47 C24.5 47 25.5 32 36.5 32"/>
  </g>
  <circle cx="44.5" cy="32" r="8" fill="${line}"/>
  ${accent ? `<circle cx="44.5" cy="32" r="3.6" fill="${accent}"/>` : ""}`;
}
function svg({ size, maskable }) {
  // Maskable icons are cropped to a circle by the launcher, so the artwork is
  // scaled down to sit inside the safe zone and the tile is left square.
  const r = maskable ? 0 : size * 0.22;
  const scale = (size / 64) * (maskable ? 0.76 : 1);
  const offset = (size - 64 * scale) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${TEAL}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${mark({ line: CREAM, accent: GOLD })}</g>
</svg>`;
}
function badge(size) {
  // Notification badges are rendered as a monochrome mask, so no accent dot.
  const scale = (size / 64) * 0.92;
  const offset = (size - 64 * scale) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offset} ${offset}) scale(${scale})">${mark({ line: "#ffffff", accent: null })}</g>
</svg>`;
}
await mkdir("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", svg({ size: 192, maskable: false })],
  ["public/icons/icon-512.png", svg({ size: 512, maskable: false })],
  ["public/icons/icon-maskable-192.png", svg({ size: 192, maskable: true })],
  ["public/icons/icon-maskable-512.png", svg({ size: 512, maskable: true })],
  ["public/icons/apple-touch-icon.png", svg({ size: 180, maskable: true })],
  ["public/icons/favicon-48.png", svg({ size: 48, maskable: false })],
  ["public/icons/badge-96.png", badge(96)],
];
for (const [out, markup] of jobs) {
  await sharp(Buffer.from(markup)).png().toFile(out);
  console.log("wrote", out);
}
