import type { DataSource } from "../types";

/**
 * PATIENT AGENT types.
 *
 * A reply is a list of segments rather than one string so the neutral-language
 * check (see neutral.ts) runs only on the sentences the agent writes itself.
 * Verbatim rule text (RiskFlag.suggestedNextStep legitimately contains words
 * like "should") and the fixed policy refusal strings are quoted, not authored,
 * and are never rewritten.
 */

export type UrgentKind = "self-harm" | "physical";

export interface ReplySegment {
  /** authored = written by the agent, checked by validateNeutral.
   *  quoted   = verbatim from a rule, the record or the scripted responder.
   *  refusal  = a fixed policy string. */
  kind: "authored" | "quoted" | "refusal";
  text: string;
}

/** Where a stated fact came from: a Passport item (real DataSource) or a rule. */
export interface AgentCitation {
  label: string;
  source?: DataSource;
  ruleId?: string;
}

export interface PatientReply {
  segments: ReplySegment[];
  citations: AgentCitation[];
  urgent?: UrgentKind;
  refused?: boolean;
  /** Rules decide and templates explain. There is no model path. */
  answeredBy: "rules";
  suggestions: string[];
}

/** What the agent can do on the route the patient is looking at. */
export interface PageContext {
  route: string;
  label: string;
  capability: string;
  examples: string[];
}
