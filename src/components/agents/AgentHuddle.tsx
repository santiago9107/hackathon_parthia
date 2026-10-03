"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { buildHuddle, huddleEnabled, setHuddleEnabled, usePlayback, urgentNotice, type Huddle, type HuddleAgentId } from "@/lib/agents/huddle";
import { MARGARET_HUDDLE_FIXTURE } from "@/lib/agents/huddle.fixture";

const NAMES: Record<HuddleAgentId, { name: string; role: string }> = {
  patient: { name: "Nova", role: "Your Parthia agent" },
  records: { name: "Reid", role: "Records" },
  safety: { name: "Dex", role: "Pharmacist" },
  cardiology: { name: "Willem", role: "Cardiology" },
  nutrition: { name: "Elsie", role: "Nutrition" },
  behavioral: { name: "Aaron", role: "Behavioral health" },
  reviewer: { name: "Iris", role: "Safety reviewer" },
  photon: { name: "Fotini", role: "Photon screening" },
};
const ARC: Record<Exclude<HuddleAgentId, "patient">, { x: number; y: number }> = {
  records: { x: 14, y: 26 }, safety: { x: 35, y: 9 }, cardiology: { x: 65, y: 9 },
  nutrition: { x: 86, y: 26 }, behavioral: { x: 86, y: 68 }, reviewer: { x: 65, y: 86 }, photon: { x: 35, y: 86 },
};
const IDS: Exclude<HuddleAgentId, "patient">[] = ["records", "safety", "cardiology", "nutrition", "behavioral", "reviewer", "photon"];

function Face({ id, size = 42 }: { id: HuddleAgentId; size?: number }) {
  const color = id === "patient" ? "#0f766e" : id === "reviewer" ? "#b45309" : "#155e75";
  return <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={NAMES[id].name} className="shrink-0">
    <circle cx="24" cy="24" r="22" fill="currentColor" opacity=".08" />
    <circle cx="24" cy="22" r="13" fill="none" stroke={color} strokeWidth="2" />
    <path d="M14 40c2-7 18-7 20 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d={id === "patient" ? "M16 14c4-7 14-7 18 0" : id === "reviewer" ? "M13 16h22" : "M17 13c4-4 10-4 14 0"} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <circle cx="19" cy="22" r="1.5" fill={color} /><circle cx="29" cy="22" r="1.5" fill={color} />
    <path d="M20 28c2 1 6 1 8 0" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}

function statusClass(status: "idle" | "working" | "done" | "blocked"): string {
  if (status === "working") return "bg-brand-600";
  if (status === "done") return "bg-good";
  if (status === "blocked") return "bg-watch";
  return "bg-line";
}

export interface AgentHuddleProps {
  open: boolean;
  onClose: () => void;
  huddle?: Huddle;
  urgent?: "self-harm" | "physical";
  triggerRef?: RefObject<HTMLElement | null>;
}

const DEFAULT_HUDDLE = buildHuddle(MARGARET_HUDDLE_FIXTURE, {
  answeredBy: "rules",
  segments: [{ kind: "authored", text: "These source-backed findings are questions to bring to your care team." }],
  citations: [{ label: "Margaret's medication and daily entries" }],
  suggestions: [],
});

