import { AGENTS } from "@/lib/agents/roster";

export type AgentFaceId = "patient" | "records" | "safety" | "photon" | "liaison" | "cardiology" | "nutrition" | "behavioral" | "orchestrator" | "reviewer";

const fallback = "#1b2a41";
const accents = new Map(AGENTS.map((agent) => [agent.id, agent.color]));

function accentFor(id: string): string {
  return accents.get(id) ?? fallback;
}

/** A compact, shared SVG identity for the bounded Parthia agent team. */
export function AgentFace({ id, size = 48 }: { id: AgentFaceId | string; size?: number }) {
  const accent = accentFor(id);
  const crest = id === "patient" ? <path d="M12 5.5 14 8l-2 2-2-2 2-2Z" />
    : id === "records" || id === "orchestrator" ? <path d="M9 6h6M8 9h8M9 12h6" />
      : id === "safety" || id === "reviewer" ? <path d="m9 10 2 2 4-4" />
        : id === "photon" ? <path d="M8 8h8M8 12h5M8 16h8" />
          : id === "liaison" ? <path d="M9 7h6v5H9zM12 12v5" />
            : <path d="M8 8h8M8 12h8M10 16h4" />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label={`${id} agent face`}>
      <circle cx="24" cy="24" r="22" fill="white" stroke={accent} strokeWidth="2" />
      <path d="M13 42c1.5-7.4 5.2-11 11-11s9.5 3.6 11 11" fill={`${accent}18`} stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 22c0-7.6 4.2-12 10-12s10 4.4 10 12v3.5c0 6-4.4 10.5-10 10.5S14 31.5 14 25.5V22Z" fill={`${accent}12`} stroke={accent} strokeWidth="1.8" />
      <path d="M19 23h.01M29 23h.01" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 28c1.2 1 2.4 1.4 4 1.4s2.8-.4 4-1.4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <g stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{crest}</g>
    </svg>
  );
}
