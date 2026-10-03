"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import { PatientSwitcher } from "./PatientSwitcher";
import { InstallCTA } from "./InstallCTA";
import { LockScreen } from "./passport/LockScreen";
import { AskParthiaDock } from "./patient/AskParthiaDock";
import { usePatient } from "@/lib/context/PatientContext";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { className?: string }) => ReactElement;
  /** Also active for any path under this prefix. */
  prefix?: string;
}

const HOME: NavItem = { href: "/", label: "Home", icon: HomeIcon };
const PASSPORT: NavItem = { href: "/passport/", label: "Passport", icon: PassportIcon, prefix: "/passport/" };
const SAFETY: NavItem = { href: "/medications/", label: "Safety", icon: PillIcon };
const TRENDS: NavItem = { href: "/trends/", label: "Trends", icon: TrendIcon };
const ANALYTICS: NavItem = { href: "/analytics/", label: "Analytics", icon: TrendIcon };
const AGENTS: NavItem = { href: "/agents/", label: "Agents", icon: AgentsIcon, prefix: "/agents/" };
const CLINICIAN: NavItem = { href: "/clinician/", label: "Clinician", icon: ClinicianIcon, prefix: "/clinician/" };
const ARCHITECTURE: NavItem = { href: "/architecture/", label: "Architecture", icon: ClinicianIcon, prefix: "/architecture/" };
const LOG: NavItem = { href: "/log/", label: "Log", icon: PlusIcon, prefix: "/log/" };

/** Desktop header: the Passport is a primary item; "Log" is a separate button. */
const DESKTOP_NAV: NavItem[] = [HOME, PASSPORT, SAFETY, TRENDS, ANALYTICS, AGENTS, CLINICIAN];
/** Mobile tab bar (max 5): Log sits in the middle as a raised quick action. */
const MOBILE_NAV: NavItem[] = [HOME, PASSPORT, LOG, SAFETY, AGENTS];

function isActive(item: NavItem, current: string) {
  return item.prefix ? current.startsWith(item.prefix) : current === normalize(item.href);
}

function normalize(p: string) {
  return p.endsWith("/") ? p : `${p}/`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = normalize(pathname ?? "/");
  const { passportStatus } = usePatient();
  const clinicianSurface = current.startsWith("/clinician/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="print-hidden sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur safe-top">
        <div className={`mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6 ${clinicianSurface ? "max-w-[1440px]" : "max-w-6xl"}`}>
          <Link href="/" className="shrink-0" aria-label="Parthia Health home">
            <Wordmark />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2 md:flex" aria-label="Primary">
            {DESKTOP_NAV.map((item) => {
              const { href, label } = item;
              const active = isActive(item, current);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active ? "bg-brand-700 text-white" : "text-ink-soft hover:bg-brand-50 hover:text-brand-800"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/log/"
              className="hidden items-center gap-1 rounded-full bg-gold-500 px-3.5 py-1.5 text-sm font-semibold text-navy transition hover:bg-gold-600 md:inline-flex"
            >
              <PlusIcon className="h-4 w-4" /> Log
            </Link>
            <details className="relative hidden lg:block">
              <summary className="cursor-pointer list-none rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-brand-50 hover:text-brand-800">More</summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-40 rounded-xl border border-line bg-surface p-1 shadow-card">
                <Link href={ARCHITECTURE.href} className={`block rounded-lg px-3 py-2 text-sm font-medium ${isActive(ARCHITECTURE, current) ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-brand-50 hover:text-brand-800"}`}>Architecture</Link>
                <Link href="/about/" className={`block rounded-lg px-3 py-2 text-sm font-medium ${current === "/about/" ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-brand-50 hover:text-brand-800"}`}>About</Link>
              </div>
            </details>
            <span className="hidden sm:inline-flex"><InstallCTA /></span>
            <PatientSwitcher />
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-20 ${clinicianSurface ? "max-w-[1440px]" : "max-w-6xl"}`}>{passportStatus === "locked" ? <LockScreen /> : children}</main>

      {/* The patient agent dock. The clinician workspace keeps its own chat, so
          it is not rendered there, and it stays hidden while the Passport is
          locked because it answers from the record. */}
      {!clinicianSurface && passportStatus !== "locked" && <AskParthiaDock />}

      {/* Mobile tab bar */}
      <nav
        className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden safe-bottom"
        aria-label="Primary mobile"
      >
        <ul className="grid grid-cols-5 items-end">
          {MOBILE_NAV.map((item) => {
            const { href, label, icon: Icon } = item;
            const active = isActive(item, current);
            if (item === LOG) {
              return (
                <li key={href} className="flex justify-center">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className="-mt-5 flex flex-col items-center gap-0.5 pb-1.5 text-[11px] font-semibold text-navy"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500 shadow-card ring-4 ring-surface">
                      <Icon className="h-6 w-6 stroke-navy" />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                    active ? "text-brand-700" : "text-ink-muted"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "stroke-brand-700" : "stroke-ink-muted"}`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" />
    </svg>
  );
}
function PillIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="m9 9 6 6" />
    </svg>
  );
}
function TrendIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 17l5-6 4 4 5-7 4 3" /><path d="M3 21h18" />
    </svg>
  );
}
function PassportIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M12 8v5M9.5 10.5h5" /><path d="M9 17h6" />
    </svg>
  );
}
function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function AgentsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6" cy="8" r="2.2" /><circle cx="18" cy="8" r="2.2" /><circle cx="12" cy="17" r="2.2" />
      <path d="M8.2 8h7.6M7.4 9.9 10.6 15.3M16.6 9.9 13.4 15.3" />
    </svg>
  );
}
function ClinicianIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="7" r="3" /><path d="M5.5 20c.5-4 2.5-6 6.5-6s6 2 6.5 6" /><path d="M18 4v4M16 6h4" />
    </svg>
  );
}
