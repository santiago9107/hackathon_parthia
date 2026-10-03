import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runClinicianAgent } from "../src/lib/clinician/agent";
import { answerClinician } from "../src/lib/clinician/chat";
import { buildClinicianCase } from "../src/lib/clinician/cases";
import { runEvaluation } from "../src/lib/clinician/eval";
import { checkTool, toolForRequest } from "../src/lib/clinician/policy";
import type { CaseSourceId, SourceMedication } from "../src/lib/clinician/types";

const PATIENTS = [
  { id: "p-harold", name: "Harold Okafor", scenario: "OTC clarification, two label-backed interactions, status conflict and stale source" },
  { id: "p-margaret", name: "Margaret Lindqvist", scenario: "Patient-reported OTC clarification and conflicting SSRI history" },
  { id: "p-rosa", name: "Rosa Delgado", scenario: "Consistent lower-risk record that demonstrates no unnecessary alarm" },
] as const;
type PatientId = (typeof PATIENTS)[number]["id"];
const PATIENT_IDS = PATIENTS.map((p) => p.id) as [PatientId, ...PatientId[]];
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
  description: "Describe the read-only Photon screening handoff. Live screening requires the Vercel server function and sandbox credentials; no prescription is submitted.",
  inputSchema: { patientId, treatmentIds: z.array(z.string()).min(1) },
}, async ({ treatmentIds }) => response({ allowed: checkTool("screen_with_photon").allowed, treatmentIds, mode: "server-function-required", endpoint: "/api/photon/screen", writesPrescription: false }));
server.registerTool("run_evaluation", { description: "Run the 12 configured prototype cases. Not clinical validation." }, async () => { const results = runEvaluation(); return response({ passed: results.filter((r) => r.passed).length, total: results.length, cases: results }); });

await server.connect(new StdioServerTransport());
