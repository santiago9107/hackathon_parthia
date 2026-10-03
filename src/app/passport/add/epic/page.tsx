"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { runFhirImport, type FhirImportResult } from "@/lib/fhir/importer";
import { EPIC_SCOPES, IMPORT_CONTENTS, NOT_IMPORTED, simulatedEpicSource as source } from "@/lib/fhir/source";
import { countItems, describeBatch } from "@/lib/passport/importPlan";

type Step = "consent" | "signin" | "importing" | "done" | "error";

function SimulatedBanner() {
  return (
    <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm font-semibold text-[#5c430d]">
      Simulated — no real Epic connection. This demo uses synthetic FHIR R4 data; nothing leaves this device.
    </p>
  );
}

export default function ConnectEpicPage() {
  const { patientId, record } = usePatient();
  const [step, setStep] = useState<Step>("consent");
  const [result, setResult] = useState<FhirImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const org = source.organization(patientId);

  async function runImport() {
    setStep("importing");
    try {
      setResult(await runFhirImport(source, patientId, record));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import didn't complete.");
      setStep("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/passport/add/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">← Add to my Passport</Link>
        <h2 className="font-serif text-2xl font-semibold text-navy">Connect your hospital record</h2>
        <p className="mt-1 text-sm text-ink-soft">Epic MyChart · {org}. Uses the SMART on FHIR standard (read-only).</p>
        <LocalOnlyNotice className="mt-2" />
      </div>
      <SimulatedBanner />

      <ol aria-label="Steps" className="flex flex-wrap gap-2 text-xs font-semibold">
        {(["consent", "signin", "importing", "done"] as const).map((s, i) => {
          const order = ["consent", "signin", "importing", "done"];
          const current = order.indexOf(step === "error" ? "importing" : step);
          return (
            <li key={s} aria-current={order[current] === s ? "step" : undefined} className={`rounded-full px-3 py-1 ${i <= current ? "bg-brand-700 text-white" : "bg-cream-dark text-ink-muted"}`}>
              {i + 1}. {["What's shared", "Sign in", "Import", "Review"][i]}
            </li>
          );
        })}
      </ol>

      {step === "consent" && (
        <Card className="p-5">
          <h3 className="font-serif text-xl font-semibold text-navy">What will be imported</h3>
          <p className="mt-1 text-sm text-ink-soft">A read-only copy of these parts of your record at {org}. Your hospital record is not changed.</p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {IMPORT_CONTENTS.map((c) => (
              <li key={c.label} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <span><span className="font-semibold text-ink">{c.label}</span><span className="block text-ink-muted">{c.detail}</span></span>
                <span className="text-xs text-ink-muted">FHIR {c.resource}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft"><strong className="text-ink">Not imported:</strong> {NOT_IMPORTED.join("; ")}.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Everything imported waits for your review. Nothing is used in any analysis until you confirm it, and you can disconnect or delete it at any time.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep("signin")} className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">Continue to sign-in (simulated)</button>
            <Link href="/passport/add/" className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-cream-dark">Cancel</Link>
          </div>
        </Card>
      )}

      {step === "signin" && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a5812]">Mock sign-in · Simulated — no real Epic connection</p>
          <h3 className="mt-1 font-serif text-xl font-semibold text-navy">Sign in to {org}</h3>
          <p className="mt-1 text-sm text-ink-soft">
            In the real flow you would sign in on your health system&apos;s own MyChart page — Parthia never sees your password — and approve read-only access.
            This demo skips that and signs in as the sample patient.
          </p>
          <div className="mt-4 rounded-xl border border-line bg-cream/60 p-4 text-sm">
            <p className="font-semibold text-ink">Parthia Health is asking for read-only access to:</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1 text-ink-soft sm:grid-cols-2">
              {EPIC_SCOPES.filter((s) => s.startsWith("patient/")).map((s) => <li key={s}>• {s.replace("patient/", "").replace(".read", "")}</li>)}
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={runImport} className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              Continue as sample patient ({record.patient.name}) and allow access
            </button>
            <button type="button" onClick={() => setStep("consent")} className="min-h-12 rounded-full px-5 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-cream-dark">Back</button>
          </div>
        </Card>
      )}

      {step === "importing" && (
        <Card className="p-5">
          <p role="status" className="flex items-center gap-3 text-sm text-ink">
            <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
            Connecting, reading your record and checking it against your Passport…
          </p>
        </Card>
      )}

      {step === "error" && (
        <Card className="p-5" accent="border-l-attention">
          <p role="alert" className="font-semibold text-attention">{error}</p>
          <button type="button" onClick={() => setStep("consent")} className="mt-3 min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-line">Start again</button>
        </Card>
      )}

      {step === "done" && result && (
        <Card className="p-5" accent="border-l-good">
          <h3 className="font-serif text-xl font-semibold text-navy">Imported for your review</h3>
          {countItems(result.plan.newCounts) === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Everything in your {org} record is already in your Passport. Nothing new to review.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-soft">
                <strong className="text-ink">{countItems(result.plan.newCounts)} new or different items</strong> are waiting for you: {describeBatch(result.plan.newCounts).join(", ")}.
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                Some may differ from what you have — for example a different dose. You decide which is right. Until you confirm them, they aren&apos;t used anywhere.
              </p>
            </>
          )}
          {countItems(result.plan.duplicates) > 0 && (
            <p className="mt-2 text-sm text-ink-muted">Already in your Passport, skipped: {describeBatch(result.plan.duplicates).join(", ")}.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/passport/review/" className="inline-flex min-h-12 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">Review now</Link>
            <Link href="/passport/sources/" className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">See my sources</Link>
          </div>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}
