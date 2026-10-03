"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice, fmtDate } from "@/components/passport/PassportChrome";
import { REFERENCE_DATE } from "@/lib/mockData";

/**
 * Mobile-first form building blocks: large touch targets (≥48px), real
 * labels, errors tied to inputs with aria-describedby, and a Save bar that
 * stays reachable above the mobile tab bar.
 */

const inputClass =
  "block w-full min-h-12 rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

export function FormPage({ title, eyebrow = "Log", subtitle, children, showDemoDate = true }: { title: string; eyebrow?: string; subtitle?: string; children: ReactNode; showDemoDate?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/log/" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-900">← All log options</Link>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-navy">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{subtitle}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <LocalOnlyNotice />
        {showDemoDate && <DemoDateNote />}
      </div>
      <div className="mt-6">{children}</div>
      <Disclaimer />
    </div>
  );
}

export function DemoDateNote() {
  return (
    <p className="text-xs text-ink-muted">
      Demo date: <strong className="font-semibold text-ink-soft">{fmtDate(REFERENCE_DATE, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
    </p>
  );
}

export function Form({ onSubmit, children, label }: { onSubmit: () => void | Promise<void>; children: ReactNode; label: string }) {
  return (
    <form
      aria-label={label}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="space-y-5"
    >
      {children}
    </form>
  );
}

function FieldShell({ id, label, hint, error, children, optional }: { id: string; label: string; hint?: string; error?: string; children: ReactNode; optional?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label} {optional && <span className="font-normal text-ink-muted">(optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="-mt-1 mb-1.5 text-sm text-ink-muted">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-attention">{error}</p>}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  label, value, onChange, error, hint, optional, type = "text", inputMode, list, placeholder, autoComplete, suffix, min, max, step,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; optional?: boolean;
  type?: "text" | "number" | "date" | "time" | "tel" | "email" | "datetime-local"; inputMode?: "decimal" | "numeric" | "tel" | "text";
  list?: string; placeholder?: string; autoComplete?: string; suffix?: ReactNode; min?: string; max?: string; step?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          list={list}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${inputClass} ${error ? "border-attention" : "border-line-strong"}`}
        />
        {suffix}
      </div>
    </FieldShell>
  );
}

export function TextArea({ label, value, onChange, hint, optional = true, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; optional?: boolean; rows?: number; placeholder?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} optional={optional}>
      <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy(id, hint)} className={`${inputClass} border-line-strong py-3`} />
    </FieldShell>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, error, optional }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; error?: string; optional?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} optional={optional}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, undefined, error)} className={`${inputClass} border-line-strong`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}

/** Single choice as big tappable cards (native radios inside a fieldset). */
export function ChoiceGroup<T extends string | number>({
  legend, options, value, onChange, columns = 2, error, hint,
}: {
  legend: string; options: { value: T; label: string; hint?: string; icon?: ReactNode }[]; value: T | null; onChange: (v: T) => void; columns?: 1 | 2 | 3 | 5; error?: string; hint?: string;
}) {
  const name = useId();
  const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 5: "grid-cols-5" }[columns];
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="-mt-1 mb-1.5 text-sm text-ink-muted">{hint}</p>}
      <div className={`grid gap-2 ${cols}`}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={String(o.value)}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition focus-within:ring-2 focus-within:ring-brand-500 ${
                checked ? "border-brand-700 bg-brand-50 text-brand-900" : "border-line-strong bg-surface text-ink hover:border-brand-300"
              }`}
            >
              <input type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(o.value)} />
              {o.icon && <span aria-hidden className="text-xl">{o.icon}</span>}
              <span>
                <span className="block font-semibold">{o.label}</span>
                {o.hint && <span className="block text-xs text-ink-muted">{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-medium text-attention">{error}</p>}
    </fieldset>
  );
}

/** Multiple choice as toggle chips (native checkboxes). */
export function ChipGroup<T extends string>({ legend, options, value, onChange, hint }: { legend: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; hint?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="-mt-1 mb-1.5 text-sm text-ink-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-medium ring-1 transition focus-within:ring-2 focus-within:ring-brand-500 ${on ? "bg-brand-700 text-white ring-brand-700" : "bg-surface text-ink-soft ring-line-strong hover:bg-brand-50"}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} />
              {on && <span aria-hidden className="mr-1">✓</span>}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Edit a list of short strings (restrictions, goals…). */
export function ListEditor({ label, items, onChange, placeholder, hint }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {hint && <p className="-mt-1 mb-1.5 text-sm text-ink-muted">{hint}</p>}
      {items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((it) => (
            <li key={it} className="flex items-center justify-between gap-2 rounded-xl bg-cream/70 px-3 py-2 text-sm text-ink">
              {it}
              <button type="button" onClick={() => onChange(items.filter((x) => x !== it))} className="min-h-11 min-w-11 rounded-full text-ink-muted hover:bg-cream-dark hover:text-attention" aria-label={`Remove ${it}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input id={id} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={`${inputClass} border-line-strong`} />
        <button type="button" onClick={add} className="min-h-12 shrink-0 rounded-xl bg-surface px-4 text-sm font-semibold text-brand-700 ring-1 ring-line-strong hover:bg-brand-50">Add</button>
      </div>
    </div>
  );
}

export function SubmitBar({ label, busy, error, extra }: { label: string; busy?: boolean; error?: string | null; extra?: ReactNode }) {
  return (
    <div className="sticky bottom-24 z-10 -mx-4 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-card md:border md:px-4">
      {error && <p role="alert" className="mb-2 text-sm font-medium text-attention">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="min-h-12 flex-1 rounded-full bg-brand-700 px-6 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60 sm:flex-none">
          {busy ? "Saving…" : label}
        </button>
        {extra}
      </div>
    </div>
  );
}

/** Shown after saving: what happened and where to go next. */
export function SavedPanel({ title, children, onAnother, anotherLabel = "Log another", links = [] }: { title: string; children?: ReactNode; onAnother?: () => void; anotherLabel?: string; links?: { href: string; label: string }[] }) {
  return (
    <div role="status" className="rounded-card border border-good/30 bg-good-soft p-5">
      <p className="font-serif text-xl font-semibold text-navy">✓ {title}</p>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {onAnother && <button type="button" onClick={onAnother} className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">{anotherLabel}</button>}
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex min-h-12 items-center rounded-full bg-surface px-5 text-sm font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">{l.label}</Link>
        ))}
      </div>
    </div>
  );
}

/** Run an async save with busy/error state. */
export function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(fn: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, save };
}
