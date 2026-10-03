/**
 * A name and a face for each role the Parthia agents play.
 *
 * Nothing here changes behavior. The tools listed for each agent are the real
 * tool names in `clinician/policy.ts`, and the page counts them off a real run
 * of the clinician agent, so the roster cannot drift from what the code does.
 *
 * Every name is a tribute to one of the people who made this event happen
 * (host, venue and sponsors). The `why` line says what the tribute is and,
 * where it matters, what it is not.
 */
import { checkTool, type ClinicianTool } from "@/lib/clinician/policy";

export type Tribute = "DxAngels" | "Redesign Health" | "Photon Health" | "TechNovaTime" | "Visualize AI";

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  /** Who this agent talks to. */
  audience: "Patient" | "Behind the scenes" | "Clinician";
  tribute: Tribute;
  why: string;
  color: string;
  /** The promise shown on the card, in the agent's own voice. */
  assurance: string;
  description: string;
  /** Real tool names from policy.ts. Empty for the patient agent, which answers rather than acts. */
  tools: ClinicianTool[];
  /** Plain-language list of what it does, for agents whose work is not a tool call. */
  does?: string[];
  /** Where it lives in the code, so a judge can check. */
  code: string;
}

export const AGENTS: AgentPersona[] = [
  {
    id: "patient",
    name: "Nova",
    role: "Patient companion",
    audience: "Patient",
    tribute: "TechNovaTime",
    why: "For TechNovaTime. Nova's job is timing: the moment Harold logs a medicine, it rechecks his record and tells him what changed, and an urgent symptom gets 911 or 988 before anything else.",
    color: "#0e5c56",
    assurance: "I explain what changed in plain words and help you bring the right questions to your doctor.",
    description: "Answers the patient on any page from their own Passport. Rules decide, templates explain: no language model, no network call, no API key. It never tells anyone to start, stop or change a medicine.",
    tools: [],
    does: ["Rechecks safety after every log", "Urgent symptoms: 911 / 988 first", "Writes 3 to 5 questions for the visit", "Cites the source of every answer"],
    code: "src/lib/patientAgent",
  },
  {
    id: "records",
    name: "Reid",
    role: "Records and reconciliation agent",
    audience: "Behind the scenes",
    tribute: "Redesign Health",
    why: "For Redesign Health, our venue, a studio that builds companies out of scattered pieces. Reid does the same to a patient's records: several systems in, one medication list out, every line showing where it came from.",
    color: "#1b2a41",
    assurance: "I bring every record together and never hide where a line came from.",
    description: "Gathers each source with one retry, validates it, maps every medicine to an ingredient and merges the lists. When records disagree, or a medicine is only patient-reported, it asks instead of guessing.",
    tools: ["fetch_source", "validate_records", "normalize_medications", "reconcile_records", "ask_patient"],
    code: "src/lib/clinician/agent.ts",
  },
  {
    id: "safety",
    name: "Dex",
    role: "Safety agent",
    audience: "Behind the scenes",
    tribute: "DxAngels",
    why: "For DxAngels, who put clinicians and builders in one room. Dx is shorthand for diagnosis, and Dex is the closest Parthia gets to one: it never diagnoses, it turns patterns into questions for a clinician.",
    color: "#b5473a",
    assurance: "I check every medicine against the whole record and show my evidence line by line.",
    description: "Runs the Parthia safety engine and the label-backed interaction rules over the reconciled list. Every finding carries the rule that raised it and the label passage behind it, and every finding goes to a human.",
    tools: ["run_safety_rules", "run_parthia_engine", "assemble_evidence"],
    code: "src/lib/safetyEngine",
  },
  {
    id: "photon",
    name: "Fotini",
    role: "Photon screening agent",
    audience: "Clinician",
    tribute: "Photon Health",
    why: "For Photon Health. Fotini is Greek for light, the same root as photon. She screens a drafted prescription against the patient's allergies and medicines in the live Photon sandbox, and opens Photon only after a clinician approves.",
    color: "#b8861f",
    assurance: "I check a draft against Photon before anyone prescribes, and I never prescribe myself.",
    description: "Syncs the patient to the Photon Neutron sandbox and runs Photon's read-only prescription screening for drug-drug and drug-allergy alerts, shown side by side with Parthia's own findings.",
    tools: ["screen_with_photon", "open_photon_workflow"],
    code: "api/photon",
  },
  {
    id: "liaison",
    name: "Iris",
    role: "Clinician liaison",
    audience: "Clinician",
    tribute: "Visualize AI",
    why: "For Visualize AI. Iris makes the case visible: she routes each finding to the right person and lays it out for the clinician, body atlas included. A tribute name only: the 3D atlas is built on BodyParts3D, not the Visualize SDK.",
    color: "#2e7d5b",
    assurance: "I get each question to the person who should answer it, and I wait for their decision.",
    description: "Routes every finding to the patient, a pharmacist or the clinician by priority, records each decision, and keeps the case open until every question has an answer.",
    tools: ["route_to_reviewer"],
    code: "src/components/clinician/ClinicianWorkspace.tsx",
  },
];

/** The actions no agent can take, read from the same policy every agent calls. */
export const NEVER: { tool: ClinicianTool; label: string }[] = (
  [
    ["stop_medication", "Stop a medicine"],
    ["change_dose", "Change a dose"],
    ["substitute_medication", "Swap a medicine"],
    ["update_medication", "Edit the medication list"],
    ["write_prescription", "Write a prescription"],
  ] as const
).map(([tool, label]) => ({ tool, label }));

export function guardrails() {
  return NEVER.map((n) => ({ ...n, ...checkTool(n.tool) }));
}
