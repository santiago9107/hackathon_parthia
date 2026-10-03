"use client";

import Link from "next/link";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceIcon, SOURCE_STYLES } from "@/components/passport/SourceBadge";
import { SectionTitle, fmtDateTime } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { SOURCE_CATALOG } from "@/lib/passport/catalog";
import { describeCollectionCounts, summarizeSources } from "@/lib/passport/items";

export default function SourcesPage() {
  const { record, local } = usePatient();
  const sources = summarizeSources(record, local);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle>Where my Passport data comes from</SectionTitle>
        <ul className="divide-y divide-line">
          {sources.map((s) => (
            <li key={s.key} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ${SOURCE_STYLES[s.kind].className}`}>
                  <SourceIcon kind={s.kind} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{s.label}</p>
                  <p className="text-xs text-ink-muted">
                    {s.connection ? `${s.connection.status === "connected" ? "Connected" : "Disconnected"}${s.connection.simulated ? " (simulated)" : ""} · ` : ""}
                    {s.lastImportAt ? `last import ${fmtDateTime(s.lastImportAt)}` : s.kind === "seed" ? "bundled with this demo" : "—"}
                  </p>
                  <p className="mt-1 text-ink-soft">{describeCollectionCounts(s.byCollection) || "No confirmed items yet"}</p>
                </div>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold text-ink">{s.confirmed} confirmed</p>
                {s.pending > 0 && (
                  <Link href="/passport/review/" className="font-semibold text-[#7a5812] hover:underline">{s.pending} waiting for review</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionTitle>Add a source</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SOURCE_CATALOG.map((o) => (
            <li key={o.id}>
              <Link href={o.href} className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 hover:border-brand-300">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <SourceIcon kind={o.kind} className="h-4 w-4 text-brand-700" /> {o.name}
                </span>
                <span className="mt-1 text-sm text-ink-soft">{o.description}</span>
                <span className={`mt-2 text-xs font-semibold ${o.status === "simulated" ? "text-[#7a5812]" : "text-brand-700"}`}>{o.statusNote}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Disclaimer />
    </div>
  );
}
