"use client";

import { useState } from "react";
import { Card } from "@/components/PageHeader";
import { LocalOnlyNotice } from "@/components/passport/PassportChrome";
import { WrongPasscodeError, unlock } from "@/lib/passport/crypto";
import { passportStore } from "@/lib/passport/store";

/** Shown instead of the app while the Passport is locked. */
export function LockScreen() {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(passportStore, passcode);
      setPasscode("");
    } catch (err) {
      setError(err instanceof WrongPasscodeError ? "That passcode doesn't match. Try again." : "Couldn't unlock the Passport on this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card className="p-6">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-navy">Your Passport is locked</h1>
        <p className="mt-1 text-sm text-ink-soft">Enter your passcode to decrypt it on this device.</p>
        <LocalOnlyNotice className="mt-2" />
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm font-semibold text-ink" htmlFor="unlock-passcode">
            Passcode
          </label>
          <input
            id="unlock-passcode"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "unlock-error" : undefined}
            className="min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-base text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {error && (
            <p id="unlock-error" role="alert" className="text-sm font-semibold text-attention">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !passcode} className="min-h-11 w-full rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>

        <details className="mt-5 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-700">Forgot your passcode?</summary>
          <p className="mt-1 text-ink-soft">
            Your passcode can&apos;t be recovered — not by Parthia, not by anyone. The data is encrypted with a key made from it and never leaves this
            device. The only way forward is to erase this device&apos;s Passport data and start again (the sample data stays).
          </p>
          {erasing ? (
            <div role="alert" className="mt-3 rounded-xl border border-attention/30 bg-attention-soft p-3">
              <p className="font-semibold text-ink">Erase all Passport data on this device? This can&apos;t be undone.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => passportStore.reset()} className="min-h-11 rounded-full bg-attention px-4 font-semibold text-white">
                  Yes, erase
                </button>
                <button type="button" onClick={() => setErasing(false)} className="min-h-11 rounded-full px-4 font-semibold text-ink-soft ring-1 ring-line">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setErasing(true)} className="mt-3 min-h-11 rounded-full px-4 font-semibold text-attention ring-1 ring-attention/30 hover:bg-attention-soft">
              Erase Passport data on this device
            </button>
          )}
        </details>
      </Card>
    </div>
  );
}
