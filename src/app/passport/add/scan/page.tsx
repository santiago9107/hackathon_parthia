"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice } from "@/components/passport/PassportChrome";
import { AppIcon } from "@/components/AppIcon";
import { usePatient } from "@/lib/context/PatientContext";
import { addReviewedBatch } from "@/lib/passport/actions";
import { confidenceLevel, extractDocument, type Extraction } from "@/lib/ocr/extract";
import { buildScanItems, defaultTitle, rowsFromExtraction, SCAN_LABELS, type LabRow, type MedRow, type ScanDetails } from "@/lib/ocr/toPassport";
import { REFERENCE_DATE } from "@/lib/mockData";

type Step = "choose" | "reading" | "review" | "saved" | "error";

const SAMPLES = [
  { file: "/samples/sample-prescription-harold.png", title: "Urgent-care prescription", who: "Harold Okafor", note: "Naproxen from an urgent-care visit — watch what the safety check says." },
  { file: "/samples/sample-lab-report-margaret.png", title: "Lab report", who: "Margaret Lindqvist", note: "Basic metabolic panel with flagged values." },
  { file: "/samples/sample-visit-summary-rosa.png", title: "Visit summary", who: "Rosa Delgado", note: "Medications listed by a clinician outside the health system." },
];

const LEVEL_STYLE = {
  high: "bg-good-soft text-good",
  medium: "bg-watch-soft text-[#7a5812]",
  low: "bg-attention-soft text-attention",
} as const;

