/// <reference lib="webworker" />
/**
 * Web Worker: parses an Apple Health export off the main thread so the page
 * stays responsive for large files. Receives the File, streams it, and posts
 * progress and the result back.
 */
import { decodeWithProgress, parseAppleHealth, type AppleHealthOptions, type AppleHealthResult } from "./parser";
import { openAppleHealthXml } from "./zip";

export type WorkerRequest = { file: Blob } & Omit<AppleHealthOptions, "onProgress">;
export type WorkerMessage =
  | { type: "progress"; bytesRead: number; totalBytes: number }
  | { type: "done"; result: AppleHealthResult }
  | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { file, ...opts } = e.data;
  try {
    const { stream, size } = await openAppleHealthXml(file);
    let last = 0;
    const text = decodeWithProgress(stream, (bytesRead) => {
      if (bytesRead - last > 2_000_000 || bytesRead === size) {
        last = bytesRead;
        ctx.postMessage({ type: "progress", bytesRead, totalBytes: size } satisfies WorkerMessage);
      }
    });
    const result = await parseAppleHealth(text, opts);
    ctx.postMessage({ type: "done", result } satisfies WorkerMessage);
  } catch (err) {
    ctx.postMessage({ type: "error", message: err instanceof Error ? err.message : "Couldn't read this export." } satisfies WorkerMessage);
  }
};
