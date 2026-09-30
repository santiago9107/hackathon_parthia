import type { PatientId } from "../types";
import type { LocalPassport } from "./collections";

/**
 * Where local Passports are persisted. The browser uses IndexedDB; tests and
 * the server-side prerender use the in-memory backend.
 *
 * Values are opaque to the backend so an encryption layer can wrap it later
 * (see `crypto.ts`): it stores whatever `StoredValue` it is given.
 */
export type StoredValue = { kind: "plain"; passport: LocalPassport } | { kind: "encrypted"; blob: unknown };

export interface StoredRecord {
  patientId: PatientId;
  value: StoredValue;
}

export interface PassportBackend {
  readonly name: string;
  loadAll(): Promise<StoredRecord[]>;
  put(record: StoredRecord): Promise<void>;
  remove(patientId: PatientId): Promise<void>;
  clear(): Promise<void>;
  /** Small key/value settings (e.g. lock parameters). */
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T | undefined): Promise<void>;
}

/* ---- In-memory ------------------------------------------------------------ */

export function createMemoryBackend(): PassportBackend {
  const records = new Map<PatientId, StoredRecord>();
  const meta = new Map<string, unknown>();
  const clone = <T,>(v: T): T => (v === undefined ? v : structuredClone(v));
  return {
    name: "memory",
    async loadAll() {
      return [...records.values()].map(clone);
    },
    async put(r) {
      records.set(r.patientId, clone(r));
    },
    async remove(id) {
      records.delete(id);
    },
    async clear() {
      records.clear();
      meta.clear();
    },
    async getMeta<T>(key: string) {
      return clone(meta.get(key)) as T | undefined;
    },
    async setMeta<T>(key: string, value: T | undefined) {
      if (value === undefined) meta.delete(key);
      else meta.set(key, clone(value));
    },
  };
}

/* ---- IndexedDB (no libraries) --------------------------------------------- */

const DB_NAME = "parthia-passport";
const DB_VERSION = 1;
const PASSPORTS = "passports";
const META = "meta";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function createIndexedDbBackend(factory: IDBFactory = indexedDB): PassportBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;
  function db(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const open = factory.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const d = open.result;
          if (!d.objectStoreNames.contains(PASSPORTS)) d.createObjectStore(PASSPORTS, { keyPath: "patientId" });
          if (!d.objectStoreNames.contains(META)) d.createObjectStore(META);
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
    }
    return dbPromise;
  }

  async function run(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => void): Promise<void> {
    const tx = (await db()).transaction(store, mode);
    fn(tx.objectStore(store));
    await done(tx);
  }

  return {
    name: "indexeddb",
    async loadAll() {
      const tx = (await db()).transaction(PASSPORTS, "readonly");
      return req(tx.objectStore(PASSPORTS).getAll() as IDBRequest<StoredRecord[]>);
    },
    put: (r) => run(PASSPORTS, "readwrite", (s) => s.put(r)),
    remove: (id) => run(PASSPORTS, "readwrite", (s) => s.delete(id)),
    async clear() {
      await run(PASSPORTS, "readwrite", (s) => s.clear());
      await run(META, "readwrite", (s) => s.clear());
    },
    async getMeta<T>(key: string) {
      const tx = (await db()).transaction(META, "readonly");
      return req(tx.objectStore(META).get(key) as IDBRequest<T | undefined>);
    },
    setMeta: <T,>(key: string, value: T | undefined) =>
      run(META, "readwrite", (s) => (value === undefined ? s.delete(key) : s.put(value, key))),
  };
}
