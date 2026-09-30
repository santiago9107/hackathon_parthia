import type { LocalPassport } from "./collections";
import type { StoredRecord } from "./backend";
import { plainCodec, type PassportCodec, type PassportStore } from "./store";

/**
 * PASSPORT LOCK — optional passcode encryption of the local Passport.
 *
 * A key is derived from the passcode with PBKDF2 (SHA-256, random 16-byte
 * salt) and each stored Passport is encrypted with AES-GCM (256-bit key,
 * random 12-byte IV per write). Only the salt, iteration count and an
 * encrypted check value are stored; the passcode and key never are.
 *
 * There is no recovery: a forgotten passcode means the local data can't be
 * decrypted and has to be erased. The UI says so before locking.
 */

export const LOCK_META_KEY = "lock";
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_PASSCODE_LENGTH = 6;
const CHECK_VALUE = "parthia-passport-lock-v1";

export interface EncryptedBlob {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  data: string;
}

export interface LockMeta {
  v: 1;
  kdf: "PBKDF2-SHA256";
  salt: string;
  iterations: number;
  /** CHECK_VALUE encrypted with the key — tells a wrong passcode from corrupt data. */
  check: EncryptedBlob;
}

export class WrongPasscodeError extends Error {
  constructor() {
    super("That passcode doesn't match.");
    this.name = "WrongPasscodeError";
  }
}

/* ---- Encoding helpers ----------------------------------------------------- */

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const subtle = () => {
  if (!globalThis.crypto?.subtle) throw new Error("This browser can't encrypt data (Web Crypto is unavailable).");
  return globalThis.crypto.subtle;
};

/* ---- Primitives ------------------------------------------------------------ */

export async function deriveKey(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations = DEFAULT_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value))));
  return { v: 1, alg: "AES-GCM", iv: toB64(iv), data: toB64(data) };
}

/** Throws if the key is wrong or the data was altered (AES-GCM authenticates). */
export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const plain = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.data));
  return JSON.parse(dec.decode(plain)) as T;
}

export async function createLock(passcode: string, iterations = DEFAULT_ITERATIONS): Promise<{ meta: LockMeta; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passcode, salt, iterations);
  return { key, meta: { v: 1, kdf: "PBKDF2-SHA256", salt: toB64(salt), iterations, check: await encryptJson(key, CHECK_VALUE) } };
}

/** Derive the key for an existing lock; throws WrongPasscodeError on mismatch. */
export async function openLock(meta: LockMeta, passcode: string): Promise<CryptoKey> {
  const key = await deriveKey(passcode, fromB64(meta.salt), meta.iterations);
  try {
    if ((await decryptJson<string>(key, meta.check)) === CHECK_VALUE) return key;
  } catch {
    /* fall through */
  }
  throw new WrongPasscodeError();
}

export function encryptedCodec(key: CryptoKey): PassportCodec {
  return {
    async decode(r: StoredRecord) {
      if (r.value.kind === "plain") return r.value.passport; // written before the lock was set
      return decryptJson<LocalPassport>(key, r.value.blob as EncryptedBlob);
    },
    async encode(p: LocalPassport) {
      return { patientId: p.patientId, value: { kind: "encrypted", blob: await encryptJson(key, p) } };
    },
  };
}

/* ---- Store operations -------------------------------------------------------- */

export async function getLockMeta(store: PassportStore): Promise<LockMeta | undefined> {
  return store.backend.getMeta<LockMeta>(LOCK_META_KEY);
}

/** Turn the lock on: every stored Passport is re-written encrypted. */
export async function enableLock(store: PassportStore, passcode: string, iterations = DEFAULT_ITERATIONS): Promise<void> {
  if (passcode.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  await store.ensureLoaded();
  const { meta, key } = await createLock(passcode, iterations);
  await store.setCodec(encryptedCodec(key), { reload: false });
  await store.rewriteAll();
  await store.backend.setMeta(LOCK_META_KEY, meta);
}

/** Unlock for this session: decrypts into memory. */
export async function unlock(store: PassportStore, passcode: string): Promise<void> {
  const meta = await getLockMeta(store);
  if (!meta) return;
  const key = await openLock(meta, passcode);
  await store.setCodec(encryptedCodec(key), { reload: true });
}

/** Lock again now: forget the key and the decrypted copy in memory. */
export async function lockNow(store: PassportStore): Promise<void> {
  await store.setCodec(plainCodec, { reload: true });
}

/** Turn the lock off (needs the passcode): every Passport is re-written unencrypted. */
export async function disableLock(store: PassportStore, passcode: string): Promise<void> {
  const meta = await getLockMeta(store);
  if (!meta) return;
  const key = await openLock(meta, passcode);
  await store.setCodec(encryptedCodec(key), { reload: true });
  await store.setCodec(plainCodec, { reload: false });
  await store.rewriteAll();
  await store.backend.setMeta(LOCK_META_KEY, undefined);
}
