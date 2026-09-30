"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/PageHeader";
import { SectionTitle, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { recordActivity } from "@/lib/passport/actions";
import { describeCounts } from "@/lib/passport/ops";
import { downloadJson } from "@/lib/export/download";
import { bundleCounts, toFhirBundle } from "@/lib/export/fhirExport";
import {
  ImportFileError,
  buildPassportFile,
  describePassportFile,
  fhirFileNovelty,
  NOTHING_NEW_MESSAGES,
  importFhirFile,
  parseImportFile,
  passportFileName,
  restorePassportFile,
  type ParsedImport,
} from "@/lib/export/passportFile";

type Pending = ParsedImport & { fileName: string };

export function ExportImport() {
  const { record, local, now, patients, patientId, setPatientId, passportStatus } = usePatient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; review?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = passportStatus === "ready";

  async function exportPassport() {
    const file = buildPassportFile(record, local, now);
    downloadJson(passportFileName(record, now, "passport"), file);
    await recordActivity(patientId, "export", "Exported a Passport file (Passport data + FHIR R4 Bundle)");
  }

  async function exportFhir() {
    const bundle = toFhirBundle(record, { now });
    downloadJson(passportFileName(record, now, "fhir"), bundle, "application/fhir+json");
    const n = bundle.entry?.length ?? 0;
    await recordActivity(patientId, "export", `Exported a FHIR R4 Bundle (${n} resources)`);
  }

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError(null);
    setMessage(null);
    setPending(null);
    if (!f) return;
    try {
      setPending({ ...parseImportFile(await f.text()), fileName: f.name });
    } catch (err) {
      setError(err instanceof ImportFileError ? err.message : "Couldn't read that file.");
    }
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "passport") {
        await restorePassportFile(pending.file, patients.map((p) => p.id));
        if (pending.file.patient.id !== patientId) setPatientId(pending.file.patient.id);
        setMessage({ text: `Restored ${pending.file.patient.name}'s Passport from ${pending.fileName}.` });
      } else {
        const plan = await importFhirFile(pending.bundle, record, pending.fileName);
        const counts = Object.fromEntries(Object.entries(plan.batch).map(([k, v]) => [k, v?.length ?? 0]));
        setMessage({ text: `Added ${describeCounts(counts)} to Review. Nothing is used until you confirm it.`, review: true });
      }
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const summary = pending?.kind === "passport" ? describePassportFile(pending.file) : null;
  const fhirCounts = pending?.kind === "fhir" ? bundleCounts(pending.bundle) : null;
  const novelty = pending?.kind === "fhir" ? fhirFileNovelty(pending.bundle, record, local) : "new";
  const nothingNew = novelty !== "new";
  const target = pending?.kind === "passport" ? patients.find((p) => p.id === pending.file.patient.id) : undefined;

  return (
    <>
      <Card className="p-5">
        <SectionTitle>Export my Passport</SectionTitle>
        <p className="text-sm text-ink-soft">Take your record with you. Files are created on this device and saved where you choose — nothing is uploaded.</p>
        <ul className="mt-4 space-y-3">
          <li className="flex flex-col gap-2 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">Passport file (.json)</p>
              <p className="text-sm text-ink-muted">Everything for {record.patient.name}: items waiting for review, where each came from, your choices and activity log — plus a FHIR R4 Bundle. Import it here to restore.</p>
            </div>
            <button type="button" disabled={!ready} onClick={exportPassport} className="min-h-11 shrink-0 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
              Download Passport file
            </button>
          </li>
          <li className="flex flex-col gap-2 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">FHIR R4 Bundle (.json)</p>
              <p className="text-sm text-ink-muted">Your confirmed record in the standard format EHRs and health apps read — RxNorm, LOINC, ICD-10, CVX codes and the source of each item.</p>
            </div>
            <button type="button" disabled={!ready} onClick={exportFhir} className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50 disabled:opacity-50">
              Download FHIR Bundle
            </button>
          </li>
          <li className="flex flex-col gap-2 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">Printable summary (PDF)</p>
              <p className="text-sm text-ink-muted">Choose sections, preview, then print or save as PDF.</p>
            </div>
            <Link href="/passport/share/" className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50">
              Open share view →
            </Link>
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Exported files aren&apos;t encrypted, even when the Passport lock is on. Store them somewhere you trust.</p>
      </Card>

      <Card className="p-5">
        <SectionTitle>Import a Passport file</SectionTitle>
        <p className="text-sm text-ink-soft">
          Restore a Passport file exported from Parthia, or bring in a FHIR R4 Bundle from another app. FHIR items go to Review first.
        </p>
        <input type="file" accept=".json,application/json,application/fhir+json" onChange={choose} className="sr-only" id="passport-import" />
        <label htmlFor="passport-import" className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50">
          Choose a file…
        </label>

        {pending && (
          <div className={`mt-4 rounded-xl border p-4 text-sm ${nothingNew ? "border-line bg-cream/60" : "border-gold-200 bg-gold-50/60"}`}>
            <p className="font-semibold text-ink">{pending.fileName}</p>
            {pending.kind === "passport" && summary ? (
              <>
                <p className="mt-1 text-ink-soft">
                  Passport file for <strong>{pending.file.patient.name}</strong>, exported {fmtDate(pending.file.exportedAt)}: {summary.confirmed} confirmed item
                  {summary.confirmed === 1 ? "" : "s"}, {summary.pending} waiting for review, {summary.activity} activity entries.
                </p>
                <p className="mt-2 font-semibold text-attention">
                  This replaces what this device stores for {pending.file.patient.name}{target ? "" : " (not a sample patient — can't be restored)"}.
                </p>
              </>
            ) : fhirCounts && nothingNew ? (
              <p role="status" className="mt-1 text-ink-soft">
                FHIR Bundle with {Object.entries(fhirCounts).map(([k, n]) => `${n} ${k}`).join(", ")}. {NOTHING_NEW_MESSAGES[novelty as keyof typeof NOTHING_NEW_MESSAGES]}
                {novelty === "all-known" && (
                  <>
                    {" "}
                    <Link href="/passport/review/" className="font-semibold text-brand-700 underline hover:text-brand-900">Go to Review →</Link>
                  </>
                )}
              </p>
            ) : fhirCounts ? (
              <p className="mt-1 text-ink-soft">
                FHIR Bundle with {Object.entries(fhirCounts).map(([k, n]) => `${n} ${k}`).join(", ")}. New items will be added to Review for {record.patient.name}; anything already in the Passport is skipped.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {!nothingNew && <button type="button" disabled={busy || !ready} onClick={apply} className="min-h-11 rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
                {pending.kind === "passport" ? "Replace and restore" : "Add to Review"}
              </button>}
              <button type="button" onClick={() => setPending(null)} className="min-h-11 rounded-full px-4 font-semibold text-ink-soft ring-1 ring-line">
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-attention">{error}</p>}
        {message && (
          <p role="status" className="mt-3 text-sm font-semibold text-good">
            {message.text} {message.review && <Link href="/passport/review/" className="text-brand-700 underline">Review now →</Link>}
          </p>
        )}
      </Card>
    </>
  );
}
