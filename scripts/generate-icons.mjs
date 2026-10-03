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

function svg({ size, maskable }) {
  const pad = maskable ? size * 0.18 : size * 0.1;
  const r = maskable ? 0 : size * 0.22;
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${TEAL}"/>
  <!-- leaf / shield motif -->
  <path d="M ${cx} ${cy - inner * 0.34}
           C ${cx + inner * 0.34} ${cy - inner * 0.34}, ${cx + inner * 0.34} ${cy + inner * 0.10}, ${cx} ${cy + inner * 0.36}
           C ${cx - inner * 0.34} ${cy + inner * 0.10}, ${cx - inner * 0.34} ${cy - inner * 0.34}, ${cx} ${cy - inner * 0.34} Z"
        fill="${CREAM}" opacity="0.96"/>
  <path d="M ${cx} ${cy - inner * 0.22} L ${cx} ${cy + inner * 0.26}" stroke="${TEAL}" stroke-width="${inner * 0.045}" stroke-linecap="round"/>
  <path d="M ${cx} ${cy - inner * 0.02} C ${cx + inner * 0.08} ${cy - inner * 0.10}, ${cx + inner * 0.14} ${cy - inner * 0.12}, ${cx + inner * 0.18} ${cy - inner * 0.16}" stroke="${TEAL}" stroke-width="${inner * 0.04}" stroke-linecap="round" fill="none"/>
  <path d="M ${cx} ${cy + inner * 0.10} C ${cx - inner * 0.08} ${cy + inner * 0.02}, ${cx - inner * 0.14} ${cy}, ${cx - inner * 0.18} ${cy - inner * 0.04}" stroke="${TEAL}" stroke-width="${inner * 0.04}" stroke-linecap="round" fill="none"/>
  <circle cx="${cx + inner * 0.30}" cy="${cy - inner * 0.30}" r="${inner * 0.07}" fill="${GOLD}"/>
</svg>`;
}

function badge(size) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <path d="M ${size / 2} ${size * 0.12}
           C ${size * 0.86} ${size * 0.12}, ${size * 0.86} ${size * 0.58}, ${size / 2} ${size * 0.9}
           C ${size * 0.14} ${size * 0.58}, ${size * 0.14} ${size * 0.12}, ${size / 2} ${size * 0.12} Z" fill="#ffffff"/>
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
