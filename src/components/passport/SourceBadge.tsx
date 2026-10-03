import type { DataSource, SourceKind } from "@/lib/types";

/**
 * Provenance chip shown next to every Passport item: where it came from and
 * whether the patient has confirmed it.
 */
export const SOURCE_STYLES: Record<SourceKind, { short: string; className: string }> = {
  seed: { short: "Sample data", className: "bg-cream-dark text-ink-soft ring-line-strong" },
  "patient-entered": { short: "You", className: "bg-brand-50 text-brand-800 ring-brand-100" },
  "document-scan": { short: "Scanned", className: "bg-gold-50 text-[#7a5812] ring-gold-200" },
  ehr: { short: "Health record", className: "bg-[#e8edf5] text-navy ring-[#cfd8e6]" },
  wearable: { short: "Wearable", className: "bg-[#eef1ea] text-[#44583a] ring-[#d8e0cf]" },
  device: { short: "Device", className: "bg-[#f1ecf5] text-[#5b4570] ring-[#e0d5ea]" },
};

export function SourceIcon({ kind, className = "h-3 w-3" }: { kind: SourceKind; className?: string }) {
  const common = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, "aria-hidden": true };
  switch (kind) {
    case "seed":
      return <svg {...common}><path d="M3 4h10M3 8h10M3 12h6" /></svg>;
    case "patient-entered":
      return <svg {...common}><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" /></svg>;
    case "document-scan":
      return <svg {...common}><path d="M2 5V3h2M12 3h2v2M14 11v2h-2M4 13H2v-2" /><path d="M5 6h6M5 8h6M5 10h4" /></svg>;
    case "ehr":
      return <svg {...common}><path d="M3 14V5l5-3 5 3v9" /><path d="M8 7v4M6 9h4" /></svg>;
    case "wearable":
      return <svg {...common}><rect x="4.5" y="4" width="7" height="8" rx="2" /><path d="M6 4V2h4v2M6 12v2h4v-2" /></svg>;
    case "device":
      return <svg {...common}><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M5 9h1.5l1-2 1.5 3 1-1H11" /></svg>;
  }
}

export function SourceBadge({ source, compact = false }: { source: DataSource; compact?: boolean }) {
  const style = SOURCE_STYLES[source.kind];
  // "Sample data" and "You" are clearest as-is; other sources show their own label.
  const text = source.kind === "seed" || source.kind === "patient-entered" ? style.short : source.label;
  const title = `Source: ${source.label}${source.verified ? "" : " — not yet confirmed by you"}${
    source.confidence !== undefined ? ` · ${Math.round(source.confidence * 100)}% confidence` : ""
  }`;
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style.className}`}
    >
      <SourceIcon kind={source.kind} />
      <span className="truncate">{compact ? style.short : text}</span>
      {!source.verified && <span className="font-semibold text-[#9e3b30]">· unconfirmed</span>}
      <span className="sr-only">{title}</span>
    </span>
  );
}

/** Several sources at once (e.g. a day of logs from you and your watch). */
export function SourceBadges({ sources }: { sources: DataSource[] }) {
  const unique = [...new Map(sources.map((s) => [`${s.kind}:${s.label}`, s])).values()];
  return (
    <span className="inline-flex flex-wrap gap-1">
      {unique.map((s) => (
        <SourceBadge key={`${s.kind}:${s.label}`} source={s} compact={unique.length > 2} />
      ))}
    </span>
  );
}
