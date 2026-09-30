"use client";

import Link from "next/link";
import { useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { fmtDate } from "@/components/passport/PassportChrome";

/**
 * Emergency card: the critical information on one compact, printable card,
 * plus a tall high-contrast view sized for a phone lock screen (screenshot it
 * and set it as the lock-screen wallpaper).
 */
export default function EmergencyCardPage() {
  const { record } = usePatient();
  const [view, setView] = useState<"card" | "lock">("card");
  const { patient } = record;
  const e = record.emergency;
  const medAllergies = record.allergies.filter((a) => a.category === "medication" || a.severity === "severe");
  const allergies = e?.criticalAllergies.length ? e.criticalAllergies : medAllergies.map((a) => `${a.substance}${a.reaction ? ` — ${a.reaction}` : ""}`);
  const conditions = e?.criticalConditions.length ? e.criticalConditions : patient.conditions.map((c) => c.name);
  const meds = patient.medications.map((m) => `${m.name} ${m.dose}`);
  const isSample = record.emergency?.source.kind === "seed";

  return (
    <div>
      <div className="print-hidden mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Emergency card view" className="inline-flex rounded-full bg-cream-dark p-1">
          {(["card", "lock"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === v ? "bg-surface text-brand-800 shadow-card" : "text-ink-soft"}`}
            >
              {v === "card" ? "Printable card" : "Lock-screen view"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/log/emergency/" className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">
            Edit emergency info
          </Link>
          <button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            Print
          </button>
        </div>
      </div>

      {view === "card" ? (
        <article aria-label="Emergency card" className="mx-auto max-w-xl overflow-hidden rounded-2xl border-2 border-attention bg-white shadow-card">
          <header className="flex items-center justify-between bg-attention px-5 py-3 text-white">
            <p className="text-sm font-bold uppercase tracking-widest">Emergency medical information</p>
            <span aria-hidden className="text-xl font-black">✚</span>
          </header>
          <div className="space-y-4 p-5 text-sm">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
              <div>
                <p className="font-serif text-2xl font-semibold text-navy">{patient.name}</p>
                <p className="text-ink-soft">Age {patient.age} · {patient.sex}</p>
              </div>
              <p className="rounded-lg bg-attention-soft px-3 py-1.5 text-center">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-attention">Blood type</span>
                <span className="text-xl font-bold text-ink">{e?.bloodType ?? "Unknown"}</span>
              </p>
            </div>
            <Field label="Allergies" items={allergies} tone="alert" empty="No known allergies recorded" />
            <Field label="Conditions" items={conditions} />
            <Field label="Current medications" items={meds} columns />
            {e?.notes && <p className="rounded-lg bg-gold-50 p-3 text-ink"><strong>Note: </strong>{e.notes}</p>}
            <div>
              <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-muted">Emergency contacts</h2>
              {e?.contacts.length ? (
                <ul className="space-y-1">
                  {e.contacts.map((c) => (
                    <li key={c.phone}><strong className="text-ink">{c.name}</strong> <span className="text-ink-soft">({c.relationship})</span> · <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-brand-700">{c.phone}</a></li>
                  ))}
                </ul>
              ) : <p className="text-ink-muted">None recorded</p>}
            </div>
            <p className="border-t border-line pt-3 text-xs text-ink-muted">
              Primary clinician: {patient.primaryClinician}. Updated {e ? fmtDate(e.updatedAt) : "—"}. From the patient&apos;s Parthia Health Passport.
              {isSample && " SAMPLE DATA — synthetic demo persona."}
            </p>
          </div>
        </article>
      ) : (
        <article aria-label="Emergency information, lock-screen view" className="mx-auto flex aspect-[9/19.5] max-h-[80dvh] max-w-[23rem] flex-col justify-end overflow-hidden rounded-[2.5rem] bg-[#111] p-6 text-white shadow-card">
          <div className="mb-auto pt-16 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9a8a]">Medical ID</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{patient.name}</p>
            <p className="text-sm text-white/80">Age {patient.age} · Blood type {e?.bloodType ?? "unknown"}</p>
          </div>
          <dl className="space-y-3 text-[15px] leading-snug">
            <div><dt className="text-xs font-bold uppercase tracking-wider text-[#ff9a8a]">Allergies</dt><dd>{allergies.join("; ") || "None known"}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-[#ffd27a]">Conditions</dt><dd>{conditions.join("; ")}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-[#ffd27a]">Medications</dt><dd className="text-sm text-white/90">{meds.join(", ")}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-[#9fe3d8]">In case of emergency call</dt><dd>{e?.contacts.map((c) => `${c.name} (${c.relationship}) ${c.phone}`).join(" · ") || "—"}</dd></div>
          </dl>
          <p className="mt-4 text-center text-[10px] text-white/60">Parthia Health Passport{isSample ? " · sample data" : ""}</p>
        </article>
      )}
      <p className="print-hidden mx-auto mt-4 max-w-xl text-center text-xs text-ink-muted">
        {view === "lock"
          ? "Take a screenshot of this view and set it as your lock-screen wallpaper, so first responders can see it without unlocking your phone."
          : "Print this card and keep it in your wallet, or save it as a PDF."}
      </p>
    </div>
  );
}

function Field({ label, items, tone, empty = "None recorded", columns }: { label: string; items: string[]; tone?: "alert"; empty?: string; columns?: boolean }) {
  return (
    <div>
      <h2 className={`mb-1 text-xs font-bold uppercase tracking-wider ${tone === "alert" ? "text-attention" : "text-ink-muted"}`}>{label}</h2>
      {items.length === 0 ? <p className="text-ink-muted">{empty}</p> : (
        <ul className={`${columns ? "grid grid-cols-1 gap-x-4 sm:grid-cols-2" : "space-y-0.5"} ${tone === "alert" ? "font-semibold text-ink" : "text-ink"}`}>
          {items.map((i) => <li key={i}>• {i}</li>)}
        </ul>
      )}
    </div>
  );
}
