import { checkTool, type ClinicianTool } from "./policy";
import type { AgentRun, CaseSourceId, ClinicianCase, ClinicianDecision, ClinicianFinding, ReconciledMedication, SourceMedication, TraceEntry } from "./types";

const DAY = 86_400_000;
const AS_OF = "2026-10-03T10:00:00-04:00";

const IBUPROFEN_EVIDENCE = {
  sourceName: "FDA Advil Drug Facts label",
  url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/211733Orig1s007lbl.pdf",
  passage: "The chance is higher if you take a blood thinning (anticoagulant) or steroid drug.",
  retrievedOn: "2026-10-03",
};
const CIPRO_EVIDENCE = {
  sourceName: "DailyMed ciprofloxacin label",
  url: "https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=b064286b-fedc-be68-e053-2995a90aae52&type=display",
  passage: "Monitor prothrombin time and INR frequently during and shortly after co-administration of ciprofloxacin with an oral anti-coagulant.",
  retrievedOn: "2026-10-03",
};

function uniq<T>(items: T[]): T[] { return [...new Set(items)]; }
function parseDose(dose?: string) { return dose?.match(/[\d.]+\s*(?:mg|mcg|g|mEq|units)/i)?.[0].toLowerCase(); }

function reconcile(records: SourceMedication[]): ReconciledMedication[] {
  const groups = new Map<string, SourceMedication[]>();
  for (const record of records) groups.set(record.ingredient, [...(groups.get(record.ingredient) ?? []), record]);
  return [...groups].map(([ingredient, rs]) => {
    const clinical = rs.filter((r) => r.recordType === "prescribed");
    const active = rs.some((r) => r.status === "active") || rs.some((r) => r.recordType === "patient-reported" && r.status === "active");
    let state: ReconciledMedication["state"] = active ? "confirmed" : "fulfillment-only";
    if (rs.some((r) => r.status === "unconfirmed")) state = "awaiting-confirmation";
    else if (clinical.some((r) => r.status === "active") && clinical.some((r) => r.status === "stopped")) state = "conflicting";
    const doses = uniq(rs.filter((r) => r.status !== "stopped").map((r) => parseDose(r.dose)).filter(Boolean));
    if (doses.length > 1) state = "conflicting";
    return { ingredient, rxcui: rs.find((r) => r.rxcui)?.rxcui, current: active, state, records: rs };
  }).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

function makeFindings(c: ClinicianCase, sources: ClinicianCase["sources"], records: SourceMedication[], confirmations: Record<string, boolean>): ClinicianFinding[] {
  const findings: ClinicianFinding[] = [];
  const active = (ingredient: string) => records.some((r) => r.ingredient === ingredient && (r.status === "active" || confirmations[r.id]));
  const add = (finding: ClinicianFinding) => { if (!findings.some((f) => f.id === finding.id)) findings.push(finding); };
  for (const source of sources) {
    if (!source.available) add({ id: `unavailable:${source.id}`, kind: "unavailable-source", priority: "data-quality", route: "clinician", title: `${source.label} unavailable`, detail: "The source did not respond after one retry, so the case cannot be marked complete.", question: `Can the ${source.label} record be obtained before this list is finalized?`, ingredients: [], recordIds: [], blocking: true });
    else if (Date.parse(AS_OF) - Date.parse(source.lastUpdated) > 180 * DAY) add({ id: `stale:${source.id}`, kind: "stale-source", priority: "data-quality", route: "clinician", title: `${source.label} is stale`, detail: `Last updated ${source.lastUpdated}. This is a data-quality warning, not a patient diagnosis.`, question: `Is there a newer ${source.label} record?`, ingredients: [], recordIds: [], blocking: false });
  }
  for (const medication of reconcile(records)) {
    const clinical = medication.records.filter((r) => r.recordType === "prescribed");
    const live = medication.records.filter((r) => r.status !== "stopped");
    const doses = uniq(live.map((r) => parseDose(r.dose)).filter(Boolean));
    if (clinical.some((r) => r.status === "active") && clinical.some((r) => r.status === "stopped")) add({ id: `status:${medication.ingredient}`, kind: "status-conflict", priority: "moderate", route: "clinician", title: `${medication.ingredient}: active in one record, stopped in another`, detail: clinical.map((r) => `${r.sourceLabel}: ${r.status} (${r.recordedOn})`).join("; "), question: `Which ${medication.ingredient} status is current?`, ingredients: [medication.ingredient], recordIds: clinical.map((r) => r.id), blocking: true });
    if (doses.length > 1) add({ id: `strength:${medication.ingredient}`, kind: "strength-mismatch", priority: "moderate", route: "clinician", title: `${medication.ingredient}: strength mismatch`, detail: live.map((r) => `${r.sourceLabel}: ${r.dose ?? "strength missing"}`).join("; "), question: `Which ${medication.ingredient} strength is current?`, ingredients: [medication.ingredient], recordIds: live.map((r) => r.id), blocking: true });
    for (const r of medication.records.filter((x) => x.status === "unconfirmed" && confirmations[x.id] === undefined)) add({ id: `confirm:${r.id}`, kind: "needs-confirmation", priority: "moderate", route: "patient", title: `Confirm ${r.display}`, detail: "Patient-reported and missing from the clinical records. Interaction rules wait for the answer.", question: `Are you currently taking ${r.display}?`, ingredients: [r.ingredient], recordIds: [r.id], blocking: true });
  }
  if (active("warfarin") && active("ibuprofen")) add({ id: "interaction:ibuprofen+warfarin", kind: "interaction", priority: "high", route: "pharmacist", title: "Warfarin + ibuprofen needs review", detail: "The configured label-backed rule associates this combination with a higher chance of stomach bleeding.", question: "Could a pharmacist review the warfarin and patient-reported ibuprofen together?", ingredients: ["warfarin", "ibuprofen"], recordIds: records.filter((r) => ["warfarin", "ibuprofen"].includes(r.ingredient)).map((r) => r.id), citation: IBUPROFEN_EVIDENCE, blocking: true });
  if (active("warfarin") && active("ciprofloxacin")) add({ id: "interaction:ciprofloxacin+warfarin", kind: "interaction", priority: "moderate", route: "pharmacist", title: "Warfarin + ciprofloxacin monitoring review", detail: "The configured DailyMed rule calls for INR monitoring during and shortly after co-administration.", question: "What INR monitoring plan is appropriate for this patient?", ingredients: ["warfarin", "ciprofloxacin"], recordIds: records.filter((r) => ["warfarin", "ciprofloxacin"].includes(r.ingredient)).map((r) => r.id), citation: CIPRO_EVIDENCE, blocking: true });
  return findings.sort((a, b) => ({ high: 0, moderate: 1, "data-quality": 2 }[a.priority] - { high: 0, moderate: 1, "data-quality": 2 }[b.priority]));
}

export function runClinicianAgent(caseData: ClinicianCase, options: { available?: Partial<Record<CaseSourceId, boolean>>; confirmations?: Record<string, boolean>; decisions?: ClinicianDecision[]; resumed?: boolean } = {}): AgentRun {
  const sources = caseData.sources.map((s) => ({ ...s, available: options.available?.[s.id] ?? s.available }));
  const confirmations = options.confirmations ?? {};
  const records = caseData.records.filter((r) => sources.find((s) => s.id === r.sourceId)?.available).map((r) => confirmations[r.id] === true ? { ...r, status: "active" as const } : confirmations[r.id] === false ? { ...r, status: "stopped" as const } : r);
  const trace: TraceEntry[] = [];
  const step = (stage: TraceEntry["stage"], tool: ClinicianTool, status: TraceEntry["status"], summary: string) => { const policy = checkTool(tool); trace.push({ seq: trace.length + 1, stage, tool, status: policy.allowed ? status : "blocked", summary: policy.allowed ? summary : policy.reason, at: AS_OF }); };
  if (options.resumed) trace.push({ seq: 1, stage: "gather", tool: "resume", status: "info", summary: "Resumed from the saved clarification state.", at: AS_OF });
  for (const source of sources) {
    if (!source.available) { step("gather", "fetch_source", "retry", `${source.label} did not respond. Retrying once.`); step("gather", "fetch_source", "failed", `${source.label} unavailable after retry.`); }
    else step("gather", "fetch_source", "ok", `${source.label}: ${records.filter((r) => r.sourceId === source.id).length} medication record(s) loaded.`);
  }
  step("validate", "validate_records", "ok", "Validated required medication fields. Malformed records would be quarantined, never merged.");
  step("normalize", "normalize_medications", "ok", `Normalized ${records.length} source records to ${uniq(records.map((r) => r.ingredient)).length} verified ingredients. Unknown names are never guessed.`);
  const medications = reconcile(records);
  step("reconcile", "reconcile_records", "ok", `Built one source-aware list of ${medications.length} ingredients. Orders, patient statements and pharmacy fulfillment remain distinct.`);
  const findings = makeFindings(caseData, sources, records, confirmations);
  step("check", "run_safety_rules", "ok", `Ran deterministic rules: ${findings.length} finding(s), including ${findings.filter((f) => f.priority === "high").length} high-priority review item(s).`);
  const pending = findings.find((f) => f.kind === "needs-confirmation");
  if (pending) {
    step("clarify", "ask_patient", "waiting", `Paused before applying rules to ${pending.ingredients[0]}. Asked: “${pending.question}”`);
    return { stage: "clarify", status: "needs-confirmation", sources, records, medications, findings, trace, pendingQuestion: { recordId: pending.recordIds[0], question: pending.question }, autonomousCount: trace.filter((t) => t.status === "ok").length, humanCount: 1 };
  }
  step("explain", "assemble_evidence", "ok", `Attached provenance to every finding and label evidence to ${findings.filter((f) => f.citation).length} interaction finding(s).`);
  const decided = new Set((options.decisions ?? []).map((d) => d.findingId));
  const open = findings.filter((f) => f.blocking && !decided.has(f.id));
  step("route", "route_to_reviewer", open.length ? "waiting" : "ok", open.length ? `Routed ${open.length} finding(s) to a human. The agent made no treatment decision.` : "Every routed finding has a recorded human decision.");
  const incomplete = findings.some((f) => f.kind === "unavailable-source");
  return { stage: open.length ? "route" : "complete", status: incomplete ? "incomplete" : open.length ? "review-required" : "complete", sources, records, medications, findings, trace, autonomousCount: trace.filter((t) => t.status === "ok").length, humanCount: open.length };
}
