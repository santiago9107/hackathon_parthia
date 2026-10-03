"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import type { DocumentType } from "@/lib/types";
import { DOCUMENT_TYPE_LABELS } from "@/lib/passport/labels";

export default function DocumentsPage() {
  const { record } = usePatient();
  const [type, setType] = useState<DocumentType | "all">("all");
  const docs = [...record.documents].sort((a, b) => b.date.localeCompare(a.date));
  const types = [...new Set(docs.map((d) => d.type))];
  const shown = type === "all" ? docs : docs.filter((d) => d.type === type);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as DocumentType | "all")} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink">
            <option value="all">All ({docs.length})</option>
            {types.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <Link href="/passport/add/scan/" className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Scan a document</Link>
      </div>

      {shown.length === 0 ? <EmptyState>No documents yet.</EmptyState> : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((d) => (
            <li key={d.id}>
              <Card className="h-full p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{DOCUMENT_TYPE_LABELS[d.type]}</p>
                    <h2 className="font-serif text-lg font-semibold text-navy">{d.title}</h2>
                    <p className="text-xs text-ink-muted">{fmtDate(d.date)}{d.author ? ` · ${d.author}` : ""}{d.organization ? ` · ${d.organization}` : ""}</p>
                  </div>
                  <SourceBadge source={d.source} />
                </div>
                {d.imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL, not optimizable
                  <img src={d.imageDataUrl} alt={`Scanned image of ${d.title}`} className="mt-3 max-h-56 rounded-lg border border-line object-contain" />
                )}
                {d.text && (
                  <details className="mt-3">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-700 hover:text-brand-900">Show text</summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-cream/70 p-3 font-sans text-sm leading-relaxed text-ink-soft">{d.text}</pre>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Disclaimer />
    </div>
  );
}
