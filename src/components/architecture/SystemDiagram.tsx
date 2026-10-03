import { buildStages, type ArchNode } from "@/lib/architecture/stages";

/**
 * The system diagram, drawn from data. Solid nodes run in this build; dashed
 * nodes are planned. Arrows follow the real order of the pipeline:
 * capture, confirm, store, analyze, agents, share, with a dashed loop back from
 * the clinician to the rules.
 *
 * On phones the same data is shown as stacked stage cards, because a 1280 px
 * diagram is not readable at 390 px.
 */

type Tone = "light" | "dark";

const PALETTE = {
  light: { node: "#fffdf9", edge: "#d3cbbb", run: "#17706a", link: "#17706a", text: "#2b2a28", sub: "#6b675f", accent: "#0e5c56", onAccent: "#ffffff", next: "#8a8478", chip: "#efeae0" },
  dark: { node: "#0f172a", edge: "#334155", run: "#5eead4", link: "#2dd4bf", text: "#f8fafc", sub: "#94a3b8", accent: "#5eead4", onAccent: "#042f2e", next: "#64748b", chip: "#1e293b" },
} as const;

const COL_W = 208;
const GAP = 60;
const TOP = 84;
const NODE_H = 74;
const NODE_GAP = 14;
const HEIGHT = 650;
const WIDTH = 5 * COL_W + 4 * GAP;

const colX = (stage: number) => stage * (COL_W + GAP);
const nodeY = (index: number) => TOP + index * (NODE_H + NODE_GAP);
const midY = (index: number) => nodeY(index) + NODE_H / 2;

