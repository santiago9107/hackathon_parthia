import type { ReactNode } from "react";
import { AGENTS } from "@/lib/agents/roster";

export type AgentFaceId = "patient" | "records" | "safety" | "photon" | "liaison" | "cardiology" | "nutrition" | "behavioral" | "orchestrator" | "reviewer";

/**
 * Friendly people, not machines: round faces, a smile, soft cheeks, and one
 * small accessory each so the team stays recognisable at 28 px. These agents
 * are here for the patient's safety, so they should look like it.
 * The shirt and the backdrop take the agent's colour from the roster.
 */
const INK = "#2b2a28";
const accents = new Map(AGENTS.map((agent) => [agent.id, agent.color]));
const accentFor = (id: string) => accents.get(id) ?? "#17706a";

type Hair = "cap" | "bob" | "bun" | "curly" | "short";
interface Look {
  skin: string;
  hair: string;
  style: Hair;
  glasses?: "round" | "square";
  accessory?: (accent: string) => ReactNode;
}

const Star = () => <path d="M24 38.4l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#fff" />;
const Shield = () => <path d="M24 38.2l4.2 1.6v3.4c0 2.4-1.8 4-4.2 5-2.4-1-4.2-2.6-4.2-5v-3.4z" fill="#fff" />;
const Heart = () => <path d="M24 46.2l-3.6-3.5a2.2 2.2 0 013.6-2.4 2.2 2.2 0 013.6 2.4z" fill="#e5484d" />;
const Bubble = () => <path d="M20.5 39.5h7a1.8 1.8 0 011.8 1.8v2.4a1.8 1.8 0 01-1.8 1.8h-3.2l-2.4 2v-2h-1.4a1.8 1.8 0 01-1.8-1.8v-2.4a1.8 1.8 0 011.8-1.8z" fill="#fff" />;
const Check = () => <><circle cx="24" cy="43" r="4.6" fill="#fff" /><path d="M21.6 43.2l1.7 1.7 3.2-3.4" stroke="#3b765d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>;

