/**
 * The order in which the agents hand work to each other, for the animated
 * strip on /agents. The order mirrors the real pipeline: the patient's
 * question, the records, the rules, the routing, the specialists, the Photon
 * screen, the safety review, and the clinician. Captions are written from a
 * real run on the page, never from this file.
 */
export interface FlowStep {
  key: string;
  /** Roster ids of the agents that act in this step (several run in parallel). */
  agentIds: string[];
  label: string;
  sub: string;
}

export const FLOW: FlowStep[] = [
  { key: "patient", agentIds: ["patient"], label: "Nova", sub: "Asks" },
  { key: "records", agentIds: ["records"], label: "Reid", sub: "Records" },
  { key: "safety", agentIds: ["safety"], label: "Dex", sub: "Rules" },
  { key: "orchestrator", agentIds: ["orchestrator"], label: "Router", sub: "Routes" },
  { key: "specialists", agentIds: ["cardiology", "nutrition", "behavioral"], label: "Specialists", sub: "Review" },
  { key: "photon", agentIds: ["photon"], label: "Fotini", sub: "Photon" },
  { key: "reviewer", agentIds: ["reviewer"], label: "Reviewer", sub: "Checks" },
  { key: "liaison", agentIds: ["liaison"], label: "Iris", sub: "Clinician" },
];

export function stepIndexOf(agentId: string): number {
  return FLOW.findIndex((step) => step.agentIds.includes(agentId));
}
