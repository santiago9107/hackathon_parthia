import { Card, PageHeader } from "@/components/PageHeader";
import { analyzePatient } from "../../../analytics/src/analyze";
import margaretFixture from "../../../analytics/fixtures/margaret.json";

/**
 * Santiago Enriquez's holistic analysis module, run for real on his synthetic
 * Margaret fixture at build time. The engine is deterministic and pure (no
 * clock, no network, no language model), so this page shows exactly what the
 * module returns and nothing is written by hand.
 *
 * The module has its own data model. Mapping the Patient Passport into it is
 * the next step, so this page is labelled as the module's own sample patient.
 */
const AS_OF = "2026-10-03T12:00:00Z";
const bundle = analyzePatient(margaretFixture as never, AS_OF, { knowledge_mode: "development" });

const STATUS: Record<string, { label: string; className: string }> = {
  good: { label: "Good", className: "bg-good-soft text-good" },
  watch: { label: "Watch", className: "bg-watch-soft text-[#5c430d]" },
  attention: { label: "Needs attention", className: "bg-attention-soft text-attention" },
  insufficient_data: { label: "Not enough data", className: "bg-cream-dark text-ink-soft" },
};
const TREND: Record<string, string> = { improving: "Improving", stable: "Stable", worsening: "Worsening", unknown: "Trend unknown" };

export default function AnalyticsPage() {
  const findings = bundle.ranked_findings.slice(0, 6);
  const missing = bundle.missing_data.filter((item) => item.suggested_patient_question).slice(0, 4);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Holistic analysis"
        title="Every domain of health, scored by rules, never by a model"
        subtitle="Santiago Enriquez's analysis module, running live on its own synthetic sample patient. It reads a patient snapshot, applies a clinician-reviewed knowledge base and returns findings with the evidence behind each one."
      />

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
        <span><strong className="text-ink">{bundle.audit.rules_evaluated.length}</strong> rules evaluated</span>
        <span><strong className="text-ink">{bundle.ranked_findings.length}</strong> findings</span>
        <span><strong className="text-ink">{bundle.urgent.length}</strong> urgent items</span>
        <span><strong className="text-ink">{bundle.audit.knowledge_rows_used.length}</strong> knowledge rows cited</span>
        <span>Heart-failure type: <strong className="text-ink">{bundle.phenotype.value ?? "not determined"}</strong></span>
      </div>

      {bundle.urgent.length > 0 && (
        <Card className="mb-6 border-attention p-5" accent="#b5473a">
          <h2 className="font-serif text-xl font-semibold text-navy">Urgent first</h2>
          <ul className="mt-3 space-y-3">
            {bundle.urgent.map((item) => (
              <li key={item.urgent_id}>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{item.patient_message}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="font-serif text-2xl font-semibold text-navy">Domains</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundle.domain_profile.map((domain) => {
          const status = STATUS[domain.status] ?? STATUS.insufficient_data!;
          return (
            <Card key={domain.domain} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-ink">{domain.label}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
              </div>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-muted">{TREND[domain.trend] ?? domain.trend}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{domain.reason}</p>
            </Card>
          );
        })}
      </div>

      <h2 className="mt-10 font-serif text-2xl font-semibold text-navy">Top findings</h2>
      <div className="mt-3 space-y-3">
        {findings.map((finding) => (
          <Card key={finding.finding_id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">{finding.severity}</span>
              <span className="text-xs text-ink-muted">{finding.rule_id}</span>
            </div>
            <p className="mt-2 text-base font-semibold text-ink">{finding.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{finding.summary}</p>
            <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm font-medium text-ink-soft">Ask your care team: {finding.patient_question}</p>
          </Card>
        ))}
      </div>

      {missing.length > 0 && (
        <>
          <h2 className="mt-10 font-serif text-2xl font-semibold text-navy">What it would like to know</h2>
          <Card className="mt-3 divide-y divide-line">
            {missing.map((item) => (
              <div key={item.element_id} className="px-5 py-3">
                <p className="text-sm font-semibold text-ink">{item.element_name}</p>
                <p className="text-sm text-ink-soft">{item.suggested_patient_question}</p>
              </div>
            ))}
          </Card>
        </>
      )}

      <Card className="mt-10 p-5">
        <h2 className="font-serif text-lg font-semibold text-navy">What is built, and what is next</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Module version {bundle.module_version}, as of {AS_OF.slice(0, 10)}, knowledge mode: {bundle.knowledge_mode}. The same input always produces the same output.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Not built yet</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {bundle.audit.not_implemented.map((line) => <li key={line}>{line}</li>)}
          <li>Mapping the Patient Passport into this module&apos;s data model, so every patient in Parthia can be analysed this way.</li>
        </ul>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-muted">Analysis module by Santiago Enriquez. Synthetic patient. Prototype decision support, not clinical validation.</p>
    </div>
  );
}
