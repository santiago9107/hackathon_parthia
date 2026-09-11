"use client";

import Link from "next/link";
import { useInstall } from "@/lib/pwa/useInstall";

/**
 * "Install Parthia Health" call-to-action for the header.
 *  - Chromium (Android/desktop) with a captured prompt → triggers it directly.
 *  - iOS Safari → routes to the designed Share → Add to Home Screen walkthrough.
 *  - Already installed → renders nothing.
 */
export function InstallCTA({ variant = "header" }: { variant?: "header" | "banner" }) {
  const { ready, isInstalled, canPrompt, promptInstall } = useInstall();
  if (!ready || isInstalled) return null;

  const base =
    variant === "header"
      ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gold-500/40 bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-700 transition hover:bg-gold-100"
      : "inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800";

  const icon = (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v9" /><path d="m6.5 8.5 3.5 3.5 3.5-3.5" /><path d="M4 14v2.5h12V14" />
    </svg>
  );

  if (canPrompt) {
    return (
      <button type="button" onClick={() => promptInstall()} className={base}>
        {icon}
        <span className={variant === "header" ? "hidden sm:inline" : ""}>Install Parthia Health</span>
        <span className={variant === "header" ? "sm:hidden" : "hidden"}>Install</span>
      </button>
    );
  }

  return (
    <Link href="/install/" className={base}>
      {icon}
      <span className={variant === "header" ? "hidden sm:inline" : ""}>Install Parthia Health</span>
      <span className={variant === "header" ? "sm:hidden" : "hidden"}>Install</span>
    </Link>
  );
}