export function SystemDiagram({ ruleCount, tone = "light", className = "" }: { ruleCount: number; tone?: Tone; className?: string }) {
  const stages = buildStages(ruleCount);
  const c = PALETTE[tone];
  const marker = `arch-arrow-${tone}`;
  const markerNext = `arch-arrow-next-${tone}`;
  const statusOf = (stage: number, index: number) => stages[stage]!.nodes[index]!.status;
  const stroke = (status: "running" | "next") => (status === "running" ? c.link : c.next);
  const dash = (status: "running" | "next") => (status === "next" ? "5 4" : undefined);
  const arrow = (status: "running" | "next") => `url(#${status === "running" ? marker : markerNext})`;

  /** Sources on the right edge of one column fan in to a spine, then fan out to targets in the next column. */
  function fan(fromStage: number, from: number[], toStage: number, to: number[]) {
    const spineX = colX(fromStage) + COL_W + GAP / 2;
    const ys = [...from, ...to].map(midY);
    return (
      <g key={`fan-${fromStage}-${toStage}`} fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {from.map((i) => (
          <path key={`s${i}`} d={`M${colX(fromStage) + COL_W} ${midY(i)} H${spineX}`} stroke={stroke(statusOf(fromStage, i))} strokeDasharray={dash(statusOf(fromStage, i))} />
        ))}
        <path d={`M${spineX} ${Math.min(...ys)} V${Math.max(...ys)}`} stroke={c.link} />
        {to.map((i) => (
          <path key={`t${i}`} d={`M${spineX} ${midY(i)} H${colX(toStage) - 3}`} stroke={stroke(statusOf(toStage, i))} strokeDasharray={dash(statusOf(toStage, i))} markerEnd={arrow(statusOf(toStage, i))} />
        ))}
      </g>
    );
  }

  /** A short arrow from the bottom of one node to the top of the next one in the same column. */
  function down(stage: number, index: number, status: "running" | "next" = "running") {
    const x = colX(stage) + COL_W / 2;
    return <path key={`d-${stage}-${index}`} d={`M${x} ${nodeY(index) + NODE_H} V${nodeY(index + 1) - 2}`} fill="none" stroke={stroke(status)} strokeWidth={1.6} strokeDasharray={dash(status)} markerEnd={arrow(status)} />;
  }

  const centerLoop = colX(2) + COL_W / 2;
  const shareCenter = colX(4) + COL_W / 2;
  const loopY = 566;
  const label = `System diagram: capture, store, analyze, agents, share. ${stages.flatMap((s) => s.nodes).filter((n) => n.status === "running").length} parts run in this demo; dashed parts are planned.`;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="hidden h-auto w-full md:block" style={{ fontFamily: "inherit" }}>
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 z" fill={c.link} /></marker>
          <marker id={markerNext} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 z" fill={c.next} /></marker>
        </defs>

        {stages.map((stage, si) => (
          <g key={stage.id}>
            <circle cx={colX(si) + 12} cy={24} r={12} fill={c.accent} />
            <text x={colX(si) + 12} y={29} textAnchor="middle" fontSize={14} fontWeight={700} fill={c.onAccent}>{stage.number}</text>
            <text x={colX(si) + 32} y={30} fontSize={17} fontWeight={600} fill={c.text}>{stage.title}</text>
            <text x={colX(si)} y={56} fontSize={12.5} fill={c.sub}>{stage.caption}</text>
            {stage.nodes.map((node: ArchNode, ni) => {
              const x = colX(si);
              const y = nodeY(ni);
              const running = node.status === "running";
              return (
                <g key={node.id}>
                  <rect x={x} y={y} width={COL_W} height={NODE_H} rx={12} fill={running ? c.node : "none"} stroke={running ? c.run : c.next} strokeWidth={running ? 1.5 : 1.3} strokeDasharray={running ? undefined : "6 4"} />
                  {running && <rect x={x} y={y + 14} width={4} height={NODE_H - 28} rx={2} fill={c.run} />}
                  <text x={x + 16} y={y + 26} fontSize={15} fontWeight={600} fill={running ? c.text : c.sub}>{node.title}</text>
                  <text x={x + 16} y={y + 46} fontSize={12} fill={c.sub}>{node.lines[0]}</text>
                  {node.lines[1] && <text x={x + 16} y={y + 62} fontSize={12} fill={c.sub}>{node.lines[1]}</text>}
                  {!running && (
                    <g>
                      <rect x={x + COL_W - 52} y={y + 8} width={42} height={18} rx={9} fill={c.chip} />
                      <text x={x + COL_W - 31} y={y + 21} textAnchor="middle" fontSize={11} fontWeight={700} fill={c.sub}>NEXT</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        ))}

        {fan(0, [0, 1, 2, 3, 4], 1, [0])}
        {down(1, 0)}
        {down(1, 1)}
        {down(1, 2, "next")}
        {fan(1, [2], 2, [0, 1, 3])}
        <path d={`M${colX(2) + COL_W / 2} ${nodeY(2)} V${nodeY(1) + NODE_H + 2}`} fill="none" stroke={c.link} strokeWidth={1.6} markerEnd={arrow("running")} />
        {fan(2, [0, 1, 3], 3, [0])}
        {down(3, 0)}
        {down(3, 1)}
        {down(3, 2, "next")}
        {fan(3, [2], 4, [0, 1, 2, 3, 4])}

        <path d={`M${shareCenter} ${nodeY(4) + NODE_H + 2} V${loopY} H${centerLoop} V${nodeY(3) + NODE_H + 4}`} fill="none" stroke={c.next} strokeWidth={1.6} strokeDasharray="5 4" markerEnd={arrow("next")} />
        <rect x={(shareCenter + centerLoop) / 2 - 190} y={loopY - 12} width={380} height={24} rx={12} fill={c.chip} />
        <text x={(shareCenter + centerLoop) / 2} y={loopY + 4} textAnchor="middle" fontSize={12.5} fill={c.sub}>Next: clinician decisions refine the rules</text>

        <g transform={`translate(0 ${HEIGHT - 28})`}>
          <rect x={0} y={0} width={34} height={16} rx={5} fill={c.node} stroke={c.run} strokeWidth={1.5} />
          <text x={44} y={13} fontSize={12.5} fill={c.sub}>Runs in this demo</text>
          <rect x={190} y={0} width={34} height={16} rx={5} fill="none" stroke={c.next} strokeWidth={1.3} strokeDasharray="5 3" />
          <text x={234} y={13} fontSize={12.5} fill={c.sub}>Planned</text>
        </g>
      </svg>

      <ol className="space-y-3 md:hidden" aria-label="System stages">
        {stages.map((stage, si) => (
          <li key={stage.id}>
            <div className="rounded-xl border p-4" style={{ background: c.node, borderColor: c.edge }}>
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: c.accent, color: c.onAccent }}>{stage.number}</span>
                <div>
                  <p className="text-base font-semibold" style={{ color: c.text }}>{stage.title}</p>
                  <p className="text-xs" style={{ color: c.sub }}>{stage.caption}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {stage.nodes.map((node) => (
                  <li key={node.id} className="rounded-lg border px-3 py-2" style={{ borderColor: node.status === "running" ? c.run : c.next, borderStyle: node.status === "running" ? "solid" : "dashed" }}>
                    <p className="flex items-center justify-between gap-2 text-sm font-semibold" style={{ color: node.status === "running" ? c.text : c.sub }}>
                      {node.title}
                      {node.status === "next" && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: c.chip, color: c.sub }}>NEXT</span>}
                    </p>
                    <p className="text-xs" style={{ color: c.sub }}>{node.lines.filter(Boolean).join(" ")}</p>
                  </li>
                ))}
              </ul>
            </div>
            {si < stages.length - 1 && (
              <svg viewBox="0 0 24 24" className="mx-auto my-1 h-5 w-5" fill="none" stroke={c.link} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M6 13l6 6 6-6" /></svg>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
