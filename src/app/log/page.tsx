"use client";

import Link from "next/link";
import { PageHeader, Disclaimer } from "@/components/PageHeader";
import { LocalOnlyNotice, fmtDate } from "@/components/passport/PassportChrome";
import { REFERENCE_DATE } from "@/lib/mockData";
import { LOG_ACTIONS } from "@/lib/log/actions";
import { AppIcon } from "@/components/AppIcon";

export default function LogPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Log"
        title="Add to your Passport"
        subtitle={`Everything you log is saved as "entered by you" in your Passport. Demo date: ${fmtDate(REFERENCE_DATE, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`}
      />
      <LocalOnlyNotice className="mb-4" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LOG_ACTIONS.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-brand-300">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><AppIcon name={a.icon} /></span>
              <span>
                <span className="block font-semibold text-ink">{a.label}</span>
                <span className="block text-sm text-ink-muted">{a.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-ink-muted">
        Importing from a hospital record, a document, Apple Health or a device? <Link href="/passport/add/" className="font-semibold text-brand-700 hover:text-brand-900">Add to my Passport →</Link>
      </p>
      <Disclaimer />
    </div>
  );
}
