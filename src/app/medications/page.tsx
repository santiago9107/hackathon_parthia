"use client";

import { useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { RULES, flagsByCategory, knowledge } from "@/lib/safetyEngine";
import { PageHeader, Card, Disclaimer } from "@/components/PageHeader";
import { RiskFlagCard } from "@/components/RiskFlagCard";
import { CATEGORY_LABELS, SEVERITY_STYLES, SeverityBadge } from "@/components/Badges";
import type { RiskCategory } from "@/lib/types";
import { SourceBadge } from "@/components/passport/SourceBadge";

const CATEGORY_ORDER: RiskCategory[] = ["drug-drug", "drug-nutrient", "drug-mood", "anticholinergic-burden"];

export default function MedicationsPage() {
  const { record, flags } = usePatient();
  const { patient } = record;
  const grouped = flagsByCategory(flags);
  const [showRules, setShowRules] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Medication Safety"
        title="Your medicines, checked together"
        subtitle={`${patient.medications.length} active medicines checked against each other, your meals, your mood and your symptoms. ${flags.length} item${flags.length === 1 ? "" : "s"} to raise with ${patient.primaryClinician.split(",")[0]}.`}
      />

      {/* Medication list with inline flags */}
      <section aria-labelledby="meds-heading">
        <h2 id="meds-heading" className="mb-3 font-serif text-2xl font-semibold text-navy">
          Current medications
        </h2>
        <div className="space-y-3">
          {patient.medications.map((med) => {
            const related = flags.filter((f) => f.medications.includes(med.name));
            const top = related[0];
            const acb = knowledge.ANTICHOLINERGIC_BURDEN[med.genericName];
            const psychotropic = knowledge.PSYCHOTROPIC_CLASSES.has(med.class);
            return (
              <Card key={med.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-lg font-semibold text-navy">{med.name}</h3>
                      <span className="rounded-full bg-cream-dark px-2 py-0.5 text-[11px] font-medium text-ink-soft">{med.class.replace(/-/g, " ")}</span>
                      {psychotropic && <span className="rounded-full bg-cream-dark px-2 py-0.5 text-[11px] font-medium text-ink-soft">acts on the brain</span>}
                      {acb && <span className="rounded-full bg-cream-dark px-2 py-0.5 text-[11px] font-medium text-ink-soft">anticholinergic score {acb}</span>}
                      <SourceBadge source={med.source} />
                    </div>
                    <p className="mt-1 text-sm text-ink">
                      <span className="font-semibold">{med.dose}</span> · {med.frequency}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {med.indication ? `${med.indication} · ` : ""}since {new Date(`${med.startDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {top ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${SEVERITY_STYLES[top.severity].className}`}>
                        {related.length} flag{related.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-good-soft px-2.5 py-1 text-xs font-semibold text-good">No flags</span>
                    )}
                  </div>
                </div>
                {related.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-line pt-3">
                    {related.map((f) => (
                      <li key={f.id} className="flex flex-col gap-1 rounded-xl bg-cream px-3.5 py-3 sm:flex-row sm:items-start sm:gap-3">
                        <div className="shrink-0 pt-0.5">
                          <SeverityBadge severity={f.severity} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{f.title}</p>
                          <p className="mt-0.5 text-sm text-ink-soft">{f.explanation}</p>
                          <p className="mt-1.5 text-sm text-ink">
                            <span className="font-semibold text-gold-700">Ask your doctor: </span>
                            {f.suggestedNextStep}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* All flags, grouped by category */}
      <section className="mt-10" aria-labelledby="flags-heading">
        <h2 id="flags-heading" className="mb-1 font-serif text-2xl font-semibold text-navy">
          Active safety flags
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Each flag shows the evidence it used. Nothing here is a scored risk number — every item is a specific, checkable rule.</p>
        {flags.length === 0 && <Card className="p-5 text-sm text-ink-muted">No flags for {patient.name.split(" ")[0]} right now.</Card>}
        <div className="space-y-8">
          {CATEGORY_ORDER.filter((c) => grouped[c].length > 0).map((c) => (
            <div key={c}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-700">{CATEGORY_LABELS[c]}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {grouped[c].map((f) => (
                  <RiskFlagCard key={f.id} flag={f} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Transparency panel */}
      <section className="mt-10">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold text-navy">How the safety check works</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {RULES.length} transparent rules run over your record. No machine-learning score — every rule is readable and every flag names the rule that raised it.
              </p>
            </div>
            <button type="button" onClick={() => setShowRules((s) => !s)} className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-900" aria-expanded={showRules}>
              {showRules ? "Hide rules" : "Show rules"}
            </button>
          </div>
          {showRules && (
            <ul className="mt-4 divide-y divide-line">
              {RULES.map((r) => {
                const fired = flags.some((f) => f.ruleId.startsWith(r.id));
                return (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${fired ? "bg-attention" : "bg-line-strong"}`} aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {r.name} <span className="ml-1 rounded-full bg-cream-dark px-2 py-0.5 text-[11px] font-medium text-ink-soft">{CATEGORY_LABELS[r.category]}</span>
                      </p>
                      <p className="text-sm text-ink-muted">{r.description}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{r.id}{fired ? " · fired for this patient" : ""}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <Disclaimer />
    </div>
  );
}
