import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runClinicianAgent } from "../src/lib/clinician/agent";
import { answerClinician } from "../src/lib/clinician/chat";
import { buildClinicianCase, CLINICIAN_COHORT } from "../src/lib/clinician/cases";
import { runEvaluation } from "../src/lib/clinician/eval";
import { checkTool, toolForRequest } from "../src/lib/clinician/policy";
import { fetchSandboxBundle, listSandboxPatients, resolveIngredient } from "../src/lib/fhir/live";
import { askOpenRouter, screenPhoton } from "../src/lib/integrations/server";
import type { CaseSourceId, SourceMedication } from "../src/lib/clinician/types";

const PATIENTS = CLINICIAN_COHORT.map((patient) => ({
  id: patient.id,
  name: patient.name,
  scenario: patient.summary,
  acuity: patient.acuity,
}));
type PatientId = "p-harold" | "p-margaret" | "p-rosa" | "p-aisha" | "p-daniel" | "p-luis";
const PATIENT_IDS: [PatientId, ...PatientId[]] = ["p-harold", "p-margaret", "p-rosa", "p-aisha", "p-daniel", "p-luis"];
const ALL_SOURCES: CaseSourceId[] = ["passport", "hospital", "urgent", "specialist", "photon"];
interface Session { confirmations: Record<string, boolean>; unavailable: CaseSourceId[]; added: SourceMedication[] }
const sessions = new Map<PatientId, Session>();
const session = (id: PatientId) => { if (!sessions.has(id)) sessions.set(id, { confirmations: {}, unavailable: [], added: [] }); return sessions.get(id)!; };
function run(patientId: PatientId) {
  const state = session(patientId);
  const caseData = buildClinicianCase(patientId);
  caseData.records.push(...state.added);
  const available = Object.fromEntries(ALL_SOURCES.map((id) => [id, !state.unavailable.includes(id)])) as Record<CaseSourceId, boolean>;
  return runClinicianAgent(caseData, { available, confirmations: state.confirmations, resumed: Object.keys(state.confirmations).length > 0 });
}
const response = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const patientId = z.enum(PATIENT_IDS);
const server = new McpServer({ name: "parthia-clinician-agent", version: "1.0.0" });