const LOOKS: Record<string, Look> = {
  patient: { skin: "#f1c7a0", hair: "#6b4a32", style: "curly", accessory: () => <Star /> },
  records: { skin: "#c98f64", hair: "#2f2a28", style: "short", glasses: "round" },
  safety: { skin: "#8d5a3b", hair: "#1f1b1a", style: "short", accessory: () => <Shield /> },
  photon: {
    skin: "#f6d8bf", hair: "#b9722f", style: "bun",
    accessory: () => <g stroke="#e8a317" strokeWidth="1.8" strokeLinecap="round"><path d="M24 1.6v2.6" /><path d="M15.2 4.4l1.6 2.1" /><path d="M32.8 4.4l-1.6 2.1" /></g>,
  },
  liaison: {
    skin: "#e2b08a", hair: "#3b2a3f", style: "bob",
    accessory: () => (
      <g transform="translate(35 12)">
        <ellipse cx="0" cy="-3" rx="2" ry="3" fill="#7a5cc9" /><ellipse cx="-3" cy="1" rx="2" ry="3" transform="rotate(-60 -3 1)" fill="#8f73d8" /><ellipse cx="3" cy="1" rx="2" ry="3" transform="rotate(60 3 1)" fill="#8f73d8" /><circle cx="0" cy="0" r="1.2" fill="#f5c542" />
      </g>
    ),
  },
  cardiology: { skin: "#d9a47a", hair: "#4a3b32", style: "short", accessory: () => <><path d="M17 36.6c0 5 3 8 7 8s7-3 7-8" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" /><Heart /></> },
  nutrition: {
    skin: "#f6d2b0", hair: "#a35b2b", style: "bob",
    accessory: () => <path d="M30 12.2c3.8-2.6 7.4-1.4 8 1.6-3.6 2.2-7.4 1.8-8-1.6z" fill="#5fae6b" stroke="#3f8a4b" strokeWidth=".8" />,
  },
  behavioral: { skin: "#a8704a", hair: "#2b221f", style: "short", accessory: () => <Bubble /> },
  orchestrator: {
    skin: "#e8b48a", hair: "#2f3a4a", style: "cap",
    accessory: () => (
      <g stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M12.8 22c-.6-9 4.8-13 11.2-13s11.8 4 11.2 13" /><rect x="10.8" y="21" width="3.4" height="6" rx="1.6" fill={INK} stroke="none" /><rect x="33.8" y="21" width="3.4" height="6" rx="1.6" fill={INK} stroke="none" /><path d="M35.4 27c0 4-3 5.4-7 5.6" />
      </g>
    ),
  },
  reviewer: { skin: "#b9855d", hair: "#3a2f2a", style: "cap", glasses: "square", accessory: () => <Check /> },
};
const FALLBACK: Look = { skin: "#f1c7a0", hair: "#6b4a32", style: "cap" };

function HairBack({ style, color }: { style: Hair; color: string }) {
  if (style === "bob") return <path d="M12.6 23c-.8-9 4.4-15 11.4-15s12.2 6 11.4 15v9.6c0 1.8-2.6 2.2-3.4.4L31 31H17l-1 2c-.8 1.8-3.4 1.4-3.4-.4z" fill={color} />;
  if (style === "bun") return <circle cx="24" cy="8.6" r="4.4" fill={color} />;
  if (style === "curly") return <g fill={color}>{[[15.5, 15], [19.5, 11.6], [24, 10.4], [28.5, 11.6], [32.5, 15]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="4" />)}</g>;
  return null;
}

function HairFront({ style, color }: { style: Hair; color: string }) {
  if (style === "short") return <path d="M13.8 20.4c-.6-7.4 4.2-11.2 10.2-11.2s10.8 3.8 10.2 11.2c-2.2-3.6-5.8-5.2-10.2-5.2s-8 1.6-10.2 5.2z" fill={color} />;
  return <path d="M13.8 20.8c-.5-6.6 4.2-10.4 10.2-10.4s10.7 3.8 10.2 10.4c-2.4-3.4-5.9-5-10.2-5s-7.8 1.6-10.2 5z" fill={color} />;
}

/** A friendly face for each agent. Unknown ids get a neutral, smiling one. */
export function AgentFace({ id, size = 48 }: { id: AgentFaceId | string; size?: number }) {
  const accent = accentFor(id);
  const look = LOOKS[id] ?? FALLBACK;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label={`${id} agent face`}>
      <circle cx="24" cy="24" r="24" fill={accent} fillOpacity=".16" />
      <path d="M5 48c0-9 8-14 19-14s19 5 19 14z" fill={accent} />
      <HairBack style={look.style} color={look.hair} />
      <rect x="21" y="30" width="6" height="6" rx="2" fill={look.skin} />
      <circle cx="24" cy="22.4" r="10.4" fill={look.skin} />
      <HairFront style={look.style} color={look.hair} />
      <ellipse cx="20.2" cy="22.6" rx="1.4" ry="1.8" fill={INK} /><circle cx="20.6" cy="21.9" r=".5" fill="#fff" />
      <ellipse cx="27.8" cy="22.6" rx="1.4" ry="1.8" fill={INK} /><circle cx="28.2" cy="21.9" r=".5" fill="#fff" />
      <circle cx="16.8" cy="26.2" r="2.1" fill="#f08a8a" fillOpacity=".4" /><circle cx="31.2" cy="26.2" r="2.1" fill="#f08a8a" fillOpacity=".4" />
      <path d="M20.4 27.2c1 2.2 2.2 3 3.6 3s2.6-.8 3.6-3" stroke={INK} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {look.glasses === "round" && <g stroke={INK} strokeWidth="1.1"><circle cx="20.2" cy="22.6" r="3.5" fill="#fff" fillOpacity=".25" /><circle cx="27.8" cy="22.6" r="3.5" fill="#fff" fillOpacity=".25" /><path d="M23.7 22.4h.6" /></g>}
      {look.glasses === "square" && <g stroke={INK} strokeWidth="1.1"><rect x="16.8" y="19.6" width="6.8" height="6" rx="1.8" fill="#fff" fillOpacity=".25" /><rect x="24.4" y="19.6" width="6.8" height="6" rx="1.8" fill="#fff" fillOpacity=".25" /><path d="M23.6 22.4h.8" /></g>}
      {look.accessory?.(accent)}
    </svg>
  );
}
