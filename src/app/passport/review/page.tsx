"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, LocalOnlyNotice, SectionTitle, fmtDate, fmtDateTime } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { confirmEntry, describeItem, discardEntry } from "@/lib/passport/actions";
import { COLLECTION_LABELS, type LocalEntry } from "@/lib/passport/collections";
import { pendingEntries } from "@/lib/passport/ops";
import { ReconciliationSection } from "@/components/passport/Reconciliation";

/** Forms that can correct a pending item before it is confirmed. */
const EDIT_FORMS: Partial<Record<LocalEntry["collection"], string>> = {
  medications: "/log/medication/",
  allergies: "/log/allergy/",
  appointments: "/log/appointment/",
};

/** The clinical date of an item (not when it was imported), if it has one. */
function itemDate(item: LocalEntry["item"]): string | undefined {
  const i = item as unknown as Record<string, unknown>;
  const d = i.date ?? i.start ?? i.timestamp ?? i.startDate ?? i.recordedOn;
  return typeof d === "string" && d ? d : undefined;
}

export default function ReviewPage() {
  const { patientId, local } = usePatient();
  const [busy, setBusy] = useState(false);
  const pending = pendingEntries(local);
  const groups = new Map<string, LocalEntry[]>();
  for (const e of pending) {
    const k = e.item.source.label;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-navy">Review my Passport</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          You are responsible for what goes into your Passport. Confirm what&apos;s right, correct what isn&apos;t, and discard anything that
          doesn&apos;t belong. Items waiting here are <strong>not</strong> used in any analysis.
        </p>
        <LocalOnlyNotice className="mt-2" />
      </div>

      <ReconciliationSection />

      {pending.length === 0 && (
        <EmptyState action={<Link href="/passport/add/" className="text-sm font-semibold text-brand-700 hover:text-brand-900">Add to my Passport →</Link>}>
          Nothing is waiting for review.
        </EmptyState>
      )}

      {[...groups.entries()].map(([label, entries]) => (
        <Card key={label} className="p-5">
          <SectionTitle
            action={
              <button
                type="button"
                disabled={busy}
                onClick={() => run(async () => { for (const e of entries) await confirmEntry(patientId, e.collection, e.item.id); })}
                className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                Confirm all {entries.length}
              </button>
            }
          >
            From {label}
          </SectionTitle>
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={`${e.collection}:${e.item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{COLLECTION_LABELS[e.collection].one}</p>
                  <p className="font-medium text-ink">{describeItem(e.item)}{itemDate(e.item) && <span className="ml-2 text-xs font-normal text-ink-muted">{fmtDate(itemDate(e.item)!)}</span>}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <SourceBadge source={e.item.source} />
                    <span>imported {fmtDateTime(e.item.source.importedAt)}</span>
                  </div>
                  {e.item.source.originalText && <p className="mt-1 text-xs italic text-ink-muted">“{e.item.source.originalText}”</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {EDIT_FORMS[e.collection] && (
                    <Link href={`${EDIT_FORMS[e.collection]}?id=${encodeURIComponent(e.item.id)}`} className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">
                      Correct
                    </Link>
                  )}
                  <button type="button" disabled={busy} onClick={() => run(() => discardEntry(patientId, e.collection, e.item.id))} className="min-h-11 rounded-full px-3 font-semibold text-ink-soft ring-1 ring-line hover:bg-cream-dark disabled:opacity-50">
                    Discard
                  </button>
                  <button type="button" disabled={busy} onClick={() => run(() => confirmEntry(patientId, e.collection, e.item.id))} className="min-h-11 rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
                    Confirm
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Disclaimer />
    </div>
  );
}
