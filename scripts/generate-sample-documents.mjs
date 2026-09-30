#!/usr/bin/env node
/**
 * Generates SYNTHETIC sample documents for the "Scan a document" demo —
 * rendered with sharp from SVG so on-device OCR has something realistic to
 * read. Every image is clearly marked "SAMPLE — SYNTHETIC". No real people.
 *
 *   1. Urgent-care prescription for Harold: naproxen 500 mg twice daily.
 *      Confirming it triggers the warfarin + NSAID high-severity flag.
 *   2. Lab report for Margaret: basic metabolic panel (lower eGFR, low K).
 *   3. Visit summary for Rosa from her PCP (levothyroxine, vitamin D).
 *
 * Usage: node scripts/generate-sample-documents.mjs → public/samples/*.png
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples");
const W = 1240;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** lines: [text, { size, weight, x, gap, color }] */
function page(lines, height) {
  let y = 150;
  const body = lines
    .map(([text, o = {}]) => {
      const size = o.size ?? 30;
      y += o.gap ?? Math.round(size * 1.55);
      if (text === "---") return `<line x1="80" y1="${y - size / 2}" x2="${W - 80}" y2="${y - size / 2}" stroke="#999" stroke-width="2"/>`;
      return `<text x="${o.x ?? 80}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${o.weight ?? 400}" fill="${o.color ?? "#111"}">${esc(text)}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
  <rect width="100%" height="100%" fill="#fdfcf8"/>
  <rect x="0" y="0" width="${W}" height="70" fill="#b5473a"/>
  <text x="${W / 2}" y="47" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">SAMPLE — SYNTHETIC — NOT A REAL DOCUMENT</text>
  ${body}
  <text x="${W / 2}" y="${height - 30}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#b5473a">Synthetic sample for the Parthia Health demo. No real patient.</text>
</svg>`;
}

const samples = [
  {
    file: "sample-prescription-harold.png",
    height: 1400,
    lines: [
      ["NORTHSIDE URGENT CARE", { size: 44, weight: 700 }],
      ["1450 Harbor Road, Riverside   Tel (555) 010-8800", { size: 26 }],
      ["---"],
      ["PRESCRIPTION", { size: 38, weight: 700, gap: 70 }],
      ["Date: 09/10/2026", { size: 30 }],
      ["Patient: Harold Okafor      DOB: 03/02/1958", { size: 30 }],
      ["Rx", { size: 56, weight: 700, gap: 90 }],
      ["Naproxen 500 mg tablet", { size: 36, weight: 700 }],
      ["Sig: Take 1 tablet by mouth twice daily with food for 10 days", { size: 30 }],
      ["for back pain", { size: 30 }],
      ["Disp: #20 (twenty) tablets     Refills: 0", { size: 30 }],
      ["---", { gap: 70 }],
      ["Prescriber: Dr. Kevin Liu, MD", { size: 30, gap: 60 }],
      ["NPI 0000000000 (sample)", { size: 26 }],
      ["Signature: K. Liu", { size: 30 }],
    ],
  },
  {
    file: "sample-lab-report-margaret.png",
    height: 1500,
    lines: [
      ["LAKESIDE MEDICAL LABORATORY", { size: 44, weight: 700 }],
      ["Clinical Laboratory Report", { size: 28 }],
      ["---"],
      ["Patient: Margaret Lindqvist     DOB: 06/19/1954", { size: 30, gap: 70 }],
      ["Collected: 09/09/2026     Reported: 09/10/2026", { size: 30 }],
      ["Ordering provider: Dr. Samuel Reyes, MD", { size: 30 }],
      ["BASIC METABOLIC PANEL", { size: 34, weight: 700, gap: 80 }],
      ["Test                    Result     Units        Reference Range", { size: 28, weight: 700 }],
      ["Sodium                  133  L     mmol/L       135 - 145", { size: 30 }],
      ["Potassium               3.3  L     mmol/L       3.5 - 5.1", { size: 30 }],
      ["Creatinine              1.2  H     mg/dL        0.5 - 1.0", { size: 30 }],
      ["eGFR                    49   L     mL/min       > 60", { size: 30 }],
      ["Glucose, fasting        162  H     mg/dL        70 - 100", { size: 30 }],
      ["---", { gap: 70 }],
      ["Results flagged H (high) or L (low) are outside the reference range.", { size: 26, gap: 60 }],
    ],
  },
  {
    file: "sample-visit-summary-rosa.png",
    height: 1400,
    lines: [
      ["MESA FAMILY PRACTICE", { size: 44, weight: 700 }],
      ["After-Visit Summary", { size: 30 }],
      ["---"],
      ["Patient: Rosa Delgado     Visit date: 09/05/2026", { size: 30, gap: 70 }],
      ["Provider: Dr. Marcus Bell, MD", { size: 30 }],
      ["Reason for visit: Thyroid and blood pressure follow-up", { size: 30 }],
      ["Your medications", { size: 34, weight: 700, gap: 80 }],
      ["Levothyroxine 75 mcg - take 1 tablet once daily, empty stomach", { size: 30 }],
      ["Vitamin D3 2000 units - take once daily with food (new)", { size: 30 }],
      ["Lisinopril 10 mg - take once daily", { size: 30 }],
      ["Today's vitals: BP 128/78   Pulse 72", { size: 30, gap: 70 }],
      ["Follow-up: TSH in 3 months", { size: 30 }],
    ],
  },
];

mkdirSync(OUT, { recursive: true });
for (const s of samples) {
  const svg = page(s.lines, s.height);
  // Rendered at 2× density (~200 DPI) — Tesseract reads larger glyphs much more reliably.
  const info = await sharp(Buffer.from(svg), { density: 144 }).png({ compressionLevel: 9, palette: true }).toFile(join(OUT, s.file));
  console.log(`${s.file}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
}
