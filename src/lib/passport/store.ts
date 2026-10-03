import type { ISODateTime, PatientId } from "../types";
import { createIndexedDbBackend, createMemoryBackend, type PassportBackend, type StoredRecord } from "./backend";
import { emptyPassport, type LocalPassport } from "./collections";

/**
 * PASSPORT STORE
 *
 * Holds every patient's locally stored Passport in memory, persisted to the
 * backend (IndexedDB in the browser). Reads are synchronous — `get()` returns
 * the cached snapshot — so `getRecord()` can stay synchronous; React tracks
 * changes through `subscribe` / `getVersion` with useSyncExternalStore.
 *
 * All data is processed and stored on this device only.
 */
export type StoreStatus = "idle" | "loading" | "ready" | "locked" | "error";

/** Turns stored values into passports and back (plain now; encrypted when locked — see crypto.ts). */
export interface PassportCodec {
  decode(record: StoredRecord): Promise<LocalPassport | null>;
  encode(passport: LocalPassport): Promise<StoredRecord>;
}

export const plainCodec: PassportCodec = {
  async decode(r) {
    return r.value.kind === "plain" ? r.value.passport : null;
  },
  async encode(p) {
    return { patientId: p.patientId, value: { kind: "plain", passport: p } };
  },
};

export class PassportStore {
  private cache = new Map<PatientId, LocalPassport>();
  private listeners = new Set<() => void>();
  private version = 0;
  private status: StoreStatus = "idle";
  private error: string | null = null;
  private loadPromise: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private codec: PassportCodec = plainCodec;

  constructor(
    readonly backend: PassportBackend,
    private clock: () => ISODateTime = () => new Date().toISOString(),
  ) {}

  /* ---- useSyncExternalStore plumbing (stable arrow functions) ---------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.ensureLoaded();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;
  getStatus = (): StoreStatus => this.status;
  getError = (): string | null => this.error;

  private bump() {
    this.version++;
    for (const l of this.listeners) l();
  }

  /* ---- Reading ---------------------------------------------------------- */

  get(patientId: PatientId): LocalPassport | undefined {
    return this.cache.get(patientId);
  }

  now(): ISODateTime {
    return this.clock();
  }

  ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.load();
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    this.status = "loading";
    try {
      const records = await this.backend.loadAll();
      let locked = false;
      for (const r of records) {
        const p = await this.codec.decode(r);
        if (p) this.cache.set(r.patientId, p);
        else locked = true;
      }
      // A lock with no key loaded stays locked even when nothing is stored yet,
      // so new writes can't slip out unencrypted.
      if (this.codec === plainCodec && (await this.backend.getMeta("lock"))) locked = true;
      this.status = locked ? "locked" : "ready";
    } catch (e) {
      this.status = "error";
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.bump();
  }

  /** Swap the codec (used by the Passport lock) and reload everything through it. */
  async setCodec(codec: PassportCodec, { reload }: { reload: boolean }): Promise<void> {
    await this.writes.catch(() => undefined);
    this.codec = codec;
    if (reload) {
      this.cache.clear();
      this.loadPromise = this.load();
      await this.loadPromise;
    } else this.bump();
  }

  /** Whether stored Passports are written through a non-plain codec. */
  isEncrypting(): boolean {
    return this.codec !== plainCodec;
  }

  /** Re-write every cached passport through the current codec (e.g. after locking). */
  async rewriteAll(): Promise<void> {
    for (const p of this.cache.values()) await this.persist(p);
  }

  /* ---- Writing ---------------------------------------------------------- */

  /**
   * Apply a pure change to one patient's Passport. The in-memory snapshot
   * updates immediately; persistence is queued so writes stay in order.
   */
  async update(patientId: PatientId, change: (p: LocalPassport, at: ISODateTime) => LocalPassport): Promise<LocalPassport> {
    await this.ensureLoaded();
    if (this.status === "locked") throw new Error("The Passport is locked. Unlock it to make changes.");
    const before = this.cache.get(patientId) ?? emptyPassport(patientId);
    const after = change(before, this.clock());
    if (after === before) return before;
    this.cache.set(patientId, after);
    this.bump();
    const write = this.writes.catch(() => undefined).then(() => this.persist(after));
    this.writes = write;
    await write;
    return after;
  }

  /** Replace a whole passport (restore from an exported file). */
  async replace(passport: LocalPassport): Promise<void> {
    await this.update(passport.patientId, () => passport);
  }

  private async persist(p: LocalPassport): Promise<void> {
    await this.backend.put(await this.codec.encode(p));
  }

  /** Delete local data for one patient, or for everyone. Seed data is untouched. */
  async reset(patientId?: PatientId): Promise<void> {
    await this.ensureLoaded();
    await this.writes;
    if (patientId) {
      this.cache.delete(patientId);
      await this.backend.remove(patientId);
    } else {
      this.cache.clear();
      await this.backend.clear();
      this.codec = plainCodec;
      this.status = "ready";
    }
    this.bump();
  }

  /** For tests / diagnostics. */
  snapshot(patientId: PatientId): LocalPassport {
    return this.cache.get(patientId) ?? emptyPassport(patientId);
  }
}

function defaultBackend(): PassportBackend {
  if (typeof indexedDB !== "undefined") {
    try {
      return createIndexedDbBackend();
    } catch {
      /* fall through */
    }
  }
  return createMemoryBackend();
}

/** The app-wide store. On the server (static prerender) it is empty and in-memory. */
export const passportStore = new PassportStore(defaultBackend());
