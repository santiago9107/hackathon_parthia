/** Save a JSON value as a file on this device (no upload — the Blob never leaves the browser). */
export function downloadJson(fileName: string, value: unknown, type = "application/json"): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
