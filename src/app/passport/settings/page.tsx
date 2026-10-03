"use client";

import { useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice, SectionTitle } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { resetDemoData } from "@/lib/passport/actions";
import { ExportImport } from "@/components/passport/ExportImport";
import { LockSettings } from "@/components/passport/LockSettings";

export default function PassportSettingsPage() {
  const { patientId, record, local } = usePatient();
  const [confirming, setConfirming] = useState<"one" | "all" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const stored = local?.entries.length ?? 0;

  async function reset(scope: "one" | "all") {
    await resetDemoData(scope === "one" ? patientId : undefined);
    setConfirming(null);
    setMessage(scope === "one" ? `Local data for ${record.patient.name} was deleted.` : "All local Passport data on this device was deleted.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-navy">Passport settings</h2>
        <LocalOnlyNotice className="mt-1" />
      </div>

      <ExportImport />
      <LockSettings />

      <Card className="p-5">
        <SectionTitle>Reset demo data</SectionTitle>
        <p className="text-sm text-ink-soft">
          Deletes what this device stores — your entries, imports, edits and activity log — and returns to the sample data that ships with the
          demo. This can&apos;t be undone.
        </p>
        <p className="mt-2 text-sm text-ink-muted">{record.patient.name}: {stored} locally stored item{stored === 1 ? "" : "s"}.</p>
        {confirming ? (
          <div role="alert" className="mt-4 rounded-xl border border-attention/30 bg-attention-soft p-4 text-sm">
            <p className="font-semibold text-ink">
              {confirming === "one" ? `Delete local data for ${record.patient.name}?` : "Delete ALL local Passport data on this device?"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => reset(confirming)} className="min-h-11 rounded-full bg-attention px-4 font-semibold text-white">Yes, delete</button>
              <button type="button" onClick={() => setConfirming(null)} className="min-h-11 rounded-full px-4 font-semibold text-ink-soft ring-1 ring-line">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setMessage(null); setConfirming("one"); }} className="min-h-11 rounded-full px-4 text-sm font-semibold text-attention ring-1 ring-attention/30 hover:bg-attention-soft">
              Reset {record.patient.name.split(" ")[0]}&apos;s Passport
            </button>
            <button type="button" onClick={() => { setMessage(null); setConfirming("all"); }} className="min-h-11 rounded-full px-4 text-sm font-semibold text-attention ring-1 ring-attention/30 hover:bg-attention-soft">
              Reset everything on this device
            </button>
          </div>
        )}
        {message && <p role="status" className="mt-3 text-sm font-semibold text-good">{message}</p>}
      </Card>
      <Disclaimer />
    </div>
  );
}
