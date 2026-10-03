import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "parthia-smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/server.mts"] }));
const tools = await client.listTools();
if (tools.tools.length !== 10) throw new Error(`Expected 10 tools, got ${tools.tools.length}`);
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse((result.content as { text: string }[])[0].text);
};
const first = await call("reconcile_patient", { patientId: "p-harold" });
if (first.status !== "needs-confirmation") throw new Error("Expected clarification pause");
const confirmed = await call("confirm_patient_answer", { patientId: "p-harold", recordId: "passport:otc-ibuprofen", taking: true });
if (!confirmed.findings.some((finding: { id: string }) => finding.id === "interaction:ibuprofen+warfarin")) throw new Error("Expected warfarin + ibuprofen finding");
const refused = await call("request_medication_change", { patientId: "p-harold", request: "Stop ibuprofen" });
if (refused.allowed) throw new Error("Medication change was not refused");
const evaluation = await call("run_evaluation");
if (evaluation.passed !== evaluation.total) throw new Error("Prototype evaluation failed");
process.stdout.write(`MCP smoke passed: ${tools.tools.length} tools, ${evaluation.passed}/${evaluation.total} eval cases.\n`);
await client.close();
