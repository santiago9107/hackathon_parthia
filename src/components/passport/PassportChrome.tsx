"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { pendingEntries } from "@/lib/passport/ops";

export const PASSPORT_TABS = [
  { href: "/passport/", label: "Overview" },
  { href: "/passport/timeline/", label: "Timeline" },
  { href: "/passport/clinical/", label: "Clinical" },
  { href: "/passport/medications/", label: "Medications" },
  { href: "/passport/nutrition/", label: "Nutrition" },
  { href: "/passport/mental-health/", label: "Mental health" },
  { href: "/passport/appointments/", label: "Appointments" },
  { href: "/passport/documents/", label: "Documents" },
  { href: "/passport/sources/", label: "Sources" },
  { href: "/passport/share/", label: "Share" },
];

const norm = (p: string) => (p.endsWith("/") ? p : `${p}/`);

/** "Stored only on this device — you control it." Shown on Passport and import screens. */
export function LocalOnlyNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-1.5 text-xs font-medium text-brand-800 ${className}`}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </svg>
      Stored only on this device — you control it
    </p>
  );
}

export function PassportHeader() {
  const { record, local, issues } = usePatient();
  const pending = pendingEntries(local).length + issues.filter((i) => !i.resolution).length;
  return (
    <div className="print-hidden mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">Patient Passport</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{record.patient.name}</h1>
        <LocalOnlyNotice className="mt-1.5" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/passport/add/" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          <span aria-hidden>＋</span> Add to my Passport
        </Link>
        <Link
          href="/passport/review/"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ${
            pending > 0 ? "bg-gold-50 text-[#7a5812] ring-gold-200" : "bg-surface text-ink-soft ring-line hover:bg-brand-50"
          }`}
        >
          Review{pending > 0 ? ` (${pending})` : ""}
        </Link>
        <Link href="/passport/emergency/" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-attention ring-1 ring-line hover:bg-attention-soft">
          Emergency card
        </Link>
      </div>
    </div>
  );
}

export function PassportNav() {
  const pathname = norm(usePathname() ?? "/passport/");
  return (
    <nav aria-label="Passport sections" className="print-hidden -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b border-line pb-px">
        {PASSPORT_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${
                  active ? "border-brand-700 text-brand-800" : "border-transparent text-ink-muted hover:text-brand-800"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---- Small shared primitives for Passport screens ------------------------ */

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-serif text-xl font-semibold text-navy">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-cream/60 px-4 py-5 text-sm text-ink-muted">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
      {children}
    </Link>
  );
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", opts);
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
