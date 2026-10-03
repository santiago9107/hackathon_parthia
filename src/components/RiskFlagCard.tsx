"use client";

import { useState } from "react";
import type { RiskFlag } from "@/lib/types";
import { CategoryChip, MedChip, SeverityBadge } from "./Badges";
import { Card } from "./PageHeader";

export function RiskFlagCard({ flag, compact = false }: { flag: RiskFlag; compact?: boolean }) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <Card className={compact ? "p-4" : "p-5"}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={flag.severity} />
        <CategoryChip category={flag.category} />
      </div>
      <h3 className={`mt-2.5 font-serif font-semibold text-navy ${compact ? "text-base" : "text-lg"}`}>{flag.title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flag.medications.slice(0, compact ? 4 : 12).map((m) => (
          <MedChip key={m} name={m} />
        ))}
        {compact && flag.medications.length > 4 && (
          <span className="text-xs text-ink-muted">+{flag.medications.length - 4} more</span>
        )}
      </div>
      {!compact && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{flag.explanation}</p>}

      <div className="mt-3 rounded-xl border border-gold-200 bg-gold-50 px-3.5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">Suggested next step</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{flag.suggestedNextStep}</p>
      </div>

      {!compact && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowEvidence((s) => !s)}
            className="text-sm font-semibold text-brand-700 hover:text-brand-900"
            aria-expanded={showEvidence}
          >
            {showEvidence ? "Hide" : "Why was this flagged?"}
          </button>
          {showEvidence && (
            <div className="mt-2 rounded-xl bg-cream px-3.5 py-3 text-sm text-ink-soft">
              <ul className="list-disc space-y-1 pl-4">
                {flag.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-[11px] text-ink-muted">rule: {flag.ruleId}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
