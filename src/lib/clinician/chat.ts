import { checkTool, toolForRequest } from "./policy";
import type { AgentRun, ClinicianDecision } from "./types";

export const CLINICIAN_CHAT_EXAMPLES = [
  "What needs review first?",
  "Why is warfarin flagged?",
  "Which sources disagree?",
  "Where did ibuprofen come from?",
  "What did you do autonomously?",
  "Is any source incomplete?",
  "Stop ibuprofen",
];

export interface ClinicianChatReply { text: string; tools: string[]; refused?: boolean; findingId?: string; source?: "deterministic" | "openrouter" }

export function answerClinician(question: string, run: AgentRun | null, decisions: ClinicianDecision[]): ClinicianChatReply {
  const q = question.trim();
  const lower = q.toLowerCase();
  const requestedTool = toolForRequest(q);
  if (requestedTool) {
    const policy = checkTool(requestedTool);
    return { refused: true, tools: [`policy.check(${requestedTool})`], text: `I can't do that. ${policy.reason} I can explain the evidence and route it for review.` };
  }
  if (!run) return { tools: [], text: "Launch the agent first. I need a reconciled record before I answer patient-specific questions." };
  const findingFor = (ingredient: string) => run.findings.filter((f) => f.ingredients.includes(ingredient));
  const named = [...new Set(run.records.map((r) => r.ingredient))].find((name) => lower.includes(name));
  if (named && /why|flag|evidence|risk|review/.test(lower)) {
    const findings = findingFor(named);
    if (!findings.length) return { tools: ["lookup_findings"], text: `No configured rule flagged ${named}. That is not a clinical safety conclusion.` };
    return { tools: ["lookup_findings", "get_evidence", "get_provenance"], findingId: findings[0].id, text: findings.map((f) => `${f.title}\n${f.detail}${f.citation ? `\nEvidence: “${f.citation.passage}” (${f.citation.sourceName})` : ""}\nSources: ${f.recordIds.join(", ")}`).join("\n\n") };
  }
  if (named && /where|source|provenance|come from/.test(lower)) {
    const records = run.records.filter((r) => r.ingredient === named);
    return { tools: ["get_provenance"], text: records.map((r) => `• ${r.display}: ${r.sourceLabel}, ${r.recordType}, ${r.status}, ${r.recordedOn}`).join("\n") };
  }
  if (/disagree|conflict|mismatch/.test(lower)) {
    const findings = run.findings.filter((f) => f.kind === "status-conflict" || f.kind === "strength-mismatch");
    return { tools: ["reconcile_records", "get_provenance"], findingId: findings[0]?.id, text: findings.length ? findings.map((f) => `• ${f.title}: ${f.detail}`).join("\n") : "The loaded sources agree on the mapped medication statuses and strengths." };
  }
  if (/incomplete|unavailable|missing|stale|quality/.test(lower)) {
    const findings = run.findings.filter((f) => f.priority === "data-quality");
    return { tools: ["check_sources", "validate_records"], text: findings.length ? findings.map((f) => `• ${f.title}: ${f.detail}`).join("\n") : "Every configured source responded and passed validation." };
  }
  if (/what did you|autonom|trace|steps/.test(lower)) return { tools: ["get_agent_trace"], text: `${run.autonomousCount} steps ran autonomously: gather, validate, normalize, reconcile, check and explain. ${run.humanCount} decision${run.humanCount === 1 ? "" : "s"} remain with a person. No medication was changed.` };
  if (/review|first|pending|open|need/.test(lower)) {
    const done = new Set(decisions.map((d) => d.findingId));
    const open = run.findings.filter((f) => f.blocking && !done.has(f.id));
    return { tools: ["rank_findings", "lookup_findings"], findingId: open[0]?.id, text: open.length ? open.map((f) => `• ${f.title} (${f.priority}, ${f.route})`).join("\n") : "No finding is waiting for a decision." };
  }
  return { tools: [], text: "Ask me what needs review, why a medicine was flagged, where a record came from, which sources disagree, or what I did autonomously. I cannot change medications." };
}
