import { loadImage } from "../ocr/engine";

/** Small enough to keep several meal photos in the local Passport. */
export const MAX_MEAL_PHOTO_BYTES = 350_000;
export const MAX_MEAL_PHOTO_INPUT_BYTES = 15_000_000;

/** Approximate decoded byte size of a base64 data URL without allocating it again. */
export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Make a bounded JPEG preview in the browser. The original image is never
 * persisted. Repeatedly shrinking also handles unusually detailed photos.
 */
export async function compactMealPhoto(src: Blob): Promise<string> {
  if (!src.type.startsWith("image/")) throw new Error("Please choose a photo or image file.");
  if (src.size > MAX_MEAL_PHOTO_INPUT_BYTES) throw new Error("That photo is larger than 15 MB. Please choose a smaller image.");

  let canvas = await loadImage(src, 960);
  for (let attempt = 0; attempt < 7; attempt++) {
    const quality = Math.max(0.42, 0.78 - attempt * 0.06);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlByteLength(dataUrl) <= MAX_MEAL_PHOTO_BYTES) return dataUrl;

    const smaller = document.createElement("canvas");
    smaller.width = Math.max(320, Math.round(canvas.width * 0.82));
    smaller.height = Math.max(320, Math.round(canvas.height * 0.82));
    smaller.getContext("2d")?.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
  }
  throw new Error("This photo could not be made small enough to store. Try a simpler or smaller image.");
}
