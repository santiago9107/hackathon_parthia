import type { RiskCategory, RiskSeverity, StatusLevel } from "@/lib/types";

export const SEVERITY_STYLES: Record<RiskSeverity, { label: string; className: string; dot: string }> = {
  high: { label: "High", className: "bg-attention-soft text-attention border-attention/20", dot: "bg-attention" },
  moderate: { label: "Moderate", className: "bg-watch-soft text-gold-700 border-gold-500/25", dot: "bg-watch" },
  low: { label: "Low", className: "bg-brand-50 text-brand-700 border-brand-300/40", dot: "bg-brand-500" },
};

export const LEVEL_STYLES: Record<StatusLevel, { label: string; className: string; dot: string; accent: string }> = {
  good: { label: "Looking good", className: "bg-good-soft text-good", dot: "bg-good", accent: "border-l-good" },
  watch: { label: "Worth watching", className: "bg-watch-soft text-gold-700", dot: "bg-watch", accent: "border-l-watch" },
  attention: { label: "Needs attention", className: "bg-attention-soft text-attention", dot: "bg-attention", accent: "border-l-attention" },
};

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  "drug-drug": "Medicine + medicine",
  "drug-nutrient": "Medicine + food",
  "drug-mood": "Medicine + mood",
  "anticholinergic-burden": "Overall burden",
};

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function LevelBadge({ level }: { level: StatusLevel }) {
  const s = LEVEL_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function CategoryChip({ category }: { category: RiskCategory }) {
  return (
    <span className="inline-flex items-center rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-medium text-ink-soft">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function MedChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-brand-100">
      {name}
    </span>
  );
}
