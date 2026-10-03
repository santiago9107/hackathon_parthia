import { describe, expect, it } from "vitest";
import type { Medication } from "../types";
import { addEntries } from "./actions";
import { createMemoryBackend } from "./backend";
import { PassportStore } from "./store";
import { WrongPasscodeError, createLock, decryptJson, disableLock, enableLock, encryptJson, lockNow, openLock, unlock } from "./crypto";

const FAST = 1_000; // iterations for tests; the app uses 600,000
const P = "p-harold";
const med: Medication = {
  id: "m-1", name: "Naproxen", genericName: "naproxen", class: "nsaid", dose: "500 mg", frequency: "twice daily", startDate: "2026-09-10",
  source: { kind: "patient-entered", label: "You", importedAt: "2026-10-03T09:00:00", verified: true },
};

describe("AES-GCM + PBKDF2", () => {
  it("round-trips JSON and rejects a wrong passcode", async () => {
    const { meta, key } = await createLock("correct horse", FAST);
    const blob = await encryptJson(key, { a: 1, s: "ünïcödé" });
    expect(blob.data).not.toMatch(/nïc/);
    expect(await decryptJson(await openLock(meta, "correct horse"), blob)).toEqual({ a: 1, s: "ünïcödé" });
    await expect(openLock(meta, "wrong horse")).rejects.toBeInstanceOf(WrongPasscodeError);
  });

  it("uses a fresh IV for every write and detects tampering", async () => {
    const { key } = await createLock("123456", FAST);
    const a = await encryptJson(key, "x");
    const b = await encryptJson(key, "x");
    expect(a.iv).not.toBe(b.iv);
    const tampered = { ...a, data: a.data.slice(0, -4) + (a.data.endsWith("AAAA") ? "BBBB" : "AAAA") };
    await expect(decryptJson(key, tampered)).rejects.toThrow();
  });
});

describe("Passport lock on the store", () => {
  it("encrypts at rest, locks, unlocks, and turns off", async () => {
    const backend = createMemoryBackend();
    const store = new PassportStore(backend);
    await addEntries(P, "medications", [med], undefined, store);

    await expect(enableLock(store, "123", FAST)).rejects.toThrow(/at least 6/);
    await enableLock(store, "open sesame", FAST);
    const [stored] = await backend.loadAll();
    expect(stored.value.kind).toBe("encrypted");
    expect(JSON.stringify(stored)).not.toMatch(/Naproxen/);
    // Still usable this session; new writes are encrypted too.
    await addEntries(P, "medications", [{ ...med, id: "m-2", name: "Omeprazole" }], undefined, store);
    expect(JSON.stringify(await backend.loadAll())).not.toMatch(/Omeprazole/);

    await lockNow(store);
    expect(store.getStatus()).toBe("locked");
    expect(store.get(P)).toBeUndefined();
    await expect(addEntries(P, "medications", [med], undefined, store)).rejects.toThrow(/locked/);

    // A fresh app start is locked too.
    const reopened = new PassportStore(backend);
    await reopened.ensureLoaded();
    expect(reopened.getStatus()).toBe("locked");
    await expect(unlock(reopened, "nope-nope")).rejects.toBeInstanceOf(WrongPasscodeError);
    await unlock(reopened, "open sesame");
    expect(reopened.getStatus()).toBe("ready");
    expect(reopened.get(P)!.entries.map((e) => (e.item as Medication).name)).toEqual(["Naproxen", "Omeprazole"]);

    await disableLock(reopened, "open sesame");
    expect((await backend.loadAll())[0].value.kind).toBe("plain");
    expect(await backend.getMeta("lock")).toBeUndefined();
  });

  it("stays locked on restart even if nothing was stored yet", async () => {
    const backend = createMemoryBackend();
    await enableLock(new PassportStore(backend), "open sesame", FAST);
    const s = new PassportStore(backend);
    await s.ensureLoaded();
    expect(s.getStatus()).toBe("locked");
  });

  it("forgetting the passcode: erasing is the only way out", async () => {
    const backend = createMemoryBackend();
    const store = new PassportStore(backend);
    await addEntries(P, "medications", [med], undefined, store);
    await enableLock(store, "open sesame", FAST);
    await lockNow(store);
    await store.reset();
    expect(store.getStatus()).toBe("ready");
    expect(await backend.loadAll()).toEqual([]);
    expect(await backend.getMeta("lock")).toBeUndefined();
  });
});
