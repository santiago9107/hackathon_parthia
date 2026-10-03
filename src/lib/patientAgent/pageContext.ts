import type { SafetyUpdate } from "./safetyWatch";
import type { PageContext } from "./types";

/**
 * What the agent can do on the page the patient is looking at.
 *
 * Longest route prefix wins. `/safety` is an alias: this repo has no such
 * route, the safety list lives on `/medications/`, and the Safety nav item
 * points there.
 */

interface ContextEntry {
  prefix: string;
  label: string;
  capability: string;
  examples: string[];
}

const ENTRIES: ContextEntry[] = [
  {
    prefix: "/passport/review/",
    label: "Review differences",
    capability: "I can walk through each difference between your records and what your options are for it.",
    examples: ["What is this difference about?", "Which of my records disagree?", "What should I ask at my visit?"],
  },
  {
    prefix: "/passport/share/",
    label: "Share with your care team",
    capability: "I can build the summary for your visit from your own records and list the questions it raises.",
    examples: ["What should I ask at my visit?", "What changed since my last visit?", "Where did this medicine come from?"],
  },
  {
    prefix: "/passport/",
    label: "My Passport",
    capability: "I can tell you where any item in your Passport came from and what is still waiting for your review.",
    examples: ["Where did this medicine come from?", "What is waiting for my review?", "Which sources are connected?"],
  },
  {
    prefix: "/medications/",
    label: "Medication safety",
    capability: "I can explain every flag on this page, the rule behind it and the evidence it used.",
    examples: ["Why is this flagged?", "What changed since my last visit?", "What should I ask at my visit?"],
  },
  {
    prefix: "/safety",
    label: "Medication safety",
    capability: "I can explain every flag on this page, the rule behind it and the evidence it used.",
    examples: ["Why is this flagged?", "What changed since my last visit?", "What should I ask at my visit?"],
  },
  {
    prefix: "/log/",
    label: "Log something",
    capability: "I can tell you what changed in your safety check after you log something.",
    examples: ["What changed since my last visit?", "Why is this flagged?", "Where did this medicine come from?"],
  },
  {
    prefix: "/trends/",
    label: "Trends",
    capability: "I can describe how your readings and check-ins moved around a medication change, with no diagnosis.",
    examples: ["What changed since my last visit?", "How has my mood been?", "What should I ask at my visit?"],
  },
  {
    prefix: "/clinician/",
    label: "Clinician workspace",
    capability: "This is the clinician view. The clinician agent answers here, and your own records are unchanged.",
    examples: ["What changed since my last visit?", "Why is this flagged?", "Where did this medicine come from?"],
  },
];

const DASHBOARD: ContextEntry = {
  prefix: "/",
  label: "Your dashboard",
  capability: "I can explain each of your four indicators and what drives it, from your own records.",
  examples: ["What changed since my last visit?", "Why is this flagged?", "What should I ask at my visit?"],
};

export function resolvePageContext(pathname: string, update?: SafetyUpdate): PageContext {
  const path = pathname.endsWith("/") || pathname === "" ? pathname || "/" : `${pathname}/`;
  const entry = ENTRIES.filter((e) => path.startsWith(e.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? DASHBOARD;
  const count = update?.newCount ?? 0;
  const examples =
    count > 0 && entry.prefix !== "/clinician/"
      ? [`What are the ${count} new thing${count === 1 ? "" : "s"} since my last visit?`, ...entry.examples.slice(1)]
      : entry.examples;
  return { route: entry.prefix, label: entry.label, capability: entry.capability, examples };
}
