"use client";

import { useState } from "react";
import { Card } from "@/components/PageHeader";
import { SectionTitle } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { recordActivity } from "@/lib/passport/actions";
import { MIN_PASSCODE_LENGTH, WrongPasscodeError, disableLock, enableLock, lockNow } from "@/lib/passport/crypto";
import { passportStore } from "@/lib/passport/store";

const input =
  "min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-base text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function LockSettings() {
  const { patientId, passportStatus } = usePatient();
  const locked = passportStatus === "ready" && passportStore.isEncrypting();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = () => {
    setPass("");
    setConfirm("");
    setUnderstood(false);
    setError(null);
  };

  async function turnOn(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < MIN_PASSCODE_LENGTH) return setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
    if (pass !== confirm) return setError("The two passcodes don't match.");
    if (!understood) return setError("Please confirm you understand a forgotten passcode can't be recovered.");
    setBusy(true);
    setError(null);
    try {
      await enableLock(passportStore, pass);
      await recordActivity(patientId, "lock", "Turned on the Passport lock (AES-GCM encryption on this device)");
      reset();
      setMessage("Your Passport is now encrypted on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn on the lock.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await disableLock(passportStore, pass);
      await recordActivity(patientId, "unlock", "Turned off the Passport lock");
      reset();
      setMessage("The lock is off. Your Passport is stored unencrypted on this device.");
    } catch (err) {
      setError(err instanceof WrongPasscodeError ? "That passcode doesn't match." : "Couldn't turn off the lock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle>Passport lock</SectionTitle>
      {locked ? (
        <>
          <p className="text-sm text-ink-soft">
            <strong className="text-good">On.</strong> Your Passport is encrypted on this device (AES-GCM, with a key derived from your passcode by
            PBKDF2). You&apos;ll need the passcode each time the app opens.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => lockNow(passportStore)} className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
              Lock now
            </button>
          </div>
          <form onSubmit={turnOff} className="mt-5 max-w-sm space-y-2 border-t border-line pt-4">
            <label htmlFor="lock-off" className="block text-sm font-semibold text-ink">Turn off the lock — enter your passcode</label>
            <input id="lock-off" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} className={input} />
            <button type="submit" disabled={busy || !pass} className="min-h-11 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50 disabled:opacity-50">
              {busy ? "Working…" : "Turn off lock"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Optional. Encrypt your Passport on this device with a passcode, so someone using this browser can&apos;t read it. Sample data isn&apos;t
            encrypted — it ships with the demo.
          </p>
          <div role="note" className="mt-3 rounded-xl border border-attention/30 bg-attention-soft p-3 text-sm text-ink">
            <strong>A forgotten passcode can&apos;t be recovered.</strong> There is no reset link and no copy of your key anywhere. If you forget it, the
            only option is to erase this device&apos;s Passport data. Consider exporting a Passport file first.
          </div>
          <form onSubmit={turnOn} className="mt-4 max-w-sm space-y-3">
            <div>
              <label htmlFor="lock-pass" className="block text-sm font-semibold text-ink">New passcode</label>
              <input id="lock-pass" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className={input} aria-describedby="lock-hint" />
              <p id="lock-hint" className="mt-1 text-xs text-ink-muted">At least {MIN_PASSCODE_LENGTH} characters.</p>
            </div>
            <div>
              <label htmlFor="lock-confirm" className="block text-sm font-semibold text-ink">Confirm passcode</label>
              <input id="lock-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
            </div>
            <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 h-5 w-5 accent-brand-700" />
              I understand that if I forget this passcode, my Passport data on this device can&apos;t be recovered.
            </label>
            <button type="submit" disabled={busy || passportStatus !== "ready"} className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
              {busy ? "Encrypting…" : "Lock my Passport"}
            </button>
          </form>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-attention">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm font-semibold text-good">{message}</p>}
    </Card>
  );
}
