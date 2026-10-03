import Link from "next/link";
import { runEvaluation } from "@/lib/clinician/eval";

export default function ClinicianEvalPage() {
  const results = runEvaluation();
  const passed = results.filter((result) => result.passed).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[1.5rem] bg-navy p-6 text-white sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Prototype evaluation</p><h1 className="mt-1 font-serif text-3xl font-semibold">Expected findings and prohibited alarms</h1><p className="mt-2 max-w-2xl text-sm text-white/70">A deterministic check of configured rules. This is not clinical validation.</p></div>
        <div className="rounded-2xl bg-white/10 px-6 py-4 text-center"><p className="text-3xl font-bold text-gold-200">{passed}/{results.length}</p><p className="text-xs uppercase tracking-wider text-white/60">cases passed</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => <article key={result.id} className="rounded-card border border-line bg-surface p-4 shadow-card"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-navy">{result.name}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${result.passed ? "bg-good-soft text-good" : "bg-attention-soft text-attention"}`}>{result.passed ? "Pass" : "Fail"}</span></div><p className="mt-2 text-xs text-ink-muted">Expected: {result.expected.join(", ") || "no required finding"}</p><p className="mt-1 text-xs text-ink-muted">Prohibited: {result.prohibited.join(", ") || "none"}</p>{!result.passed && <p className="mt-2 text-xs font-semibold text-attention">Missed: {result.missed.join(", ") || "none"}; unexpected: {result.prohibitedFound.join(", ") || "none"}</p>}</article>)}
      </div>
      <Link href="/clinician/" className="inline-flex rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white">← Back to clinician workspace</Link>
    </div>
  );
}
