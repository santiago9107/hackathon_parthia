"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import { PatientSwitcher } from "./PatientSwitcher";
import { InstallCTA } from "./InstallCTA";

const NAV = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/medications/", label: "Medications", icon: PillIcon },
  { href: "/trends/", label: "Trends", icon: TrendIcon },
  { href: "/share/", label: "Share", icon: ShareIcon },
  { href: "/assistant/", label: "Assistant", icon: ChatIcon },
];

function normalize(p: string) {
  return p.endsWith("/") ? p : `${p}/`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = normalize(pathname ?? "/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="print-hidden sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur safe-top">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Parthia Health home">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map(({ href, label }) => {
              const active = current === normalize(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active ? "bg-brand-700 text-white" : "text-ink-soft hover:bg-brand-50 hover:text-brand-800"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <InstallCTA />
            <PatientSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-12">{children}</main>

      {/* Mobile tab bar */}
      <nav
        className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden safe-bottom"
        aria-label="Primary mobile"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = current === normalize(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
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
function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </svg>
  );
}
function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}
