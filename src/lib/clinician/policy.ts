export type ClinicianTool = "fetch_source" | "validate_records" | "normalize_medications" | "reconcile_records" | "run_safety_rules" | "run_parthia_engine" | "ask_patient" | "assemble_evidence" | "route_to_reviewer" | "screen_with_photon" | "open_photon_workflow" | "export_report" | "update_medication" | "stop_medication" | "change_dose" | "substitute_medication" | "write_prescription";

const DENIED: Partial<Record<ClinicianTool, string>> = {
  update_medication: "Medication changes require an authorized clinician's review.",
  stop_medication: "I cannot stop a medication. I can gather evidence and route a review request.",
  change_dose: "I cannot change a dose. I can show where the records disagree.",
  substitute_medication: "I cannot substitute a medication. That decision stays with an authorized clinician.",
  write_prescription: "Only an authorized provider can write a prescription in Photon.",
};

export function toolForRequest(text: string): ClinicianTool | null {
  const q = text.toLowerCase();
  if (/\b(stop|discontinue|hold)\b/.test(q)) return "stop_medication";
  if (/\b(increase|decrease|reduce|dose)\b/.test(q)) return "change_dose";
  if (/\b(switch|replace|substitute)\b/.test(q)) return "substitute_medication";
  if (/\b(prescribe|refill|write)\b/.test(q)) return "write_prescription";
  if (/\b(remove|delete|update)\b/.test(q)) return "update_medication";
  return null;
}

export function checkTool(tool: ClinicianTool, context: { approved?: boolean } = {}) {
  if (DENIED[tool]) return { allowed: false, reason: DENIED[tool]! };
  if (tool === "open_photon_workflow" && !context.approved) return { allowed: false, reason: "Photon can open only after a clinician records approval." };
  return { allowed: true, reason: "Allowed" };
}
