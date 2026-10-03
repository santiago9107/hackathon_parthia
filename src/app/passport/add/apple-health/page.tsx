"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice } from "@/components/passport/PassportChrome";
import { ReadingsPreview } from "@/components/passport/ReadingsPreview";
import { usePatient } from "@/lib/context/PatientContext";
import { REFERENCE_DATE } from "@/lib/mockData";
import { addReviewedBatch, importForReview, saveConnection } from "@/lib/passport/actions";
import { planImport } from "@/lib/passport/importPlan";
import type { AppleHealthResult } from "@/lib/appleHealth/parser";
import type { VitalSign } from "@/lib/types";

type Step = "choose" | "reading" | "preview" | "done" | "error";
const WINDOWS = [{ days: 30, label: "Last 30 days" }, { days: 90, label: "Last 90 days" }, { days: 365, label: "Last year" }];

function sinceDate(days: number): string {
  const d = new Date(`${REFERENCE_DATE}T12:00:00`);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export default function AppleHealthPage() {
  const { patientId, record } = usePatient();
  const [step, setStep] = useState<Step>("choose");
  const [days, setDays] = useState(30);
  const [progress, setProgress] = useState({ read: 0, total: 0 });
  const [result, setResult] = useState<AppleHealthResult | null>(null);
  const [readings, setReadings] = useState<VitalSign[]>([]);
  const [dupes, setDupes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function parse(file: Blob) {
    setStep("reading");
    setProgress({ read: 0, total: file.size });
    try {
      const { parseInWorker } = await import("@/lib/appleHealth/client");
      const r = await parseInWorker({ file, patientId, since: sinceDate(days), until: REFERENCE_DATE, importedAt: new Date().toISOString() }, (read, total) => setProgress({ read, total }));
      const plan = planImport({ vitals: r.vitals }, record);
      setResult(r);
      setReadings(plan.batch.vitals ?? []);
      setDupes(plan.duplicates.vitals ?? 0);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this export.");
      setStep("error");
    }
  }

  async function trySample() {
    const res = await fetch("/samples/apple-health-export-sample.zip");
    await parse(await res.blob());
  }

  async function finish(confirm: boolean) {
    const now = new Date().toISOString();
    if (confirm) await addReviewedBatch(patientId, { vitals: readings }, `Apple Health export: ${readings.length} readings confirmed`, "wearable");
    else await importForReview(patientId, { vitals: readings }, "wearable", "Apple Health export");
    await saveConnection(patientId, { id: "apple-health", kind: "wearable", name: "Apple Health", status: "connected", simulated: false, connectedAt: now, lastImportAt: now });
    setMessage(confirm ? `${readings.length} readings added to your Passport.` : `${readings.length} readings are waiting in Review.`);
    setStep("done");
  }

  const pct = progress.total ? Math.min(100, Math.round((progress.read / progress.total) * 100)) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/passport/add/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">← Add to my Passport</Link>
        <h2 className="font-serif text-2xl font-semibold text-navy">Import from Apple Health</h2>
        <p className="mt-1 text-sm text-ink-soft">Heart rate, resting heart rate, blood pressure, steps, sleep and weight from the Health app on your iPhone.</p>
        <LocalOnlyNotice className="mt-2" />
      </div>

      <Card className="p-5">
        <h3 className="font-serif text-lg font-semibold text-navy">How to export your Health data</h3>
        <p className="mt-1 text-sm text-ink-soft">A website can&apos;t read Apple Health directly — only apps installed from the App Store can. The Health app can export everything to a file instead:</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink">
          <li>On your iPhone, open the <strong>Health</strong> app.</li>
          <li>Tap your <strong>profile picture</strong> (top right).</li>
          <li>Scroll down and tap <strong>Export All Health Data</strong>, then <strong>Export</strong>. It can take a few minutes.</li>
          <li>Save <strong>export.zip</strong> to Files (or AirDrop it to your computer).</li>
          <li>Choose that file below. It&apos;s read on this device — large exports are fine.</li>
        </ol>
      </Card>

      {(step === "choose" || step === "error") && (
        <Card className="p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Import readings from</legend>
            <div className="flex flex-wrap gap-2">
              {WINDOWS.map((w) => (
                <label key={w.days} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-medium ring-1 focus-within:ring-2 focus-within:ring-brand-500 ${days === w.days ? "bg-brand-700 text-white ring-brand-700" : "bg-surface text-ink-soft ring-line-strong"}`}>
                  <input type="radio" name="window" className="sr-only" checked={days === w.days} onChange={() => setDays(w.days)} />
                  {w.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">Choose export.zip</button>
            <button type="button" onClick={() => void trySample()} className="min-h-12 rounded-full bg-surface px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">Try the sample export</button>
            <input ref={fileRef} type="file" accept=".zip,.xml,application/zip,text/xml" className="sr-only" tabIndex={-1} aria-label="Choose your Apple Health export file"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void parse(f); }} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">The sample is a SYNTHETIC export for Harold (iPhone + Watch), not real data.</p>
          {step === "error" && <p role="alert" className="mt-3 text-sm font-semibold text-attention">{error}</p>}
        </Card>
      )}

      {step === "reading" && (
        <Card className="p-5">
          <p className="font-semibold text-ink">Reading your export…</p>
          <div className="mt-3 h-2.5 rounded-full bg-cream-dark" role="progressbar" aria-label="Reading the export" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-2.5 rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">{(progress.read / 1_048_576).toFixed(1)} of {(progress.total / 1_048_576).toFixed(1)} MB · processed in the background on this device</p>
        </Card>
      )}

      {step === "preview" && result && (
        <>
          <p className="text-sm text-ink-soft">
            Scanned {result.counts.recordsSeen.toLocaleString("en-US")} records from {result.sources.join(", ")}; {result.counts.recordsInRange.toLocaleString("en-US")} fall in your chosen period.
          </p>
          <ReadingsPreview readings={readings} duplicates={dupes} onConfirm={() => finish(true)} onLater={() => finish(false)} onDiscard={() => setStep("choose")} />
        </>
      )}

      {step === "done" && (
        <Card className="p-5" accent="border-l-good">
          <p role="status" className="font-serif text-xl font-semibold text-navy">✓ {message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/passport/clinical/" className="inline-flex min-h-12 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">See vitals</Link>
            <Link href="/trends/" className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">See trends</Link>
          </div>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}
