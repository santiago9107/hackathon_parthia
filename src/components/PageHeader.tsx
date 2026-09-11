import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <section
      className={`rounded-card border border-line bg-surface shadow-card ${accent ? `border-l-4 ${accent}` : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
      Demo prototype with synthetic data. Parthia Health surfaces questions for you to raise with your care team; it does not
      diagnose, and nothing here is an instruction to start, stop or change a medicine.{" "}
      <Link href="/about/" className="font-semibold text-brand-700 hover:text-brand-900">
        About this prototype →
      </Link>
    </p>
  );
}