export function AgentHuddle({ open, onClose, huddle = DEFAULT_HUDDLE, urgent, triggerRef }: AgentHuddleProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showNextTime, setShowNextTime] = useState(() => huddleEnabled());
  const previousOpen = useRef(open);
  const notice = urgentNotice(urgent);
  const playback = usePlayback(huddle, { elapsedMs: elapsed, skipped, reducedMotion });
  const latest = useMemo(() => {
    const result = new Map<HuddleAgentId, string>();
    huddle.messages.slice(0, playback.complete ? huddle.messages.length : playback.messageIndex + 1).forEach((message) => result.set(message.from, message.summary));
    return result;
  }, [huddle, playback.complete, playback.messageIndex]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || notice) return;
    const first = window.setTimeout(() => {
      setElapsed(0);
      setSkipped(false);
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    }, 0);
    return () => window.clearTimeout(first);
  }, [open, notice]);
  useEffect(() => {
    if (!open || notice || reducedMotion || skipped) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 100), 100);
    return () => window.clearInterval(timer);
  }, [open, notice, reducedMotion, skipped]);
  useEffect(() => {
    if (previousOpen.current && !open) window.setTimeout(() => triggerRef?.current?.focus(), 0);
    previousOpen.current = open;
  }, [open, triggerRef]);
  useEffect(() => {
    if (!open || notice) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, a[href]")].filter((item) => !item.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, notice, onClose]);

  if (notice) return <div role="alert" className="fixed inset-x-4 top-4 z-50 rounded-xl border border-watch bg-watch-soft p-4 text-sm font-semibold text-ink shadow-lg">{notice}</div>;
  if (!open) return null;

  const current = huddle.messages[playback.messageIndex];
  const active = current && !playback.complete ? ARC[current.from === "patient" ? "records" : (current.from as Exclude<HuddleAgentId, "patient">)] : undefined;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/45 p-3 backdrop-blur-sm sm:p-6">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="agent-huddle-title" className="mx-auto my-3 w-full max-w-[960px] overflow-hidden rounded-2xl border border-line bg-cream shadow-2xl sm:my-10">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-brand-700">Agent huddle</p><h2 id="agent-huddle-title" className="mt-1 font-serif text-2xl font-semibold text-navy">Your care picture is being checked</h2><p className="mt-1 text-xs text-ink-muted">Rule-based agents, no language model.</p></div>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setSkipped(true); setElapsed(99999); }} className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-cream-dark">Skip</button><button type="button" onClick={() => { setHuddleEnabled(false); setShowNextTime(false); onClose(); }} className="min-h-11 rounded-lg border border-line px-3 text-xs font-semibold text-ink-muted hover:bg-cream-dark">Don&apos;t show again</button><button type="button" aria-label="Close agent huddle" onClick={onClose} className="min-h-11 min-w-11 rounded-lg border border-line text-ink hover:bg-cream-dark"><svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button></div>
      </div>
      <div className="px-5 py-5">
        <div className="relative hidden min-h-[380px] md:block">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
            {IDS.map((id) => <line key={id} x1="50" y1="48" x2={ARC[id].x} y2={ARC[id].y} stroke="#cbd5e1" strokeWidth=".35" />)}
            {active && <><circle r="1.2" fill="#0f766e"><animateMotion dur="700ms" repeatCount="1" path={"M 50 48 L " + active.x + " " + active.y} /></circle></>}
          </svg>
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center"><div className="mx-auto flex h-[88px] w-[88px] items-center justify-center rounded-full border-4 border-brand-200 bg-white shadow-lg"><Face id="patient" size={72} /></div><p className="mt-2 font-semibold text-navy">Nova</p><p className="text-xs text-ink-muted">Your Parthia agent</p></div>
          {IDS.map((id) => { const point = ARC[id]; const status = playback.statuses[id]; return <div key={id} className="absolute z-10 w-40 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-white p-2 shadow-sm" style={{ left: point.x + "%", top: point.y + "%" }}><div className="flex items-center gap-2"><Face id={id} size={34} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy">{NAMES[id].name}</p><p className="truncate text-[11px] text-ink-muted">{NAMES[id].role}</p></div><span className={"ml-auto h-2.5 w-2.5 shrink-0 rounded-full " + statusClass(status)} /></div><p className="mt-2 line-clamp-2 text-xs text-ink-soft">{latest.get(id) ?? "Waiting for the handoff."}</p></div>; })}
        </div>
        <div className="md:hidden"><div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white p-3"><Face id="patient" size={56} /><div><p className="font-semibold text-navy">Nova</p><p className="text-xs text-ink-muted">Your Parthia agent</p></div></div><div className="mt-3 space-y-2">{IDS.map((id) => <div key={id} className="rounded-xl border border-line bg-white p-3"><div className="flex items-center gap-2"><Face id={id} size={34} /><div className="min-w-0"><p className="text-sm font-semibold text-navy">{NAMES[id].name}</p><p className="text-xs text-ink-muted">{NAMES[id].role}</p></div><span className={"ml-auto h-2.5 w-2.5 rounded-full " + statusClass(playback.statuses[id])} /></div><p className="mt-2 text-xs text-ink-soft">{latest.get(id) ?? "Waiting for the handoff."}</p></div>)}</div></div>
        <div className="mt-5 border-t border-line pt-4"><div className="grid gap-2 md:grid-cols-7">{huddle.steps.map((step, index) => <div key={step.id} className={"rounded-lg border p-2 " + (index <= playback.currentStep ? "border-brand-200 bg-brand-50" : "border-line bg-white")}><div className="flex items-center gap-2"><span className={"flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold " + (index < playback.currentStep || playback.complete ? "bg-good-soft text-good" : index === playback.currentStep ? "bg-brand-700 text-white" : "bg-cream-dark text-ink-muted")}>{index < playback.currentStep || playback.complete ? <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : index + 1}</span><span className="text-xs font-semibold text-navy">{step.label}</span></div>{step.detail && <p className="mt-1 pl-7 text-[11px] text-ink-muted">{step.detail}</p>}</div>)}</div></div>
        {playback.complete && <div className="mt-4 rounded-xl border border-good bg-good-soft p-4"><p className="text-sm font-semibold text-navy">Answer ready</p><p className="mt-1 text-sm leading-relaxed text-ink">{huddle.answer}</p>{huddle.citations.length > 0 && <ul className="mt-2 space-y-1 text-xs text-ink-muted">{huddle.citations.map((citation) => <li key={citation.label}>Source: {citation.label}</li>)}</ul>}<button type="button" onClick={onClose} className="mt-3 min-h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">See the answer</button></div>}
        <p className="sr-only" aria-live="polite">{current ? NAMES[current.from].name + " says: " + current.summary : ""}</p>
        {!showNextTime && <p className="mt-3 text-xs text-ink-muted">Agent huddles are off. Re-enable them from your browser site settings.</p>}
      </div>
    </div>
  </div>;
}