server.registerTool("list_patients", { description: "List Parthia's synthetic demo patients." }, async () => response(PATIENTS));
server.registerTool("reconcile_patient", {
  description: "Run Parthia's deterministic clinician agent. It gathers, validates, normalizes, reconciles, checks, explains and routes, but never changes care.",
  inputSchema: { patientId, unavailableSources: z.array(z.enum(["hospital", "urgent", "specialist", "photon"])).optional() },
}, async ({ patientId: id, unavailableSources }) => {
  if (unavailableSources) session(id).unavailable = unavailableSources;
  const result = run(id);
  return response({ stage: result.stage, status: result.status, questionForPatient: result.pendingQuestion ?? null, findings: result.findings.map((f) => ({ id: f.id, title: f.title, priority: f.priority, route: f.route })), trace: result.trace, boundary: "No medication was changed." });
});
server.registerTool("add_patient_reported_medication", {
  description: "Add an OTC or patient-reported medication as unconfirmed. Safety rules wait for the patient's answer.",
  inputSchema: { patientId, name: z.string().min(2), ingredient: z.string().min(2), dose: z.string().optional() },
}, async ({ patientId: id, name, ingredient, dose }) => {
  const state = session(id);
  const recordId = `passport:mcp-${state.added.length + 1}`;
  state.added.push({ id: recordId, ingredient: ingredient.toLowerCase(), display: name, dose, status: "unconfirmed", recordType: "patient-reported", sourceId: "passport", sourceLabel: "Parthia Passport", recordedOn: "2026-10-03", author: "Patient" });
  const result = run(id);
  return response({ recordId, status: result.status, questionForPatient: result.pendingQuestion ?? null });
});
server.registerTool("confirm_patient_answer", {
  description: "Record whether the patient confirms taking a reported medication, then resume the agent.",
  inputSchema: { patientId, recordId: z.string(), taking: z.boolean() },
}, async ({ patientId: id, recordId, taking }) => { session(id).confirmations[recordId] = taking; const result = run(id); return response({ status: result.status, findings: result.findings }); });
server.registerTool("get_evidence", {
  description: "Return a finding, its label passage and every source record that supports it.",
  inputSchema: { patientId, findingId: z.string() },
}, async ({ patientId: id, findingId }) => { const result = run(id); const finding = result.findings.find((f) => f.id === findingId); return response(finding ? { ...finding, records: result.records.filter((record) => finding.recordIds.includes(record.id)) } : { error: "Finding not found" }); });
server.registerTool("get_provenance", {
  description: "List every record behind a normalized medication ingredient.",
  inputSchema: { patientId, ingredient: z.string() },
}, async ({ patientId: id, ingredient }) => response(run(id).records.filter((record) => record.ingredient === ingredient.toLowerCase())));
server.registerTool("ask_agent", {
  description: "Ask a grounded question about the reconciled record. Medication-change requests are refused.",
  inputSchema: { patientId, question: z.string() },
}, async ({ patientId: id, question }) => response(answerClinician(question, run(id), [])));
server.registerTool("request_medication_change", {
  description: "Demonstrate Parthia's hard policy boundary for stop, dose, substitute or prescribe requests.",
  inputSchema: { patientId, request: z.string() },
}, async ({ request }) => { const tool = toolForRequest(request) ?? "update_medication"; return response({ tool, ...checkTool(tool) }); });
server.registerTool("screen_with_photon", {
  description: "Run Photon Neutron's read-only interaction screen when sandbox credentials and allow-listed treatment IDs are configured. It never submits a prescription.",
  inputSchema: { patientId, treatmentIds: z.array(z.string()).min(1) },
}, async ({ patientId: id, treatmentIds }) => {
  try {
    return response({ ...(await screenPhoton({ patientId: id, treatmentIds })), allowed: true, writesPrescription: false });
  } catch (error) {
    return response({ allowed: true, live: false, mode: "unavailable", detail: error instanceof Error ? error.message : "Unknown error", writesPrescription: false });
  }
});
server.registerTool("list_public_fhir_patients", {
  description: "List patients with active prescriptions from the live SMART Health IT public FHIR R4 sandbox. The public sandbox uses synthetic Synthea records.",
  inputSchema: { limit: z.number().int().min(1).max(20).optional() },
}, async ({ limit }) => response({ source: "SMART Health IT R4 public sandbox", live: true, patients: await listSandboxPatients(limit ?? 8) }));
server.registerTool("fetch_public_fhir_patient", {
  description: "Fetch one live patient bundle from the SMART Health IT public FHIR R4 sandbox and summarize its resource types.",
  inputSchema: { sandboxPatientId: z.string().min(1).max(120) },
}, async ({ sandboxPatientId }) => {
  const bundle = await fetchSandboxBundle(sandboxPatientId);
  const resources = bundle.entry?.map((entry) => entry.resource).filter(Boolean) ?? [];
  const counts = resources.reduce<Record<string, number>>((all, resource) => {
    const type = resource?.resourceType ?? "Unknown";
    all[type] = (all[type] ?? 0) + 1;
    return all;
  }, {});
  return response({ source: "SMART Health IT R4 public sandbox", live: true, sandboxPatientId, counts, bundle });
});
server.registerTool("lookup_rxnorm", {
  description: "Resolve a drug name or RxCUI through Parthia's curated dictionary and the live U.S. NLM RxNorm API.",
  inputSchema: { text: z.string().optional(), rxcui: z.string().optional() },
}, async ({ text, rxcui }) => response({ source: "U.S. NLM RxNorm", liveWhenNotDictionary: true, mapping: await resolveIngredient({ text, rxcui }) }));
server.registerTool("ask_openrouter", {
  description: "Ask the configured OpenRouter model a grounded question about a reconciled record. Falls back to the deterministic answer engine when no key is configured.",
  inputSchema: { patientId, question: z.string().min(1).max(600) },
}, async ({ patientId: id, question }) => {
  const result = run(id);
  const evidence = JSON.stringify({ status: result.status, records: result.records, findings: result.findings, trace: result.trace });
  try {
    return response({ ...(await askOpenRouter({ question, patientName: buildClinicianCase(id).patientName, evidence })), source: "OpenRouter" });
  } catch (error) {
    return response({ ...answerClinician(question, result, []), live: false, source: "deterministic fallback", detail: error instanceof Error ? error.message : "Unknown error" });
  }
});
server.registerTool("run_evaluation", { description: "Run the 12 configured prototype cases. Not clinical validation." }, async () => { const results = runEvaluation(); return response({ passed: results.filter((r) => r.passed).length, total: results.length, cases: results }); });

await server.connect(new StdioServerTransport());