function Confidence({ value }: { value: number }) {
  const level = confidenceLevel(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLE[level]}`}>
      <span aria-hidden>{level === "high" ? "●●●" : level === "medium" ? "●●○" : "●○○"}</span>
      {level === "high" ? "High" : level === "medium" ? "Medium" : "Low"} confidence · {Math.round(value * 100)}%
    </span>
  );
}

const inputCls = "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

export default function ScanPage() {
  const { patientId, record, flags } = usePatient();
  const [step, setStep] = useState<Step>("choose");
  const [progress, setProgress] = useState({ status: "", progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ src: string; blob?: Blob; isSample: boolean } | null>(null);
  const [ocr, setOcr] = useState<{ text: string; x: Extraction } | null>(null);
  const [details, setDetails] = useState<ScanDetails | null>(null);
  const [meds, setMeds] = useState<MedRow[]>([]);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ added: string[]; flagsBefore: number; ids: string[] } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function read(src: string, blob?: Blob, isSample = false) {
    setImage({ src, blob, isSample });
    setStep("reading");
    setError(null);
    try {
      const { recognize } = await import("@/lib/ocr/engine");
      const result = await recognize(blob ?? src, (p) => setProgress(p));
      const x = extractDocument(result.lines);
      const rows = rowsFromExtraction(x, record);
      setOcr({ text: result.text, x });
      setMeds(rows.meds);
      setLabs(rows.labs);
      setDetails({ type: x.documentType, date: x.date ?? REFERENCE_DATE, prescriber: x.prescriber ?? "", organization: x.organization ?? "", title: defaultTitle(x), panelName: x.panelName, saveDocument: false });
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The text couldn't be read.");
      setStep("error");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please choose a photo or image file.");
      setStep("error");
      return;
    }
    void read(URL.createObjectURL(f), f);
  }

  async function confirm() {
    if (!details || !ocr) return;
    setBusy(true);
    try {
      let imageDataUrl: string | undefined;
      if (details.saveDocument && image) {
        const { thumbnailDataUrl } = await import("@/lib/ocr/engine");
        imageDataUrl = await thumbnailDataUrl(image.blob ?? image.src);
      }
      const items = buildScanItems(details, meds, labs, { patientId, text: ocr.text, textConfidence: ocr.x.textConfidence, imageDataUrl });
      const added = [
        ...items.medications.map((m) => `${m.name} ${m.dose}`),
        ...items.labs.map((l) => `${l.name} ${l.value}${l.unit ? ` ${l.unit}` : ""}`),
        ...items.documents.map((d) => `Document: ${d.title}`),
      ];
      await addReviewedBatch(
        patientId,
        { medications: items.medications, medicationHistory: items.medicationHistory, labs: items.labs, labPanels: items.labPanels, documents: items.documents },
        `${SCAN_LABELS[details.type]} reviewed and confirmed: ${added.join(", ") || "nothing added"}`,
        "document-scan",
      );
      setSaved({ added, flagsBefore: flags.length, ids: flags.map((f) => f.id) });
      setStep("saved");
    } finally {
      setBusy(false);
    }
  }

  const x = ocr?.x;
  const identityWarning = x?.patientName && x.patientName.toLowerCase() !== record.patient.name.toLowerCase() ? x.patientName : null;
  const selected = meds.filter((m) => m.include).length + labs.filter((l) => l.include).length;
  const newFlags = saved ? flags.filter((f) => !saved.ids.includes(f.id)) : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/passport/add/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">← Add to my Passport</Link>
        <h2 className="font-serif text-2xl font-semibold text-navy">Scan a document</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">Prescriptions, lab reports and visit summaries. The text is read on this device; you check every item before anything is added.</p>
        <LocalOnlyNotice className="mt-2" />
      </div>

      {step === "choose" && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"><AppIcon name="camera" className="h-4 w-4" />Take a photo</button>
              <button type="button" onClick={() => fileRef.current?.click()} className="min-h-12 rounded-full bg-surface px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">Choose an image</button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" aria-label="Take a photo of a document" tabIndex={-1} />
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="sr-only" aria-label="Choose an image of a document" tabIndex={-1} />
            </div>
            <p className="mt-3 text-xs text-ink-muted">Tips: flat surface, good light, the whole page in the frame. Images are processed here and never uploaded.</p>
          </Card>
          <section aria-labelledby="samples-title">
            <h3 id="samples-title" className="mb-2 font-serif text-lg font-semibold text-navy">Try a sample</h3>
            <ul className="grid gap-3 sm:grid-cols-3">
              {SAMPLES.map((s) => (
                <li key={s.file}>
                  <button type="button" onClick={() => void read(s.file, undefined, true)} className="flex h-full w-full flex-col rounded-card border border-line bg-surface p-3 text-left shadow-card hover:border-brand-300">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static sample image */}
                    <img src={s.file} alt="" className="h-36 w-full rounded-lg border border-line object-cover object-top" />
                    <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-attention">Sample — synthetic</span>
                    <span className="font-semibold text-ink">{s.title}</span>
                    <span className="text-xs text-ink-muted">For {s.who}. {s.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {step === "reading" && (
        <Card className="p-5">
          <p className="font-semibold text-ink">{progress.status || "Starting"}…</p>
          <div className="mt-3 h-2.5 rounded-full bg-cream-dark" role="progressbar" aria-label="Reading the document" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.progress * 100)}>
            <div className="h-2.5 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">The first scan loads the text reader (about 7 MB); after that it works offline.</p>
        </Card>
      )}

      {step === "error" && (
        <Card className="p-5" accent="border-l-attention">
          <p role="alert" className="font-semibold text-attention">{error}</p>
          <button type="button" onClick={() => setStep("choose")} className="mt-3 min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-line">Try again</button>
        </Card>
      )}

      {step === "review" && x && details && image && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- local image being reviewed */}
            <img src={image.src} alt="The document you scanned" className="max-h-[70vh] w-full rounded-card border border-line bg-white object-contain" />
            {image.isSample && <p className="text-xs font-semibold text-attention">SAMPLE — SYNTHETIC document</p>}
            <details className="rounded-card border border-line bg-surface p-3">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-brand-700">Recognized text ({Math.round(x.textConfidence * 100)}% average confidence)</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-cream/70 p-3 font-sans text-xs text-ink-soft">{ocr!.text}</pre>
            </details>
          </div>

          <div className="space-y-4">
            {identityWarning && (
              <p role="alert" className="rounded-card border border-attention/30 bg-attention-soft p-3 text-sm text-ink">
                <strong>This document is for {identityWarning}</strong>, not {record.patient.name}. Only add it if it really belongs in this Passport.
              </p>
            )}
            <Card className="p-4">
              <h3 className="mb-3 font-serif text-lg font-semibold text-navy">Document</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-ink">Type
                  <select value={details.type} onChange={(e) => setDetails({ ...details, type: e.target.value as ScanDetails["type"] })} className={`${inputCls} mt-1 font-normal`}>
                    <option value="prescription">Prescription</option><option value="lab-report">Lab report</option><option value="visit-summary">Visit summary</option><option value="other">Other</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-ink">Date<input type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="text-sm font-semibold text-ink">{details.type === "lab-report" ? "Ordered by" : "Prescriber / clinician"}<input value={details.prescriber} onChange={(e) => setDetails({ ...details, prescriber: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="text-sm font-semibold text-ink">Organization<input value={details.organization} onChange={(e) => setDetails({ ...details, organization: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-serif text-lg font-semibold text-navy">Medications found ({meds.length})</h3>
              {meds.length === 0 && <p className="mt-1 text-sm text-ink-muted">None recognized.</p>}
              <ul className="mt-2 space-y-3">
                {meds.map((m, i) => (
                  <li key={m.key} className={`rounded-xl border p-3 ${m.include ? "border-brand-300 bg-brand-50/40" : "border-line"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
                        <input type="checkbox" checked={m.include} onChange={(e) => setMeds(meds.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))} className="h-5 w-5 accent-[#0e5c56]" />
                        Add to my Passport
                      </label>
                      <Confidence value={m.confidence} />
                    </div>
                    {m.alreadyInPassport && <p className="text-xs font-semibold text-brand-700">Already in your Passport</p>}
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="col-span-2 text-xs font-semibold text-ink-muted">Medicine<input value={m.name} onChange={(e) => setMeds(meds.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="text-xs font-semibold text-ink-muted">Dose<input inputMode="decimal" value={m.dose} onChange={(e) => setMeds(meds.map((r, j) => (j === i ? { ...r, dose: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="text-xs font-semibold text-ink-muted">Unit<input value={m.unit} onChange={(e) => setMeds(meds.map((r, j) => (j === i ? { ...r, unit: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="col-span-2 text-xs font-semibold text-ink-muted">How often<input value={m.frequency} onChange={(e) => setMeds(meds.map((r, j) => (j === i ? { ...r, frequency: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="col-span-2 text-xs font-semibold text-ink-muted">For<input value={m.indication} onChange={(e) => setMeds(meds.map((r, j) => (j === i ? { ...r, indication: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                    </div>
                    {m.issues.length > 0 && <ul className="mt-2 text-xs text-[#7a5812]">{m.issues.map((iss) => <li key={iss} className="flex items-start gap-1"><AppIcon name="alert" className="mt-0.5 h-3 w-3 shrink-0" />{iss}</li>)}</ul>}
                    <p className="mt-1 text-xs italic text-ink-muted">From: “{m.line}”</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <h3 className="font-serif text-lg font-semibold text-navy">Lab values found ({labs.length})</h3>
              {labs.length === 0 && <p className="mt-1 text-sm text-ink-muted">None recognized.</p>}
              <ul className="mt-2 space-y-3">
                {labs.map((l, i) => (
                  <li key={l.key} className={`rounded-xl border p-3 ${l.include ? "border-brand-300 bg-brand-50/40" : "border-line"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
                        <input type="checkbox" checked={l.include} onChange={(e) => setLabs(labs.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))} className="h-5 w-5 accent-[#0e5c56]" />
                        {l.name}
                      </label>
                      <Confidence value={l.confidence} />
                    </div>
                    {l.alreadyInPassport && <p className="text-xs font-semibold text-brand-700">Already in your Passport</p>}
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <label className="text-xs font-semibold text-ink-muted">Value<input inputMode="decimal" value={l.value} onChange={(e) => setLabs(labs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="text-xs font-semibold text-ink-muted">Unit<input value={l.unit} onChange={(e) => setLabs(labs.map((r, j) => (j === i ? { ...r, unit: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="text-xs font-semibold text-ink-muted">Range low<input inputMode="decimal" value={l.low} onChange={(e) => setLabs(labs.map((r, j) => (j === i ? { ...r, low: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                      <label className="text-xs font-semibold text-ink-muted">Range high<input inputMode="decimal" value={l.high} onChange={(e) => setLabs(labs.map((r, j) => (j === i ? { ...r, high: e.target.value } : r)))} className={`${inputCls} mt-0.5`} /></label>
                    </div>
                    {l.issues.length > 0 && <ul className="mt-2 text-xs text-[#7a5812]">{l.issues.map((iss) => <li key={iss} className="flex items-start gap-1"><AppIcon name="alert" className="mt-0.5 h-3 w-3 shrink-0" />{iss}</li>)}</ul>}
                    <p className="mt-1 text-xs italic text-ink-muted">From: “{l.line}”</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <label className="flex min-h-11 items-start gap-3 text-sm text-ink">
                <input type="checkbox" checked={details.saveDocument} onChange={(e) => setDetails({ ...details, saveDocument: e.target.checked })} className="mt-0.5 h-5 w-5 accent-[#0e5c56]" />
                <span><strong>Save this document to my Documents</strong> (image and text, on this device only).</span>
              </label>
              {details.saveDocument && (
                <label className="mt-2 block text-sm font-semibold text-ink">Title<input value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
              )}
            </Card>

            <div className="sticky bottom-24 z-10 -mx-4 flex flex-wrap gap-2 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-card md:border">
              <button type="button" disabled={busy || (selected === 0 && !details.saveDocument)} onClick={confirm} className="min-h-12 flex-1 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 sm:flex-none">
                {busy ? "Adding…" : `Confirm and add ${selected} item${selected === 1 ? "" : "s"}${details.saveDocument ? " + document" : ""}`}
              </button>
              <button type="button" onClick={() => { setStep("choose"); setOcr(null); }} className="min-h-12 rounded-full px-5 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-cream-dark">Discard</button>
            </div>
          </div>
        </div>
      )}

      {step === "saved" && saved && (
        <Card className="p-5" accent="border-l-good">
          <p role="status" className="flex items-center gap-2 font-serif text-xl font-semibold text-navy"><AppIcon name="check" className="h-5 w-5" />Added to your Passport</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">{saved.added.map((a) => <li key={a}>{a}</li>)}</ul>
          {newFlags.length > 0 ? (
            <div className="mt-4 rounded-xl border border-attention/30 bg-attention-soft p-4 text-sm">
              <p className="font-semibold text-ink">The safety check found {newFlags.length} new question{newFlags.length === 1 ? "" : "s"} to raise with your doctor or pharmacist:</p>
              <ul className="mt-1 list-disc pl-5">{newFlags.map((f) => <li key={f.id}><strong className="capitalize">{f.severity}</strong>: {f.title}</li>)}</ul>
              <Link href="/medications/" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800">See medication safety</Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">The safety check re-ran with your updated Passport and found nothing new.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setStep("choose"); setSaved(null); }} className="min-h-12 rounded-full px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">Scan another</button>
            <Link href="/passport/" className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">My Passport</Link>
          </div>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}
