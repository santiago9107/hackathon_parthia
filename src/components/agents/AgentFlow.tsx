import { Fragment } from "react";
import { AgentFace } from "@/components/agents/AgentFace";
import { FLOW } from "@/lib/agents/flow";

/**
 * The animated hand-off strip. Pure CSS, no client JavaScript: a ring moves
 * from agent to agent, a dot travels along each connector, and one caption at
 * a time says what is happening, written from a real run by the page.
 * With reduced motion the ring and dot stop and the last caption stays.
 *
 * The animated part is hidden from screen readers; the same steps are given
 * to them as a plain list.
 */
export const STEP_SECONDS = 0.9;
const PAUSE_SECONDS = 1.4;
export const CYCLE_SECONDS = FLOW.length * STEP_SECONDS + PAUSE_SECONDS;
const WINDOW = (STEP_SECONDS / CYCLE_SECONDS) * 100;

/** Keyframes are written from the same numbers as the delays, so the three animations stay in step. */
export function AgentMotionStyles() {
  const w = WINDOW.toFixed(2);
  const wEnd = (WINDOW + 1.5).toFixed(2);
  const wCapEnd = (WINDOW - 2).toFixed(2); // finish fading out before the next caption starts, so two lines never overlap
  return (
    <style>{`
.af-root { --cycle: ${CYCLE_SECONDS}s; }
.af-ring { animation: af-ring var(--cycle) linear infinite backwards; animation-delay: var(--d); }
.af-dot { animation: af-dot var(--cycle) linear infinite backwards; animation-delay: var(--d); }
.af-cap { opacity: 0; animation: af-cap var(--cycle) linear infinite backwards; animation-delay: var(--d); }
.af-card { animation: af-in .5s ease-out backwards, af-glow var(--cycle) linear infinite backwards; animation-delay: var(--in), var(--d); }
@keyframes af-ring { 0% { box-shadow: 0 0 0 0 rgba(23,112,106,0); transform: scale(1); } 1.5% { box-shadow: 0 0 0 5px rgba(23,112,106,.28); transform: scale(1.1); } ${w}% { box-shadow: 0 0 0 5px rgba(23,112,106,.28); transform: scale(1.1); } ${wEnd}% { box-shadow: 0 0 0 0 rgba(23,112,106,0); transform: scale(1); } 100% { box-shadow: 0 0 0 0 rgba(23,112,106,0); transform: scale(1); } }
@keyframes af-dot { 0% { left: 0; opacity: 0; } 1% { left: 0; opacity: 1; } ${w}% { left: calc(100% - 8px); opacity: 1; } ${wEnd}% { left: calc(100% - 8px); opacity: 0; } 100% { left: calc(100% - 8px); opacity: 0; } }
@keyframes af-cap { 0% { opacity: 0; transform: translateY(5px); } 1.5% { opacity: 1; transform: none; } ${wCapEnd}% { opacity: 1; transform: none; } ${w}% { opacity: 0; } 100% { opacity: 0; } }
@keyframes af-glow { 0% { box-shadow: 0 1px 2px rgba(43,42,40,.06); } 1.5% { box-shadow: 0 0 0 2px rgba(23,112,106,.45), 0 8px 22px rgba(23,112,106,.18); } ${w}% { box-shadow: 0 0 0 2px rgba(23,112,106,.45), 0 8px 22px rgba(23,112,106,.18); } ${wEnd}% { box-shadow: 0 1px 2px rgba(43,42,40,.06); } 100% { box-shadow: 0 1px 2px rgba(43,42,40,.06); } }
@keyframes af-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .af-ring, .af-dot, .af-card { animation: none !important; }
  .af-dot { display: none; }
  .af-cap { animation: none !important; }
  .af-cap:last-child { opacity: 1; }
}
`}</style>
  );
}

export function AgentFlow({ captions }: { captions: string[] }) {
  return (
    <div className="af-root rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div aria-hidden>
        <ol className="flex flex-wrap items-start justify-center gap-y-4 sm:flex-nowrap">
          {FLOW.map((step, i) => (
            <Fragment key={step.key}>
              <li className="flex w-1/4 flex-col items-center text-center sm:w-[76px] sm:shrink-0">
                <span className="af-ring grid place-items-center rounded-full bg-surface ring-1 ring-line" style={{ "--d": `${i * STEP_SECONDS}s` } as React.CSSProperties}>
                  {step.agentIds.length > 1 ? (
                    <span className="flex items-center px-1 py-1">
                      {step.agentIds.map((id, k) => <span key={id} className={`rounded-full bg-surface ring-2 ring-surface ${k > 0 ? "-ml-3" : ""}`}><AgentFace id={id} size={28} /></span>)}
                    </span>
                  ) : (
                    <AgentFace id={step.agentIds[0]!} size={44} />
                  )}
                </span>
                <span className="mt-1.5 text-[13px] font-semibold leading-tight text-ink">{step.label}</span>
                <span className="text-[11px] leading-tight text-ink-muted">{step.sub}</span>
              </li>
              {i < FLOW.length - 1 && (
                <li className="relative mt-[22px] hidden h-px flex-1 border-t border-dashed border-line-strong sm:block">
                  <span className="af-dot absolute -top-[5px] h-2 w-2 rounded-full bg-brand-600" style={{ "--d": `${(i + 0.5) * STEP_SECONDS}s` } as React.CSSProperties} />
                </li>
              )}
            </Fragment>
          ))}
        </ol>
        <div className="relative mt-4 min-h-[2.75rem] rounded-xl bg-cream px-4 py-2.5 text-sm font-medium text-ink-soft sm:min-h-[2.25rem]">
          {captions.map((caption, i) => (
            <p key={i} className="af-cap absolute inset-x-4 top-1/2 -translate-y-1/2 text-center sm:text-left" style={{ "--d": `${i * STEP_SECONDS}s` } as React.CSSProperties}>{caption}</p>
          ))}
        </div>
      </div>
      <ol className="sr-only">{captions.map((caption, i) => <li key={i}>{caption}</li>)}</ol>
    </div>
  );
}
