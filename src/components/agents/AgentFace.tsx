import { AGENTS } from "@/lib/agents/roster";

export type AgentFaceId = "patient" | "records" | "safety" | "photon" | "liaison" | "cardiology" | "nutrition" | "behavioral" | "orchestrator" | "reviewer";

const SHELL = "#172033";
const FEATURE = "#e7fbff";
const accents = new Map(AGENTS.map((agent) => [agent.id, agent.color]));

function accentFor(id: string): string {
  return accents.get(id) ?? "#1b2a41";
}

function OperatorShell({ accent, detail }: { accent: string; detail: React.ReactNode }) {
  return <>
    <path d="M10 43c1.4-5.7 6.1-8.5 14-8.5S36.6 37.3 38 43" fill={`${accent}28`} stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
    <rect x="7" y="7" width="34" height="29" rx="12" fill={SHELL} stroke={accent} strokeWidth="1.8" />
    <path d="M12 22h24" stroke={FEATURE} strokeOpacity=".38" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="17" cy="21" r="2" fill={FEATURE} /><circle cx="31" cy="21" r="2" fill={FEATURE} />
    <path d="M21 28c1.8 1.2 4.2 1.2 6 0" stroke={FEATURE} strokeWidth="1.4" strokeLinecap="round" />
    {detail}
  </>;
}

function Detail({ id, accent }: { id: string; accent: string }) {
  switch (id) {
    case "patient": return <path d="m24 4 2.3 4.1 4.5.7-3.2 3.1.7 4.4-4.3-2-4.3 2 .7-4.4-3.2-3.1 4.5-.7z" fill={accent} stroke={FEATURE} strokeWidth=".7" />;
    case "records":
    case "orchestrator": return <g stroke={accent} strokeWidth="1.8" strokeLinecap="round"><path d="M17 13h14M17 17h10M17 25h14M17 29h8" /><circle cx="12" cy="15" r="2" fill={accent} stroke="none" /><circle cx="12" cy="27" r="2" fill={accent} stroke="none" /></g>;
    case "safety":
    case "reviewer": return <g><path d="M24 10 33 14v6c0 6-4 9-9 12-5-3-9-6-9-12v-6z" fill={`${accent}66`} stroke={accent} strokeWidth="1.7" /><path d="m19 23 3 3 7-8" stroke={FEATURE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></g>;
    case "photon": return <g stroke={accent} strokeWidth="1.7" strokeLinecap="round"><path d="M15 15h18M18 20h12M15 25h18M20 30h8" /><path d="m12 11 2 3-2 3" /></g>;
    case "liaison": return <g stroke={accent} strokeWidth="1.7" strokeLinecap="round"><rect x="18" y="12" width="12" height="10" rx="2" /><path d="M24 22v8M20 26h8" /></g>;
    case "cardiology": return <path d="M12 23h5l3-7 5 14 3-7h8" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />;
    case "nutrition": return <g stroke={accent} strokeWidth="1.7" strokeLinecap="round"><path d="M24 29c-5-5-5-11 1-15 6 4 6 10-1 15Z" /><path d="M24 19v12M24 25l-4-3" /></g>;
    case "behavioral": return <path d="M15 26c3-8 5-8 8 0s5 8 8 0" stroke={accent} strokeWidth="1.8" strokeLinecap="round" fill="none" />;
    default: return <circle cx="24" cy="27" r="4" fill={accent} />;
  }
}

/** Compact operator faces. One shared visor gives the team a coherent identity. */
export function AgentFace({ id, size = 48 }: { id: AgentFaceId | string; size?: number }) {
  const accent = accentFor(id);
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label={`${id} agent face`}><OperatorShell accent={accent} detail={<Detail id={id} accent={accent} />} /></svg>;
}
