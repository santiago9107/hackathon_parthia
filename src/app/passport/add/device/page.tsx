"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice, fmtDateTime } from "@/components/passport/PassportChrome";
import { ReadingsPreview } from "@/components/passport/ReadingsPreview";
import { usePatient } from "@/lib/context/PatientContext";
import { REFERENCE_DATE, demoTimestamp } from "@/lib/mockData";
import { addReviewedBatch, importForReview, saveConnection } from "@/lib/passport/actions";
import { planImport } from "@/lib/passport/importPlan";
import { bluetoothSupport, connectBluetoothCuff, simulateBpSync, vitalFromMeasurement } from "@/lib/devices/bpMonitor";
import type { VitalSign } from "@/lib/types";

const noop = () => () => {};
// useSyncExternalStore needs a stable snapshot: compute browser support once.
let supportSnapshot: ReturnType<typeof bluetoothSupport> | undefined;
const getSupport = () => (supportSnapshot ??= bluetoothSupport());

export default function DevicePage() {
  const { patientId, record } = usePatient();
  // Browser capability — read once on the client, "unknown" during prerender.
  const support = useSyncExternalStore(noop, getSupport, () => null);
  const [pending, setPending] = useState<{ readings: VitalSign[]; duplicates: number; simulated: boolean; name: string } | null>(null);
  const [live, setLive] = useState<{ name: string; readings: VitalSign[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => () => disconnectRef.current?.(), []);

  function preview(readings: VitalSign[], simulated: boolean, name: string) {
    const plan = planImport({ vitals: readings }, record);
    setPending({ readings: plan.batch.vitals ?? [], duplicates: plan.duplicates.vitals ?? 0, simulated, name });
    setStatus(null);
  }

  async function connect() {
    setError(null);
    try {
      const conn = await connectBluetoothCuff((m) =>
        setLive((l) => ({ name: l?.name ?? "Blood pressure monitor", readings: [...(l?.readings ?? []), vitalFromMeasurement(m, patientId, l?.name ?? "Blood pressure monitor", demoTimestamp())] })),
      );
      disconnectRef.current = conn.disconnect;
      setLive({ name: conn.name, readings: [] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/cancel|chosen|no device/i.test(msg) ? "No monitor was selected." : msg);
    }
  }

  async function finish(confirm: boolean) {
    if (!pending) return;
    const now = new Date().toISOString();
    if (confirm) await addReviewedBatch(patientId, { vitals: pending.readings }, `${pending.name}: ${pending.readings.length} readings confirmed`, "device");
    else await importForReview(patientId, { vitals: pending.readings }, "device", pending.name);
    await saveConnection(patientId, { id: pending.simulated ? "bp-monitor-simulated" : "bp-monitor-ble", kind: "device", name: pending.name, status: "connected", simulated: pending.simulated, connectedAt: now, lastImportAt: now });
    setStatus(confirm ? `${pending.readings.length} readings added to your Passport.` : `${pending.readings.length} readings are waiting in Review.`);
    setPending(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/passport/add/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">← Add to my Passport</Link>
        <h2 className="font-serif text-2xl font-semibold text-navy">Blood pressure monitor</h2>
        <p className="mt-1 text-sm text-ink-soft">Bring in readings from a home blood pressure cuff.</p>
        <LocalOnlyNotice className="mt-2" />
      </div>

      {status && (
        <Card className="p-5" accent="border-l-good">
          <p role="status" className="font-serif text-lg font-semibold text-navy">✓ {status}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/passport/clinical/" className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">See vitals</Link>
            <Link href="/trends/" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-brand-700 ring-1 ring-line">See trends</Link>
          </div>
        </Card>
      )}

      {pending ? (
        <>
          {pending.simulated && <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm font-semibold text-[#5c430d]">Simulated readings — generated for this demo, not from a real device.</p>}
          <ReadingsPreview readings={pending.readings} duplicates={pending.duplicates} onConfirm={() => finish(true)} onLater={() => finish(false)} onDiscard={() => setPending(null)} />
        </>
      ) : (
        <>
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-navy">Sync device (simulated)</h3>
            <p className="mt-1 text-sm text-ink-soft">Generates a realistic 14-day series of morning and evening readings ending {fmtDateTime(`${REFERENCE_DATE}T08:00:00`).split(",").slice(0, 2).join(",")}, as a cuff&apos;s app would sync them. Clearly labelled as simulated.</p>
            <button type="button" onClick={() => preview(simulateBpSync(patientId, REFERENCE_DATE), true, "Blood pressure monitor (simulated)")} className="mt-4 min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              Sync device (simulated)
            </button>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-navy">Connect a Bluetooth monitor</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Works with cuffs that use the standard Bluetooth Blood Pressure Profile (service 0x1810). Put the cuff in pairing mode, connect, then take a reading.
            </p>
            {support === null ? null : support.supported ? (
              live ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-good">Connected to {live.name}. Take a reading on the cuff.</p>
                  <ul className="mt-2 text-sm">
                    {live.readings.map((r) => <li key={r.id} className="border-b border-line py-1.5">{fmtDateTime(r.timestamp)} — <strong>{r.systolic}/{r.diastolic}</strong>{r.heartRate ? ` · ${r.heartRate} bpm` : ""}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={live.readings.length === 0} onClick={() => { preview(live.readings, false, live.name); disconnectRef.current?.(); setLive(null); }} className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white disabled:opacity-50">Review {live.readings.length} reading{live.readings.length === 1 ? "" : "s"}</button>
                    <button type="button" onClick={() => { disconnectRef.current?.(); setLive(null); }} className="min-h-12 rounded-full px-5 text-sm font-semibold text-ink-soft ring-1 ring-line">Disconnect</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => void connect()} className="mt-4 min-h-12 rounded-full bg-surface px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">Connect via Bluetooth</button>
              )
            ) : (
              <p className="mt-4 rounded-xl bg-cream/70 p-3 text-sm text-ink-soft"><strong className="text-ink">Bluetooth isn&apos;t available here.</strong> {support.reason} You can still use the simulated sync, or log readings by hand.</p>
            )}
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-attention">{error}</p>}
          </Card>

          <p className="text-sm text-ink-muted">Prefer to type it in? <Link href="/log/vitals/" className="font-semibold text-brand-700 hover:text-brand-900">Log a reading by hand →</Link></p>
        </>
      )}
      <Disclaimer />
    </div>
  );
}
