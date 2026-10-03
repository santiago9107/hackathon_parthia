/**
 * The five-stage architecture, as data. One source for the SVG diagram and the
 * phone layout, so the two can never disagree. Every node says whether it runs
 * in this build or is planned ("next"); nothing planned is drawn as running.
 */
export type NodeStatus = "running" | "next";

export interface ArchNode {
  id: string;
  title: string;
  /** Two short lines, written to fit the diagram's node width. */
  lines: [string, string?];
  status: NodeStatus;
}

export interface ArchStage {
  id: "capture" | "store" | "analyze" | "agents" | "share";
  number: number;
  title: string;
  caption: string;
  nodes: ArchNode[];
}

export function buildStages(ruleCount: number): ArchStage[] {
  return [
    {
      id: "capture", number: 1, title: "Capture", caption: "Many sources, one format",
      nodes: [
        { id: "entries", title: "Patient entries", lines: ["Medicines, mood, symptoms,", "vitals, PHQ-9, GAD-7"], status: "running" },
        { id: "documents", title: "Paper documents", lines: ["On-device text recognition,", "patient confirms each line"], status: "running" },
        { id: "devices", title: "Devices", lines: ["Apple Health export,", "Bluetooth blood pressure cuff"], status: "running" },
        { id: "hospital", title: "Hospital records", lines: ["Live public FHIR R4 sandbox,", "RxNav ingredient mapping"], status: "running" },
        { id: "epic", title: "Epic sandbox", lines: ["Next: real SMART sign-in"], status: "next" },
      ],
    },
    {
      id: "store", number: 2, title: "Store", caption: "Confirmed, on the device",
      nodes: [
        { id: "codes", title: "Standard codes", lines: ["RxNorm, LOINC, SNOMED.", "Source kept on every item"], status: "running" },
        { id: "confirm", title: "Patient confirms", lines: ["Nothing unconfirmed is", "used in any analysis"], status: "running" },
        { id: "passport", title: "Patient Passport", lines: ["One record on the patient's", "device. Export or delete."], status: "running" },
        { id: "cloud", title: "Cloud storage", lines: ["Next: PostgreSQL, audit log,", "time-series readings"], status: "next" },
      ],
    },
    {
      id: "analyze", number: 3, title: "Analyze", caption: "Deterministic. No AI.",
      nodes: [
        { id: "reconcile", title: "Reconcile sources", lines: ["Conflicts shown, never", "silently merged"], status: "running" },
        { id: "rules", title: "Safety rules", lines: [`${ruleCount} deterministic rules,`, "each flag cites its data"], status: "running" },
        { id: "knowledge", title: "Clinical knowledge", lines: ["FDA labels, RxNav, live Photon", "drug screening"], status: "running" },
        { id: "measures", title: "Measures", lines: ["Weight, BP, heart rate,", "eGFR, potassium, PHQ-9"], status: "running" },
      ],
    },
    {
      id: "agents", number: 4, title: "Agents", caption: "Rule-based, human-gated",
      nodes: [
        { id: "orchestrator", title: "Orchestrator", lines: ["Routes facts, links findings", "across specialists"], status: "running" },
        { id: "specialists", title: "Specialist agents", lines: ["Pharmacist, Cardiology,", "Nutrition, Behavioral"], status: "running" },
        { id: "reviewer", title: "Safety reviewer", lines: ["Blocks uncited or directive", "wording before anyone sees it"], status: "running" },
        { id: "model", title: "Model explanations", lines: ["Next: a language model, held", "to the same reviewer"], status: "next" },
      ],
    },
    {
      id: "share", number: 5, title: "Share", caption: "The patient chooses what leaves",
      nodes: [
        { id: "patient", title: "Patient view", lines: ["Findings and questions for", "their doctor, never orders"], status: "running" },
        { id: "clinician", title: "Clinician view", lines: ["Evidence and decision support,", "every finding routed"], status: "running" },
        { id: "photon", title: "Photon workflow", lines: ["Opens only after a", "clinician approves"], status: "running" },
        { id: "export", title: "Export", lines: ["Printable summary,", "FHIR file"], status: "running" },
        { id: "link", title: "Secure link", lines: ["Next: revocable, time-limited", "clinician link"], status: "next" },
      ],
    },
  ];
}
