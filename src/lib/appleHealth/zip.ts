/**
 * MINIMAL STREAMING ZIP READER (no libraries)
 *
 * Apple Health exports are a zip containing apple_health_export/export.xml,
 * which can be several gigabytes. We never load the whole file: we read the
 * central directory from the end of the zip, locate one entry, and stream
 * just that entry through DecompressionStream("deflate-raw"). Supports ZIP64
 * (exports over 4 GB) and stored (uncompressed) entries.
 */

export interface ZipEntry {
  name: string;
  method: number; // 0 = stored, 8 = deflate
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

async function bytes(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

function u64(v: DataView, off: number): number {
  return Number(v.getBigUint64(off, true));
}

export async function listZipEntries(blob: Blob): Promise<ZipEntry[]> {
  // EOCD is at most 22 + 65535 bytes from the end.
  const tailStart = Math.max(0, blob.size - (22 + 65535));
  const tail = await bytes(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn't look like a zip file.");

  let entryCount = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  // ZIP64: sizes/offsets that don't fit in 32 bits live in the ZIP64 EOCD record.
  if (cdOffset === 0xffffffff || entryCount === 0xffff || cdSize === 0xffffffff) {
    const locAt = eocd - 20;
    if (locAt >= 0 && tail.getUint32(locAt, true) === SIG_ZIP64_LOCATOR) {
      const z64Offset = u64(tail, locAt + 8);
      const z = await bytes(blob, z64Offset, z64Offset + 56);
      if (z.getUint32(0, true) !== SIG_ZIP64_EOCD) throw new Error("Damaged ZIP64 export.");
      entryCount = u64(z, 32);
      cdSize = u64(z, 40);
      cdOffset = u64(z, 48);
    }
  }

  const cd = await bytes(blob, cdOffset, cdOffset + cdSize);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < entryCount && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== SIG_CENTRAL) throw new Error("Damaged zip directory.");
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let uncompressedSize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let localHeaderOffset = cd.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // ZIP64 extended information extra field (0x0001).
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const size = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressedSize === 0xffffffff) { uncompressedSize = u64(cd, q); q += 8; }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cd, q); q += 8; }
        if (localHeaderOffset === 0xffffffff) { localHeaderOffset = u64(cd, q); }
      }
      e += 4 + size;
    }
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** A stream of the (decompressed) bytes of one entry. */
export async function openZipEntry(blob: Blob, entry: ZipEntry): Promise<ReadableStream<Uint8Array>> {
  const lh = await bytes(blob, entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (lh.getUint32(0, true) !== SIG_LOCAL) throw new Error("Damaged zip entry.");
  const dataStart = entry.localHeaderOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
  const raw = blob.slice(dataStart, dataStart + entry.compressedSize).stream();
  if (entry.method === 0) return raw;
  if (entry.method === 8) return raw.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  throw new Error(`Unsupported zip compression method ${entry.method}.`);
}

/** Find export.xml in an Apple Health export (zip) — or accept a bare export.xml. */
export async function openAppleHealthXml(file: Blob & { name?: string }): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (!isZip) return { stream: file.stream(), size: file.size };
  const entries = await listZipEntries(file);
  const xml = entries.find((e) => /(^|\/)export\.xml$/i.test(e.name));
  if (!xml) throw new Error("No export.xml in this zip. Choose the export.zip from the Health app.");
  return { stream: await openZipEntry(file, xml), size: xml.uncompressedSize };
}
