"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Slide = { label: string; eyebrow: string; title: ReactNode; body: ReactNode };

const slides: Slide[] = [
  { label: "Opening", eyebrow: "HACKERS & HEALERS · MEDICATION SAFETY", title: <>Five medication records.<br/><span className="text-teal-300">No shared truth.</span></>, body: <><p className="max-w-3xl text-xl leading-8 text-slate-300">Parthia turns fragmented EHR, pharmacy and patient-reported medication data into one source-backed clinician review queue.</p><div className="mt-10 grid max-w-3xl grid-cols-3 border border-slate-700"><Metric value="5" label="evidence sources"/><Metric value="8" label="bounded agent stages"/><Metric value="0" label="autonomous care changes"/></div><p className="mt-8 max-w-3xl border-l-2 border-amber-300 pl-4 text-base italic leading-7 text-amber-100">A presentation, at a hackathon that said no presentations. Relax, organizers: it is not for you. It is for the investors.</p></> },
  { label: "That's all", eyebrow: "PARTHIA HEALTH", title: <>I&apos;m kidding.<br/><span className="text-teal-300">That&apos;s all.</span></>, body: <p className="mt-8 max-w-3xl text-xl leading-8 text-slate-300">Thank you. The demo was the presentation.</p> },
];

function Metric({ value, label }: { value: string; label: string }) { return <div className="border-r border-slate-700 px-6 py-5 last:border-0"><p className="text-3xl font-semibold text-white">{value}</p><p className="mt-1 text-xs uppercase tracking-[.14em] text-slate-400">{label}</p></div>; }

export function ClinicianPresentation() {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(slides.length - 1, next))), []);
  const toggle = useCallback(() => document.fullscreenElement ? void document.exitFullscreen() : void shell.current?.requestFullscreen(), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.min(slides.length - 1, value + 1)); } if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); } if (event.key.toLowerCase() === "f") toggle(); };
    const full = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", key); document.addEventListener("fullscreenchange", full);
    return () => { window.removeEventListener("keydown", key); document.removeEventListener("fullscreenchange", full); };
  }, [toggle]);
  const slide = slides[index]!;
  return <div ref={shell} className={`flex min-h-[calc(100vh-8rem)] flex-col bg-slate-950 text-white ${fullscreen ? "min-h-screen" : ""}`}>
    <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 text-xs text-slate-400"><span>{String(index + 1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")} · {slide.label}</span><button type="button" onClick={toggle} className="border border-slate-700 px-3 py-1.5 text-white">{fullscreen ? "Exit fullscreen" : "Present fullscreen"}</button></div>
    <article className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-20"><p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-300">{slide.eyebrow}</p><h1 className="mt-5 max-w-6xl text-4xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-6xl lg:text-7xl">{slide.title}</h1><div className="mt-4">{slide.body}</div></article>
    <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3"><button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="px-3 py-2 text-sm disabled:opacity-30">← Previous</button><div className="flex gap-2">{slides.map((item, i) => <button type="button" key={item.label} aria-label={`Open ${item.label} slide`} onClick={() => go(i)} className={`h-1.5 w-4 sm:w-7 ${i === index ? "bg-teal-300" : "bg-slate-700"}`} />)}</div><button type="button" disabled={index === slides.length - 1} onClick={() => go(index + 1)} className="px-3 py-2 text-sm disabled:opacity-30">Next →</button></div>
  </div>;
}
