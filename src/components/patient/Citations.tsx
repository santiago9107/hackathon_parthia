import { SOURCE_STYLES, SourceBadge, SourceIcon } from "@/components/passport/SourceBadge";
import type { AgentCitation } from "@/lib/patientAgent/types";

/**
 * Where an answer came from.
 *
 * A fact that comes from a Passport item carries that item's real DataSource
 * and renders through the existing SourceBadge. A fact that comes from a rule
 * has no DataSource, so it renders as a rule chip built from the same exported
 * SOURCE_STYLES and SourceIcon tokens. SourceBadge.tsx itself is untouched.
 */
export function Citations({ citations, className = "" }: { citations: AgentCitation[]; className?: string }) {
  if (citations.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {citations.map((c) => (
        <li key={`${c.label}|${c.ruleId ?? ""}|${c.source?.label ?? ""}`}>
          {c.source ? <SourceBadge source={c.source} /> : <RuleChip citation={c} />}
        </li>
      ))}
    </ul>
  );
}

function RuleChip({ citation }: { citation: AgentCitation }) {
  const style = SOURCE_STYLES.seed;
  const title = citation.ruleId ? `Safety rule: ${citation.ruleId}` : "From your own records";
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style.className}`}
    >
      <SourceIcon kind="seed" />
      <span className="truncate">{citation.label}</span>
      <span className="sr-only">{title}</span>
    </span>
  );
}
