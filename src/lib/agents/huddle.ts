import type { PatientReply } from "@/lib/patientAgent/types";

export type HuddleAgentId = "patient" | "records" | "safety" | "cardiology" | "nutrition" | "behavioral" | "reviewer" | "photon";
export interface HuddleMessage { seq: number; from: HuddleAgentId; to: HuddleAgentId; summary: string; factIds: string[]; status: "ok" | "blocked" | "info"; }
export interface HuddleStep { id: "question" | "records" | "rules" | "specialists" | "linked" | "review" | "answer"; label: string; detail?: string; }
export interface Huddle { messages: HuddleMessage[]; steps: HuddleStep[]; answer: string; citations: { label: string; url?: string }[]; }
export interface OrchestratorResult { messages: Array<{ from: string; to: string; factIds: string[]; summary: string; status?: "ok" | "blocked" | "info"; seq?: number }>; facts?: Array<{ id: string }>; review?: { passed: number; blocked: number }; }

const AGENT_IDS = new Set<HuddleAgentId>(["patient", "records", "safety", "cardiology", "nutrition", "behavioral", "reviewer", "photon"]);
const LABELS: Record<HuddleStep["id"], string> = { question: "Question received", records: "Records gathered", rules: "Safety rules checked", specialists: "Specialists reviewing", linked: "Linked across specialists", review: "Safety review", answer: "Answer ready" };
function agentId(value: string): HuddleAgentId {
  if (value === "pharmacist") return "safety";
  return AGENT_IDS.has(value as HuddleAgentId) ? value as HuddleAgentId : "records";
}
function answerText(reply: PatientReply): string { return reply.segments.map((segment) => segment.text).join(" ").trim(); }

export function buildHuddle(input: OrchestratorResult, reply: PatientReply): Huddle {
  const messages = input.messages.slice().sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)).map((message, index): HuddleMessage => ({
    seq: message.seq ?? index + 1, from: agentId(message.from), to: agentId(message.to), summary: message.summary, factIds: [...message.factIds], status: message.status ?? "info",
  }));
  const factCount = input.facts?.length ?? new Set(messages.flatMap((message) => message.factIds)).size;
  const review = input.review ?? { passed: Math.max(1, factCount), blocked: messages.filter((message) => message.status === "blocked").length };
  const steps: HuddleStep[] = [
    { id: "question", label: LABELS.question },
    { id: "records", label: LABELS.records, detail: String(Math.max(1, factCount)) + " facts" },
    { id: "rules", label: LABELS.rules, detail: String(factCount) + " findings checked" },
    { id: "specialists", label: LABELS.specialists, detail: String(new Set(messages.flatMap((message) => [message.from, message.to])).size) + " agents" },
    { id: "linked", label: LABELS.linked, detail: String(messages.filter((message) => message.summary.toLowerCase().includes("link")).length) + " linked handoffs" },
    { id: "review", label: LABELS.review, detail: String(review.passed) + " passed, " + String(review.blocked) + " blocked" },
    { id: "answer", label: LABELS.answer },
  ];
  return { messages, steps, answer: answerText(reply), citations: reply.citations.map((citation) => ({ label: citation.label })) };
}

export interface PlaybackState { messageIndex: number; activeAgent?: HuddleAgentId; statuses: Record<HuddleAgentId, "idle" | "working" | "done" | "blocked">; currentStep: number; complete: boolean; }
const ALL_AGENTS: HuddleAgentId[] = ["patient", "records", "safety", "cardiology", "nutrition", "behavioral", "reviewer", "photon"];
export function usePlayback(huddle: Huddle, options: { stepMs?: number; reducedMotion?: boolean; elapsedMs?: number; skipped?: boolean } = {}): PlaybackState {
  const stepMs = options.stepMs ?? 800;
  const totalMs = Math.max(huddle.steps.length * stepMs, huddle.messages.length * 520);
  const final = options.reducedMotion === true || options.skipped === true || (options.elapsedMs ?? 0) >= totalMs;
  const elapsed = final ? totalMs : Math.max(0, options.elapsedMs ?? 0);
  const messageIndex = final ? huddle.messages.length - 1 : Math.min(huddle.messages.length - 1, Math.floor(elapsed / Math.max(1, totalMs / Math.max(1, huddle.messages.length))));
  const currentMessage = huddle.messages[Math.max(0, messageIndex)];
  const statuses = Object.fromEntries(ALL_AGENTS.map((id) => [id, "idle"])) as PlaybackState["statuses"];
  huddle.messages.forEach((message, index) => { if (final || index < messageIndex) { statuses[message.from] = message.status === "blocked" ? "blocked" : "done"; statuses[message.to] = message.status === "blocked" ? "blocked" : "done"; } });
  if (!final && currentMessage) statuses[currentMessage.from] = currentMessage.status === "blocked" ? "blocked" : "working";
  return { messageIndex: Math.max(0, messageIndex), activeAgent: final ? undefined : currentMessage?.from, statuses, currentStep: final ? huddle.steps.length - 1 : Math.min(huddle.steps.length - 1, Math.floor(elapsed / stepMs)), complete: final };
}
export function urgentNotice(kind: PatientReply["urgent"]): string | undefined {
  if (kind === "self-harm") return "If you may hurt yourself, call or text 988 now.";
  if (kind === "physical") return "If this could be an emergency, call 911 now.";
  return undefined;
}

const HUDDLE_SETTING = "parthia.agentHuddle.enabled";

export function huddleEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HUDDLE_SETTING) !== "false";
  } catch {
    return true;
  }
}

export function setHuddleEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(HUDDLE_SETTING, String(enabled));
  } catch {
    // Storage is optional in private browsing and embedded previews.
  }
}
