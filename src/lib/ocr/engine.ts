import type { OcrLine } from "./extract";

/**
 * ON-DEVICE OCR (browser only)
 *
 * Tesseract.js runs in a Web Worker with its WebAssembly core and English
 * data served from /ocr/ (copied from node_modules by
 * scripts/copy-ocr-assets.mjs) — no CDN calls, works offline, and the image
 * never leaves the device. The library is loaded on demand so it isn't part
 * of the main app bundle.
 */

export interface OcrProgress {
  status: string;
  /** 0–1 */
  progress: number;
}

export interface OcrResult {
  lines: OcrLine[];
  text: string;
  /** 0–100 */
  confidence: number;
}

const OCR_PATHS = {
  workerPath: "/ocr/worker.min.js",
  corePath: "/ocr/core",
  langPath: "/ocr/lang",
} as const;

/** Load an image file/URL onto a canvas, downscaled so the longest side is at most `max` px. */
export async function loadImage(src: Blob | string, max: number): Promise<HTMLCanvasElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    // Wait for "load" rather than img.decode(): decode() can stall while the page is in the background.
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("That image couldn't be opened. Try a JPEG or PNG photo."));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

/** A compact JPEG copy to keep in the Documents library (only if the patient chooses to save it). */
export async function thumbnailDataUrl(src: Blob | string, max = 1100): Promise<string> {
  return (await loadImage(src, max)).toDataURL("image/jpeg", 0.72);
}

export async function recognize(src: Blob | string, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.({ status: "Preparing the image", progress: 0 });
  const canvas = await loadImage(src, 2600);
  const worker = await createWorker("eng", 1 /* LSTM */, {
    ...OCR_PATHS,
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) =>
      onProgress?.({ status: m.status === "recognizing text" ? "Reading the text" : "Loading the text reader", progress: m.progress }),
  });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text.trim(), confidence: l.confidence }))))
      .filter((l) => l.text.length > 0);
    return { lines, text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
