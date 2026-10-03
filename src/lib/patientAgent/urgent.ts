import { SELF_HARM_SUPPORT } from "../screening";
import type { UrgentKind } from "./types";

/**
 * URGENT SYMPTOM CHECK.
 *
 * One mechanism only: the PHQ-9 item 9 pattern. Self-harm wording reuses
 * SELF_HARM_SUPPORT from lib/screening (rendered unchanged by the
 * SelfHarmSupport component), and a physical emergency reuses the same card
 * shape with its 911 action, SELF_HARM_SUPPORT.actions[1].
 *
 * The scripted assistant has its own EMERGENCY regex (src/lib/assistant/index.ts)
 * which lacks bleeding, black stools and fainting. The wider list lives here so
 * that file is left alone.
 */

export const URGENT_PATTERNS: { kind: UrgentKind; pattern: RegExp }[] = [
  {
    kind: "self-harm",
    pattern: /\b(suicid\w*|kill myself|end my life|take my own life|hurt(ing)? myself|harm myself|better off dead|overdose[ds]?)\b/i,
  },
  {
    kind: "physical",
    pattern:
      /\b(chest pain|chest pressure|chest tightness|crushing chest|pain in my chest)\b|\b(can'?t breathe|cannot breathe|trouble breathing|short(ness)? of breath|struggling to breathe)\b|\b(severe bleeding|heavy bleeding|bleeding (a lot|that (will )?(not|wo'?nt) stop)|coughing up blood|vomiting blood)\b|\b(black|tarry)[a-z ,]*stool\w*\b|\bstool\w*[a-z ,]*(black|tarry)\b|\bblood in my stool\b|\b(faint(ed|ing)?|passed out|passing out|blacked out|lost consciousness|unconscious)\b|\b(stroke|face droop\w*|slurred speech)\b/i,
  },
];

/** Self-harm wins over a physical match, so support resources come first. */
export function detectUrgent(text: string): { kind: UrgentKind } | null {
  for (const { kind, pattern } of URGENT_PATTERNS) {
    if (pattern.test(text)) return { kind };
  }
  return null;
}

/** Fixed, quoted copy for each kind. Never rewritten by the neutral check. */
export function urgentMessage(kind: UrgentKind): { title: string; lines: string[] } {
  if (kind === "self-harm") {
    return { title: SELF_HARM_SUPPORT.title, lines: [SELF_HARM_SUPPORT.body, SELF_HARM_SUPPORT.followUp] };
  }
  return {
    title: "Call 911 or go to the ER",
    lines: [
      `This needs urgent care, not an app. ${SELF_HARM_SUPPORT.actions[1].label} or go to the nearest emergency department now.`,
      "Once you are safe, your Passport will still be here and we can log what happened.",
    ],
  };
}
