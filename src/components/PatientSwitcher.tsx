"use client";

import { useEffect, useRef, useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { evaluatePatient, highestSeverity } from "@/lib/safetyEngine";
import { getRecord } from "@/lib/mockData";
import { SEVERITY_STYLES } from "./Badges";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

/**
 * DEMO-ONLY control. Lets a presenter flip between the three synthetic
 * personas. In the real product a patient only ever sees their own record.
 */
export function PatientSwitcher() {
  const { patients, patientId, setPatientId, record, now } = usePatient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm shadow-sm transition hover:border-brand-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 font-serif text-sm font-semibold text-white">
          {initials(record.patient.name)}
        </span>
        <span className="hidden max-w-[9rem] truncate font-medium text-ink sm:inline">{record.patient.name}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-ink-muted" fill="currentColor" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch demo patient"
          className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line bg-cream px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Demo personas</p>
            <p className="text-xs text-ink-muted">Synthetic patients — switch to see different risk profiles.</p>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto p-1.5">
            {patients.map((p) => {
              const flags = evaluatePatient(getRecord(p.id)!, { now });
              const top = highestSeverity(flags);
              const selected = p.id === patientId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setPatientId(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-brand-50 ${
                      selected ? "bg-brand-50 ring-1 ring-brand-100" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-serif text-sm font-semibold text-white">
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {p.name}, {p.age}
                        </span>
                        {top && (
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLES[top].className}`}>
                            {flags.length} flag{flags.length === 1 ? "" : "s"}
                          </span>
                        )}
                        {!top && <span className="shrink-0 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">No flags</span>}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
                        {p.medications.length} medications · {p.summary}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
