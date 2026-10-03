"use client";

import { useMemo, useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { buildClinicianCase, CLINICIAN_AS_OF } from "@/lib/clinician/cases";
import { runClinicianAgent } from "@/lib/clinician/agent";
import { answerClinician, CLINICIAN_CHAT_EXAMPLES, type ClinicianChatReply } from "@/lib/clinician/chat";
import { buildClinicianReport } from "@/lib/clinician/report";
import { checkTool } from "@/lib/clinician/policy";
import type { CaseSourceId, ClinicianDecision, ClinicianFinding } from "@/lib/clinician/types";

const STAGES = ["Gather", "Validate", "Normalize", "Reconcile", "Check", "Clarify", "Explain", "Route"];
const SOURCE_TONES: Record<CaseSourceId, string> = { passport: "bg-brand-100 text-brand-900", hospital: "bg-blue-100 text-blue-900", urgent: "bg-amber-100 text-amber-900", specialist: "bg-violet-100 text-violet-900", photon: "bg-cyan-100 text-cyan-900" };

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function priorityClass(priority: ClinicianFinding["priority"]) {
  return priority === "high" ? "bg-attention-soft text-attention" : priority === "moderate" ? "bg-watch-soft text-gold-700" : "bg-cream-dark text-ink-soft";
}

export function ClinicianWorkspace() {
  const { patientId } = usePatient();
  const caseData = useMemo(() => buildClinicianCase(patientId), [patientId]);
  const [launchedFor, setLaunchedFor] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Partial<Record<CaseSourceId, boolean>>>({});
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [decisions, setDecisions] = useState<ClinicianDecision[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ question: string; reply: ClinicianChatReply }[]>([]);
  const [screen, setScreen] = useState<"idle" | "loading" | "recorded" | "live">("idle");
  const launched = launchedFor === patientId;
  const run = launched ? runClinicianAgent(caseData, { available: availability, confirmations, decisions, resumed: Object.keys(confirmations).length > 0 }) : null;
  const finding = run?.findings.find((f) => f.id === selected) ?? run?.findings.find((f) => f.priority === "high") ?? run?.findings[0];

  function resetPatientRun() { setLaunchedFor(patientId); setAvailability({}); setConfirmations({}); setDecisions([]); setSelected(null); setMessages([]); setScreen("idle"); }
  function decide(target: ClinicianFinding, action: ClinicianDecision["action"]) {
    setDecisions((all) => [...all.filter((d) => d.findingId !== target.id), { findingId: target.id, action, note: "", reviewer: "Dr. Rivera", at: CLINICIAN_AS_OF }]);
  }
  function ask(text = question) {
    if (!text.trim()) return;
    setMessages((all) => [...all, { question: text, reply: answerClinician(text, run, decisions) }]); setQuestion("");
  }
  async function screenPhoton() {
    setScreen("loading");
    try {
      const response = await fetch("/api/photon/screen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ patientId: "demo-harold", treatmentIds: ["ciprofloxacin"] }) });
      if (!response.ok) throw new Error("screen unavailable");
      setScreen("live");
    } catch { setScreen("recorded"); }
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[1.5rem] bg-navy px-5 py-6 text-white shadow-card sm:px-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-100"><span className="h-2 w-2 animate-pulse rounded-full bg-gold-500" /> CLINICIAN AGENT WORKSPACE</div>
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">One patient. Five sources. One review queue.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Parthia gathers and reconciles fragmented medication records, explains every finding with provenance, and stops wherever a person must decide.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[{ value: run?.autonomousCount ?? "–", label: "agent steps" }, { value: run?.humanCount ?? "–", label: "human decisions" }, { value: run?.medications.length ?? "–", label: "medications" }, { value: run?.findings.length ?? "–", label: "findings" }].map((item) => <div key={item.label} className="min-w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><p className="text-xl font-semibold text-gold-200">{item.value}</p><p className="text-[10px] uppercase tracking-wider text-white/55">{item.label}</p></div>)}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 font-serif text-lg font-semibold text-white">{caseData.patientName.split(" ").map((x) => x[0]).join("")}</span><div><p className="font-serif text-xl font-semibold text-navy">{caseData.patientName}, {caseData.age}</p><p className="text-sm text-ink-muted">{caseData.conditions.join(" · ")}</p></div></div>
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-brand-50 px-3 py-1.5 font-semibold text-brand-800">Shared from Passport · Oct 3</span><span className="rounded-full bg-attention-soft px-3 py-1.5 font-semibold text-attention">Allergies: {caseData.allergies.join(", ") || "None recorded"}</span><span className="rounded-full border border-line px-3 py-1.5 text-ink-muted">Synthetic patient</span></div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Agent mission</p><h2 className="mt-1 font-serif text-2xl font-semibold text-navy">Reconcile the complete medication picture</h2></div><button type="button" onClick={resetPatientRun} className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">{launched ? "Run again" : "Launch agent"}</button></div>
          <div className="mt-5 grid grid-cols-4 gap-1 sm:grid-cols-8">
            {STAGES.map((stage, i) => { const active = run ? Math.min(STAGES.findIndex((s) => s.toLowerCase() === run.stage), 7) : -1; const done = i <= active; return <div key={stage} className="relative text-center"><div className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${done ? "bg-brand-700 text-white" : "bg-cream-dark text-ink-muted"}`}>{i + 1}</div><p className="mt-1 text-[10px] font-semibold text-ink-muted">{stage}</p>{i < 7 && <span className={`absolute left-[60%] top-4 h-px w-[80%] ${i < active ? "bg-brand-500" : "bg-line"}`} />}</div>; })}
          </div>
          <div className="mt-5 rounded-xl border border-line bg-cream p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">What I am doing now</p>
            <p className="mt-1 text-sm font-medium text-ink">{!run ? "Ready to gather records. Nothing has run yet." : run.trace.at(-1)?.summary}</p>
            {run?.pendingQuestion && <div className="mt-3 rounded-xl border border-gold-200 bg-gold-50 p-3"><p className="font-semibold text-navy">Patient clarification required</p><p className="mt-1 text-sm text-ink-soft">{run.pendingQuestion.question}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setConfirmations((x) => ({ ...x, [run.pendingQuestion!.recordId]: true }))} className="rounded-full bg-brand-700 px-4 py-2 text-xs font-semibold text-white">Yes, currently taking it</button><button type="button" onClick={() => setConfirmations((x) => ({ ...x, [run.pendingQuestion!.recordId]: false }))} className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-ink">No, not taking it</button></div></div>}
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Connected evidence</p>
          <div className="mt-3 space-y-2">
            {caseData.sources.map((source) => { const available = availability[source.id] ?? source.available; return <div key={source.id} className="flex items-center gap-3 rounded-xl border border-line p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${SOURCE_TONES[source.id]}`}>{source.id === "passport" ? "P" : source.id === "photon" ? "Rx" : "EHR"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{source.label}</p><p className="text-xs text-ink-muted">{source.format} · {source.lastUpdated}</p></div><button type="button" aria-label={`Toggle ${source.label}`} onClick={() => setAvailability((all) => ({ ...all, [source.id]: !available }))} className={`relative h-6 w-11 rounded-full transition ${available ? "bg-good" : "bg-line-strong"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${available ? "left-6" : "left-1"}`} /></button></div>; })}
          </div>
          <p className="mt-3 text-xs text-ink-muted">Turn a source off, then run again to see one retry and an incomplete-case guard.</p>
        </div>
      </section>

      {run && <>
        <section className="rounded-card border border-line bg-surface shadow-card">
          <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Reconciled medication list</p><h2 className="font-serif text-xl font-semibold text-navy">Every source record stays visible</h2></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${run.status === "complete" ? "bg-good-soft text-good" : run.status === "incomplete" ? "bg-cream-dark text-ink-soft" : "bg-watch-soft text-gold-700"}`}>{run.status.replace("-", " ")}</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-cream text-[10px] uppercase tracking-wider text-ink-muted"><tr><th className="px-5 py-3">Ingredient</th><th className="px-3 py-3">As written</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">State</th></tr></thead><tbody className="divide-y divide-line">{run.medications.flatMap((item) => item.records.map((record, index) => <tr key={record.id} className="hover:bg-brand-50/40"><td className="px-5 py-3">{index === 0 && <><p className="font-semibold capitalize text-ink">{item.ingredient}</p><p className="text-xs text-ink-muted">RxCUI {item.rxcui ?? "unmapped"}</p></>}</td><td className="px-3 py-3 text-ink">{record.display}</td><td className="px-3 py-3 text-ink-soft">{record.recordType}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${SOURCE_TONES[record.sourceId]}`}>{record.sourceLabel}</span></td><td className="px-3 py-3"><span className="font-medium text-ink">{record.status}</span>{index === 0 && <span className="ml-2 text-xs text-ink-muted">· {item.state}</span>}</td></tr>))}</tbody></table></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Clinician review queue</p><h2 className="mt-1 font-serif text-xl font-semibold text-navy">{run.findings.length} source-backed findings</h2>
            <div className="mt-4 space-y-2">{run.findings.map((item) => { const decision = decisions.find((d) => d.findingId === item.id); return <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${finding?.id === item.id ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-300"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-ink">{item.title}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityClass(item.priority)}`}>{item.priority}</span></div><p className="mt-1 text-xs text-ink-muted">{decision ? `Decision: ${decision.action}` : `Waiting for ${item.route}`}</p></button>; })}</div>
          </div>
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            {finding ? <><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${priorityClass(finding.priority)}`}>{finding.priority}</span><span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase text-brand-800">Route: {finding.route}</span></div><h2 className="mt-3 font-serif text-2xl font-semibold text-navy">{finding.title}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{finding.detail}</p>{finding.citation && <div className="mt-4 rounded-xl border-l-4 border-gold-500 bg-gold-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gold-700">Label evidence</p><blockquote className="mt-1 text-sm font-medium leading-6 text-ink">“{finding.citation.passage}”</blockquote><a href={finding.citation.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-700 underline">{finding.citation.sourceName}</a></div>}<div className="mt-4 rounded-xl bg-cream p-3"><p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Question for the reviewer</p><p className="mt-1 text-sm font-medium text-ink">{finding.question}</p></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => decide(finding, "acknowledged")} className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-cream">Acknowledge</button><button type="button" onClick={() => decide(finding, "marked-for-review")} className="rounded-full bg-brand-700 px-4 py-2 text-xs font-semibold text-white">Mark for review</button><button type="button" onClick={() => decide(finding, "deferred")} className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink">Defer</button><button type="button" onClick={() => { const policy = checkTool("open_photon_workflow", { approved: true }); if (policy.allowed) { decide(finding, "approved-photon-handoff"); window.open("https://app.neutron.health", "_blank", "noopener,noreferrer"); } }} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white">Continue in Photon ↗</button></div></> : <p className="text-sm text-ink-muted">Choose a finding.</p>}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Photon safety screen</p><h2 className="mt-1 font-serif text-xl font-semibold text-navy">Independent sandbox check</h2></div><button type="button" onClick={screenPhoton} disabled={screen === "loading"} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{screen === "loading" ? "Screening…" : "Screen draft"}</button></div>
            {screen === "idle" ? <p className="mt-4 text-sm text-ink-muted">Screen a drafted ciprofloxacin prescription before opening the provider workflow.</p> : screen === "loading" ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-cream" /> : <div className="mt-4 rounded-xl border border-attention/20 bg-attention-soft p-4"><div className="flex items-center justify-between"><span className="rounded-full bg-attention px-2 py-0.5 text-[10px] font-bold text-white">DRUG · MODERATE</span><span className="text-[10px] font-semibold uppercase text-ink-muted">{screen === "live" ? "Live Neutron sandbox" : "Recorded sandbox fallback"}</span></div><p className="mt-2 text-sm font-semibold text-ink">Ciprofloxacin may enhance the anticoagulant effect of warfarin.</p><p className="mt-1 text-xs text-ink-muted">Shown separately from Parthia&apos;s rule finding. The app does not hide disagreement between systems.</p></div>}
          </div>
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Agent audit trail</p><div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">{run.trace.map((entry) => <div key={`${entry.seq}-${entry.tool}`} className="flex gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.status === "failed" || entry.status === "blocked" ? "bg-attention" : entry.status === "waiting" ? "bg-gold-500" : "bg-good"}`} /><div><p className="text-xs font-bold text-ink">{entry.tool.replaceAll("_", " ")} <span className="font-normal text-ink-muted">· {entry.status}</span></p><p className="mt-0.5 text-xs leading-5 text-ink-soft">{entry.summary}</p></div></div>)}</div>
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Ask the clinician agent</p><h2 className="mt-1 font-serif text-xl font-semibold text-navy">Grounded answers, visible tools</h2><p className="mt-1 text-sm text-ink-muted">Every answer uses the reconciled case. Requests to change care are refused.</p></div><button type="button" onClick={() => download(`parthia-${patientId}-reconciliation.md`, buildClinicianReport(caseData, run, decisions))} className="rounded-full border border-brand-300 px-4 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-50">Export report ↓</button></div>
          <div className="mt-4 flex flex-wrap gap-2">{CLINICIAN_CHAT_EXAMPLES.map((example) => <button type="button" key={example} onClick={() => ask(example)} className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-brand-300">{example}</button>)}</div>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{messages.map((message, i) => <div key={`${message.question}-${i}`}><p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm text-white">{message.question}</p><div className={`mt-2 max-w-[90%] rounded-2xl rounded-bl-sm border px-4 py-3 ${message.reply.refused ? "border-attention/25 bg-attention-soft" : "border-line bg-brand-50"}`}><p className="whitespace-pre-line text-sm leading-6 text-ink">{message.reply.text}</p>{message.reply.tools.length > 0 && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-brand-700">Tools: {message.reply.tools.join(" → ")}</p>}</div></div>)}</div>
          <div className="mt-4 flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask about evidence, sources, disagreements or agent actions…" className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-3 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={() => ask()} className="rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white">Ask</button></div>
        </section>
      </>}

      <p className="text-center text-xs text-ink-muted">Synthetic demonstration data. Systems associated with medication warnings are context, not a patient diagnosis. Prototype evaluation, not clinical validation.</p>
    </div>
  );
}
