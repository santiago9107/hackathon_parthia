import type { AppleHealthResult } from "./parser";
import type { WorkerMessage, WorkerRequest } from "./worker";

/** Parse an Apple Health export in a Web Worker (browser only). */
export function parseInWorker(
  req: WorkerRequest,
  onProgress?: (bytesRead: number, totalBytes: number) => void,
): Promise<AppleHealthResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === "progress") onProgress?.(m.bytesRead, m.totalBytes);
      else {
        worker.terminate();
        if (m.type === "done") resolve(m.result);
        else reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "The export couldn't be read."));
    };
    worker.postMessage(req);
  });
}
