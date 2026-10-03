import type { AgentRun, ClinicianCase, ClinicianDecision } from "./types";

const safe = (value: string) => value.replace(/\|/g, "\\|");

export function buildClinicianReport(caseData: ClinicianCase, run: AgentRun, decisions: ClinicianDecision[]): string {
  const out = [`# Parthia Health clinician reconciliation`, "", "> SYNTHETIC DEMONSTRATION DATA. Prototype decision support, not clinical validation.", "", `- **Patient:** ${caseData.patientName}, ${caseData.age} (synthetic)`, `- **Status:** ${run.status}`, `- **As of:** 2026-10-03`, "", "## Sources", "", "| Source | Format | Updated | Available |", "|---|---|---|---|"];
  for (const source of run.sources) out.push(`| ${source.label} | ${source.format} | ${source.lastUpdated} | ${source.available ? "yes" : "no"} |`);
  out.push("", "## Reconciled medications", "", "| Ingredient | As written | Type | Status | Source |", "|---|---|---|---|---|");
  for (const medication of run.medications) for (const record of medication.records) out.push(`| ${medication.ingredient}${medication.rxcui ? ` (RxCUI ${medication.rxcui})` : ""} | ${safe(record.display)} | ${record.recordType} | ${record.status} | ${record.sourceLabel} |`);
  out.push("", "## Findings and decisions", "");
  for (const finding of run.findings) {
    const decision = decisions.find((d) => d.findingId === finding.id);
    out.push(`### ${finding.title}`, `- **Priority:** ${finding.priority} (configured review priority)`, `- **Route:** ${finding.route}`, `- **Question:** ${finding.question}`, `- **Decision:** ${decision ? `${decision.action} by ${decision.reviewer}${decision.note ? `: ${decision.note}` : ""}` : "Open"}`);
    if (finding.citation) out.push(`- **Evidence:** ${finding.citation.sourceName}: “${finding.citation.passage}” (${finding.citation.url})`);
    for (const rule of finding.supportingRules ?? []) {
      out.push(`- **Parthia rule:** ${rule.ruleId} (${rule.severity})`);
      for (const line of rule.evidence) out.push(`  - ${safe(line)}`);
    }
    out.push("");
  }
  out.push("## Agent audit trail", "", "| # | Stage | Tool | Status | Summary |", "|---|---|---|---|---|");
  for (const entry of run.trace) out.push(`| ${entry.seq} | ${entry.stage} | ${entry.tool} | ${entry.status} | ${safe(entry.summary)} |`);
  out.push("", "Parthia did not start, stop, substitute or prescribe a medication. Human review remains required.");
  return out.join("\n");
}
