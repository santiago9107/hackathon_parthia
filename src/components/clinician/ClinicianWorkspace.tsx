"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { buildClinicianCase, CLINICIAN_AS_OF, CLINICIAN_COHORT } from "@/lib/clinician/cases";
import { runClinicianAgent } from "@/lib/clinician/agent";
import { answerClinician, CLINICIAN_CHAT_EXAMPLES, type ClinicianChatReply } from "@/lib/clinician/chat";
import { buildClinicianReport } from "@/lib/clinician/report";
import { checkTool } from "@/lib/clinician/policy";
import { buildLiveClinicianCase, type LiveClinicianCaseResult } from "@/lib/clinician/live";
import { listSandboxPatients, SANDBOX_UNAVAILABLE, type SandboxPatient } from "@/lib/fhir/live";
import type { CaseSourceId, ClinicianDecision, ClinicianFinding } from "@/lib/clinician/types";
import { ClinicalBodyAtlas3D } from "./ClinicalBodyAtlas3D";
import { PhotonScreenPanel } from "./PhotonScreenPanel";
import { getRecord } from "@/lib/mockData";
import { computeMeasures } from "@/lib/measures";
import { orchestrate } from "@/lib/agents/orchestrator";
import { reviewSpecialistItems } from "@/lib/agents/safetyReviewer";
import { countsBySystem, systemsFor, type BodySystem } from "@/lib/clinician/bodySystems";

const STAGES = ["Gather", "Validate", "Normalize", "Reconcile", "Check", "Clarify", "Explain", "Route"];
const SOURCE_META: Record<CaseSourceId, { short: string; color: string }> = {
  passport: { short: "P", color: "bg-emerald-600" }, hospital: { short: "H", color: "bg-blue-600" },
  urgent: { short: "U", color: "bg-amber-500" }, specialist: { short: "S", color: "bg-violet-600" }, photon: { short: "Rx", color: "bg-cyan-600" },
};
type IconName = "agent" | "arrow" | "chat" | "download" | "shield" | "spark" | "user";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    agent: <><rect x="4" y="6" width="16" height="13" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6M12 3v3"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>, chat: <path d="M4 5h16v12H9l-5 4V5Z"/>,
    download: <><path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 20h14"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    spark: <><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"/><path d="m18 15 .7 2.3 2.3 1.2-2.3 1.2L18 22l-.7-2.3-2.3-1.2 2.3-1.2L18 15Z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.4-7 8-7s7.2 2 8 7"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{paths[name]}</svg>;
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function priorityStyle(priority: ClinicianFinding["priority"]) {
  return priority === "high" ? "border-red-200 bg-red-50 text-red-700" : priority === "moderate" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600";
}

export function ClinicianWorkspace() {
  const { patientId } = usePatient();
  const [activePatientId, setActivePatientId] = useState(patientId);
  const [livePatients, setLivePatients] = useState<SandboxPatient[]>([]);
  const [liveCases, setLiveCases] = useState<Record<string, LiveClinicianCaseResult>>({});
  const [liveState, setLiveState] = useState<"idle" | "listing" | "loading" | "ready" | "error">("idle");
  const [liveError, setLiveError] = useState<string | null>(null);
  const liveResult = liveCases[activePatientId];
  const caseData = useMemo(() => liveResult?.caseData ?? buildClinicianCase(activePatientId), [activePatientId, liveResult]);
  const [launchedFor, setLaunchedFor] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Partial<Record<CaseSourceId, boolean>>>({});
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [decisions, setDecisions] = useState<ClinicianDecision[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [bodyFilter, setBodyFilter] = useState<BodySystem | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ question: string; reply: ClinicianChatReply }[]>([]);
  const [agentAnswering, setAgentAnswering] = useState(false);
  const [agentProgress, setAgentProgress] = useState(0);
  const launched = launchedFor === activePatientId;
  const run = launched ? runClinicianAgent(caseData, { available: availability, confirmations, decisions, resumed: Object.keys(confirmations).length > 0 }) : null;
  // The review queue follows the body-system filter; the selected finding always comes from what is visible.
  const visibleFindings = run ? (bodyFilter ? run.findings.filter((item) => systemsFor(item).includes(bodyFilter)) : run.findings) : [];
  const bodyCounts = run ? countsBySystem(run.findings) : undefined;
  const finding = visibleFindings.find((item) => item.id === selected) ?? visibleFindings.find((item) => item.priority === "high") ?? visibleFindings[0];
  const activeStage = launched ? Math.max(0, Math.min(agentProgress - 1, STAGES.length - 1)) : -1;
  const visibleTrace = run?.trace.slice(0, Math.max(1, Math.ceil(run.trace.length * agentProgress / STAGES.length))) ?? [];
  const agentRunning = launched && agentProgress < STAGES.length;
  const measures = useMemo(() => {
    const record = activePatientId.startsWith("smart-") ? undefined : getRecord(activePatientId);
    return record ? computeMeasures(record, new Date(`${CLINICIAN_AS_OF}T12:00:00`)) : [];
  }, [activePatientId]);
  const specialistReview = useMemo(() => {
    const record = activePatientId.startsWith("smart-") ? undefined : getRecord(activePatientId);
    if (!record) return undefined;
    const orchestration = orchestrate(record, new Date(`${CLINICIAN_AS_OF}T12:00:00`));
    const items = [...orchestration.linked, ...orchestration.outputs.flatMap((output) => output.items)];
    return { orchestration, review: reviewSpecialistItems(items, orchestration.facts) };
  }, [activePatientId]);

  useEffect(() => { const timer = window.setTimeout(() => setActivePatientId(patientId), 0); return () => window.clearTimeout(timer); }, [patientId]);
  useEffect(() => { if (!agentRunning) return; const timer = window.setTimeout(() => setAgentProgress((value) => Math.min(STAGES.length, value + 1)), 500); return () => window.clearTimeout(timer); }, [agentProgress, agentRunning]);

  function resetState(id: string) { setActivePatientId(id); setLaunchedFor(null); setAgentProgress(0); setAvailability({}); setConfirmations({}); setDecisions([]); setSelected(null); setBodyFilter(null); setMessages([]); }
  function launch() { setLaunchedFor(activePatientId); setAgentProgress(1); setConfirmations({}); setDecisions([]); setSelected(null); setBodyFilter(null); setMessages([]); }
  async function loadLivePatients() {
    setLiveState("listing"); setLiveError(null);
    try { const patients = await listSandboxPatients(6); setLivePatients(patients); setLiveState("ready"); }
    catch (error) { setLiveError(error instanceof Error ? error.message : SANDBOX_UNAVAILABLE); setLiveState("error"); }
  }
  async function selectLivePatient(patient: SandboxPatient) {
    const id = `smart-${patient.id}`;
    if (liveCases[id]) { resetState(id); return; }
    setLiveState("loading"); setLiveError(null);
    try {
      const result = await buildLiveClinicianCase(patient);
      setLiveCases((all) => ({ ...all, [id]: result })); resetState(id); setLiveState("ready");
    } catch (error) { setLiveError(error instanceof Error ? error.message : SANDBOX_UNAVAILABLE); setLiveState("error"); }
  }
  function decide(target: ClinicianFinding, action: ClinicianDecision["action"]) { setDecisions((all) => [...all.filter((item) => item.findingId !== target.id), { findingId: target.id, action, note: "", reviewer: "Dr. Rivera", at: CLINICIAN_AS_OF }]); }
  async function ask(text = question) {
    const prompt = text.trim(); if (!prompt || agentAnswering) return; setQuestion("");
    const deterministic = answerClinician(prompt, run, decisions);
    if (!run || deterministic.refused) { setMessages((all) => [...all, { question: prompt, reply: { ...deterministic, source: "deterministic" } }]); return; }
    setAgentAnswering(true);
    try {
      const evidence = JSON.stringify({ status: run.status, records: run.records, findings: run.findings, decisions, trace: run.trace });
      const response = await fetch("/api/openrouter/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: prompt, patientName: caseData.patientName, evidence }) });
      if (!response.ok) throw new Error("OpenRouter unavailable");
      const result = await response.json() as { text: string; model?: string };
      setMessages((all) => [...all, { question: prompt, reply: { text: result.text, tools: ["evidence", "provenance", `OpenRouter · ${result.model ?? "configured model"}`], source: "openrouter" } }]);
    } catch { setMessages((all) => [...all, { question: prompt, reply: { ...deterministic, source: "deterministic" } }]); }
    finally { setAgentAnswering(false); }
  }

  return <div className="-mt-6 w-full pb-10">
    <nav className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 py-3 text-xs">
      <div className="flex items-center gap-2 text-slate-500"><span className="font-semibold text-teal-700">Clinical workspace</span><span>/</span><span>Medication reconciliation</span></div>
      <div className="flex items-center gap-1"><Link href="/clinician/system-design/" className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-white">System design</Link><Link href="/clinician/presentation/" className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-white">Presentation</Link><Link href="/clinician/eval/" className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-white">Evaluation</Link></div>
    </nav>
    <header className="flex flex-col gap-4 py-6 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-teal-700"><Icon name="agent" />Parthia reconciliation agent</div><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">A complete medication picture, assembled autonomously.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">The agent retrieves and checks the evidence. Patients clarify what they take. Clinicians retain every treatment decision.</p></div>
      <button type="button" onClick={launch} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,118,110,.22)] hover:bg-teal-800"><Icon name="spark" />{agentRunning ? "Reconciliation running" : launched ? "Run again" : "Start reconciliation"}</button>
    </header>

    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,.08)]">
      <div className="grid min-h-[840px] xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside className="border-b border-slate-200 bg-slate-50/80 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-200 px-5 py-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Patient queue</p><p className="mt-1 text-sm font-semibold text-slate-900">Demo cases + live FHIR</p></div>
          <div className="p-2">{CLINICIAN_COHORT.map((patient) => <button type="button" key={patient.id} onClick={() => resetState(patient.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activePatientId === patient.id ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/70"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ${patient.acuity === "high" ? "bg-red-600" : patient.acuity === "moderate" ? "bg-amber-500" : "bg-teal-600"}`}>{patient.name.split(" ").map((part) => part[0]).join("")}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-900">{patient.name}</span><span className="block truncate text-[10px] text-slate-500">{patient.summary}</span></span></button>)}</div>
          <div className="mx-2 border-y border-slate-200 py-3">
            <div className="flex items-center justify-between px-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-emerald-700">Live public FHIR</p><p className="mt-0.5 text-[9px] text-slate-500">Real API · synthetic Synthea people</p></div><button type="button" onClick={() => void loadLivePatients()} disabled={liveState === "listing" || liveState === "loading"} className="rounded-lg bg-emerald-700 px-2.5 py-2 text-[9px] font-semibold text-white disabled:opacity-50">{liveState === "listing" ? "Connecting" : livePatients.length ? "Refresh" : "Connect"}</button></div>
            {liveError && <p role="alert" className="mx-3 mt-2 rounded-lg bg-red-50 p-2 text-[9px] leading-4 text-red-700">{liveError}</p>}
            {liveState === "loading" && <p role="status" className="mx-3 mt-2 flex items-center gap-2 text-[9px] font-medium text-emerald-700"><span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />Fetching FHIR resources and resolving RxNorm…</p>}
            {livePatients.length > 0 && <div className="mt-2 max-h-48 space-y-1 overflow-y-auto px-1">{livePatients.map((patient) => { const id = `smart-${patient.id}`; return <button type="button" key={patient.id} onClick={() => void selectLivePatient(patient)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left ${activePatientId === id ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-white"}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-700 text-[8px] font-bold text-white">FHIR</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-slate-800">{patient.name}</span><span className="block text-[8px] text-slate-400">{patient.activeMedications} active prescriptions</span></span></button>; })}</div>}
          </div>
          <div className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Active patient</p>{liveResult && <span className="rounded bg-emerald-50 px-2 py-1 text-[8px] font-bold uppercase text-emerald-700">Live response</span>}</div><div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-xs font-semibold text-white">{caseData.patientName.split(" ").map((part) => part[0]).join("")}</span><div><p className="text-sm font-semibold text-slate-950">{caseData.patientName}</p><p className="text-xs text-slate-500">{caseData.age || "Age not provided"}{caseData.age ? " years" : ""} · {liveResult ? "Synthea patient" : "demo cohort"}</p></div></div><p className="mt-3 text-xs leading-5 text-slate-600">{caseData.conditions.join(" · ") || "No active conditions returned"}</p><p className="mt-2 text-xs font-medium text-red-700">Allergy: {caseData.allergies.join(", ") || (liveResult ? "Not included in this public query" : "None recorded")}</p>{liveResult && <p className="mt-3 border-t border-slate-100 pt-3 text-[9px] leading-4 text-slate-500">Fetched {new Date(liveResult.fetchedAt).toLocaleTimeString()} · {liveResult.counts.dictionary} local and {liveResult.counts.rxnav} live RxNorm mappings · {liveResult.counts.unmapped} unmapped</p>}</div>
          <div className="px-5 py-5"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Evidence sources</p><span className="text-[9px] font-medium text-teal-700">{caseData.sources.filter((source) => availability[source.id] ?? source.available).length} connected</span></div><div className="mt-3 space-y-1">{caseData.sources.map((source) => { const available = availability[source.id] ?? source.available; return <div key={source.id} className="flex items-center gap-2 rounded-lg py-2"><span className={`grid h-7 w-7 place-items-center rounded-lg text-[9px] font-bold text-white ${SOURCE_META[source.id].color}`}>{SOURCE_META[source.id].short}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{source.label}</span><span className="block text-[9px] text-slate-400">Updated {source.lastUpdated}</span></span><button type="button" aria-label={`Toggle ${source.label}`} aria-pressed={available} onClick={() => setAvailability((all) => ({ ...all, [source.id]: !available }))} className={`relative h-5 w-9 rounded-full ${available ? "bg-teal-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${available ? "left-[18px]" : "left-0.5"}`} /></button></div>; })}</div></div>
          <div className="border-t border-slate-200 px-5 py-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Infrastructure</p><div className="mt-3 space-y-2">{[["SMART FHIR", liveResult ? "connected" : "available", "bg-emerald-500"], ["NLM RxNorm", liveResult ? "queried" : "available", "bg-emerald-500"], ["Photon Neutron", "gated", "bg-amber-500"], ["OpenRouter", "gated", "bg-amber-500"], ["MCP · 14 tools", "local", "bg-cyan-500"]].map(([name, state, color]) => <div key={name} className="flex items-center gap-2 text-[10px]"><span className={`h-1.5 w-1.5 rounded-full ${color}`} /><span className="flex-1 font-medium text-slate-700">{name}</span><span className="uppercase text-slate-400">{state}</span></div>)}</div><Link href="/passport/add/fhir-sandbox/" className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700">Open full FHIR importer <Icon name="arrow" className="h-3 w-3" /></Link></div>
        </aside>

        <main className="min-w-0 bg-white">
          <section className="border-b border-slate-200 px-6 py-6">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-teal-700">Agent workspace</p><h2 className="mt-1 text-xl font-semibold tracking-[-.025em] text-slate-950">Evidence reconciliation</h2></div><span className={`rounded-full px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.12em] ${agentRunning ? "bg-cyan-50 text-cyan-700" : run ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{agentRunning ? "Agent working" : run ? "Human input needed" : "Ready"}</span></div>
            <div className="mt-6 grid grid-cols-4 gap-y-5 md:grid-cols-8">{STAGES.map((stage, index) => { const complete = index <= activeStage; const current = index === activeStage && agentRunning; return <div key={stage}><div className="flex items-center"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${complete ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-400"}`}>{current ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : index + 1}</span>{index < STAGES.length - 1 && <span className={`h-px flex-1 ${index < activeStage ? "bg-teal-500" : "bg-slate-200"}`} />}</div><p className={`mt-2 text-[9px] font-semibold ${complete ? "text-teal-800" : "text-slate-400"}`}>{stage}</p></div>; })}</div>
            <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-300"><Icon name="agent" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Current action</p><p className="mt-1 text-sm font-medium leading-6 text-slate-100">{!run ? "Waiting to retrieve medication evidence from the connected sources." : visibleTrace.at(-1)?.summary ?? "Preparing bounded tools."}</p></div><span className="rounded-lg border border-slate-700 px-2.5 py-1 text-[9px] text-slate-400">{visibleTrace.at(-1)?.tool.replaceAll("_", " ") ?? "idle"}</span></div>{visibleTrace.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2">{visibleTrace.slice(-4).map((entry) => <div key={`${entry.seq}-${entry.tool}`} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"><span className={`h-1.5 w-1.5 rounded-full ${entry.status === "blocked" || entry.status === "failed" ? "bg-red-400" : entry.status === "waiting" ? "bg-amber-400" : "bg-teal-400"}`} /><span className="truncate text-[10px] text-slate-300">{entry.tool.replaceAll("_", " ")}</span><span className="ml-auto text-[8px] uppercase text-slate-600">{entry.status}</span></div>)}</div>}</div>
            {run?.pendingQuestion && agentProgress >= 6 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-white"><Icon name="user" /></span><div><p className="text-xs font-semibold text-slate-950">One answer needed from the patient</p><p className="mt-1 text-sm text-slate-700">{run.pendingQuestion.question}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setConfirmations((all) => ({ ...all, [run.pendingQuestion!.recordId]: true }))} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white">Currently taking it</button><button type="button" onClick={() => setConfirmations((all) => ({ ...all, [run.pendingQuestion!.recordId]: false }))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Not taking it</button></div></div></div></div>}
          </section>

          {!run ? <div className="grid min-h-[390px] place-items-center px-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700"><Icon name="spark" className="h-7 w-7" /></span><h3 className="mt-4 text-lg font-semibold text-slate-950">Ready to reconcile {caseData.patientName}&apos;s record</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The agent will gather five sources, normalize identity, preserve provenance, run configured rules, and stop wherever a person must decide.</p></div></div> : <RunResults run={run} findings={visibleFindings} bodyFilter={bodyFilter} clearFilter={() => setBodyFilter(null)} finding={finding} selected={selected} setSelected={setSelected} decisions={decisions} decide={decide} caseData={caseData} activePatientId={activePatientId} messages={messages} question={question} setQuestion={setQuestion} ask={ask} agentAnswering={agentAnswering} />}

          {measures.length > 0 && <section className="border-t border-slate-200 px-6 py-5"><div className="flex items-baseline justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-teal-700">Read-only measures</p><p className="mt-1 text-sm font-semibold text-slate-950">Trends the agent can cite</p></div><span className="text-[9px] text-slate-400">Passport records only</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{measures.slice(0, 4).map((measure) => <div key={measure.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-medium text-slate-600">{measure.label}</p><p className="mt-1 text-base font-semibold text-slate-950">{measure.value === null ? "Insufficient data" : `${measure.value > 0 ? "+" : ""}${measure.value} ${measure.unit}`}</p><p className="mt-1 text-[9px] text-slate-400">{measure.status === "ok" ? `${measure.basis.length} readings` : "No value calculated"}</p></div>)}</div></section>}

          {specialistReview && <section className="border-t border-slate-200 px-6 py-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-teal-700">Specialist review</p><p className="mt-1 text-sm font-semibold text-slate-950">Four deterministic reviewers, one handoff log</p></div><span className="text-[10px] font-medium text-slate-500">Safety reviewer: {specialistReview.review.passed.length} passed, {specialistReview.review.blocked.length} blocked</span></div>{specialistReview.orchestration.linked.length > 0 && <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-teal-700">Linked across specialists</p>{specialistReview.orchestration.linked.map((item) => <p key={item.id} className="mt-1 text-xs text-slate-700">{item.clinicianText}</p>)}</div>}{specialistReview.review.blocked.length > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-amber-800">Held for safety review</p><ul className="mt-1 space-y-1">{specialistReview.review.blocked.map((item) => <li key={item.itemId} className="text-xs text-amber-950">{item.itemId}: {item.reason}</li>)}</ul></div>}<div className="mt-3 grid gap-3 md:grid-cols-2">{specialistReview.orchestration.outputs.map((output) => <div key={output.specialist} className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{output.specialist}</p><p className="mt-2 text-xs text-slate-700">{output.items.length ? output.items[0].clinicianText : "No routed facts for this specialist."}</p></div>)}</div><details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-[10px] font-semibold text-slate-700">Show agent handoffs ({specialistReview.orchestration.messages.length})</summary><ul className="mt-2 space-y-1">{specialistReview.orchestration.messages.map((message, index) => <li key={`${message.from}-${message.to}-${index}`} className="text-[10px] text-slate-600">{message.from} → {message.to}: {message.summary}</li>)}</ul></details></section>}

          {/* Read-only Photon screening. Always reachable, so a drafted
              prescription can be screened before or after a reconciliation run.
              The panel owns its own state and provenance labels. */}
           {/* The default mount remains <PhotonScreenPanel />; the active synthetic patient is passed explicitly. */}
           <section className="border-t border-slate-200 px-6 py-6"><PhotonScreenPanel key={activePatientId} patientId={activePatientId === "p-margaret" ? "p-margaret" : "p-harold"} /></section>
        </main>

        <aside className="border-t border-slate-200 bg-slate-950 xl:border-l xl:border-t-0">
          <ClinicalBodyAtlas3D findingTitle={finding?.title} findingSystems={run ? (finding ? systemsFor(finding) : []) : undefined} counts={bodyCounts} filter={bodyFilter} onFilter={setBodyFilter} compact embedded />
          <div className="border-t border-slate-800 px-5 py-5 text-white"><div className="flex items-center gap-2 text-teal-300"><Icon name="shield" /><p className="text-[10px] font-semibold uppercase tracking-[.16em]">Authority boundary</p></div><div className="mt-4 space-y-3">{[["Read and reconcile evidence", "Agent", true], ["Detect configured risks", "Rules", true], ["Explain and route", "Agent", true], ["Change medication", "Clinician", false]].map(([label, owner, allowed]) => <div key={String(label)} className="flex items-center gap-3"><span className={`h-1.5 w-1.5 rounded-full ${allowed ? "bg-teal-400" : "bg-red-400"}`} /><span className="flex-1 text-xs text-slate-300">{label}</span><span className="text-[9px] uppercase text-slate-600">{owner}</span></div>)}</div></div>
          <div className="border-t border-slate-800 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Photon check</p><p className="mt-1 text-xs text-slate-300">Draft screening runs in the Photon screening panel in this workspace, where every alert the sandbox returns is shown with its provenance.</p></div>
        </aside>
      </div>
    </div>
    <p className="mt-4 text-center text-[10px] text-slate-400">{liveResult ? "Current record was fetched live from the SMART Health IT public FHIR R4 sandbox; its patient is synthetic and Synthea-generated." : "Built-in patient cohort is demonstration data."} Connector state is labeled at the point of use. Prototype decision support, not clinical validation.</p>
  </div>;
}

function RunResults({ run, findings, bodyFilter, clearFilter, finding, setSelected, decisions, decide, caseData, activePatientId, messages, question, setQuestion, ask, agentAnswering }: {
  run: NonNullable<ReturnType<typeof runClinicianAgent>>; findings: ClinicianFinding[]; bodyFilter: BodySystem | null; clearFilter: () => void; finding?: ClinicianFinding; selected: string | null; setSelected: (id: string) => void; decisions: ClinicianDecision[]; decide: (finding: ClinicianFinding, action: ClinicianDecision["action"]) => void; caseData: ReturnType<typeof buildClinicianCase>; activePatientId: string; messages: { question: string; reply: ClinicianChatReply }[]; question: string; setQuestion: (value: string) => void; ask: (text?: string) => Promise<void>; agentAnswering: boolean;
}) {
  return <>
    <section className="grid border-b border-slate-200 2xl:grid-cols-[.78fr_1.22fr]">
      <div className="border-b border-slate-200 2xl:border-b-0 2xl:border-r"><div className="flex items-center justify-between px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Review queue</p><p className="mt-1 text-sm font-semibold text-slate-950">{findings.length}{bodyFilter ? ` of ${run.findings.length}` : ""} evidence-backed findings</p></div><span className="flex items-center gap-3 text-[11px] text-slate-400">{bodyFilter && <button type="button" onClick={clearFilter} className="font-semibold text-teal-700 underline underline-offset-2">Show all</button>}{decisions.length} reviewed</span></div><div className="border-t border-slate-100">{bodyFilter && findings.length === 0 && <p className="px-5 py-4 text-xs text-slate-500">No findings touch this body system.</p>}{findings.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className={`w-full border-l-2 px-5 py-4 text-left ${finding?.id === item.id ? "border-teal-600 bg-teal-50/60" : "border-transparent hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold leading-5 text-slate-900">{item.title}</p><span className={`rounded-md border px-2 py-0.5 text-[8px] font-semibold uppercase ${priorityStyle(item.priority)}`}>{item.priority}</span></div><p className="mt-1 text-[10px] text-slate-500">{decisions.find((decision) => decision.findingId === item.id) ? "Decision recorded" : `Route to ${item.route}`}</p></button>)}</div></div>
      <div className="p-5">{finding && <><div className="flex gap-2"><span className={`rounded-md border px-2 py-1 text-[8px] font-semibold uppercase ${priorityStyle(finding.priority)}`}>{finding.priority}</span><span className="rounded-md bg-teal-50 px-2 py-1 text-[8px] font-semibold uppercase text-teal-700">{finding.route}</span></div><h3 className="mt-4 text-xl font-semibold tracking-[-.025em] text-slate-950">{finding.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{finding.detail}</p>{finding.citation && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="text-[9px] font-semibold uppercase text-amber-700">Source evidence</p><p className="mt-2 text-xs font-medium leading-5 text-slate-800">“{finding.citation.passage}”</p><a href={finding.citation.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-semibold text-teal-700 underline">{finding.citation.sourceName}</a></div>}{finding.supportingRules?.length ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-semibold uppercase text-slate-500">Parthia rule evidence</p><ul className="mt-2 space-y-2">{finding.supportingRules.map((rule, index) => <li key={`${rule.ruleId}-${index}`}><p className="text-[10px] font-semibold text-slate-700">{rule.ruleId} <span className="font-normal uppercase text-slate-500">({rule.severity})</span></p><p className="text-[9px] text-slate-500">{rule.ruleName}</p><ul className="mt-1 space-y-0.5">{rule.evidence.map((line) => <li key={line} className="text-[10px] leading-4 text-slate-600">{line}</li>)}</ul></li>)}</ul></div> : null}<p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-800">{finding.question}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => decide(finding, "acknowledged")} className="rounded-lg border border-slate-300 px-3 py-2 text-[10px] font-semibold text-slate-700">Acknowledge</button><button type="button" onClick={() => decide(finding, "marked-for-review")} className="rounded-lg bg-teal-700 px-3 py-2 text-[10px] font-semibold text-white">Mark for review</button><button type="button" onClick={() => decide(finding, "deferred")} className="rounded-lg border border-slate-300 px-3 py-2 text-[10px] font-semibold text-slate-700">Defer</button><button type="button" onClick={() => { const policy = checkTool("open_photon_workflow", { approved: true }); if (policy.allowed) { decide(finding, "approved-photon-handoff"); window.open("https://app.neutron.health", "_blank", "noopener,noreferrer"); } }} className="rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white">Open provider workflow</button></div></>}</div>
    </section>
    <section className="border-b border-slate-200"><div className="flex items-center justify-between px-6 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Medication truth</p><p className="mt-1 text-sm font-semibold text-slate-950">Normalized without erasing the source</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-semibold uppercase text-slate-600">{run.status.replace("-", " ")}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="border-y border-slate-100 bg-slate-50/70 text-[9px] uppercase tracking-[.12em] text-slate-400"><tr><th className="px-6 py-3">Ingredient</th><th className="px-3 py-3">As recorded</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">State</th></tr></thead><tbody className="divide-y divide-slate-100">{run.medications.flatMap((item) => item.records.map((record, index) => <tr key={record.id}><td className="px-6 py-3">{index === 0 && <><p className="text-xs font-semibold capitalize text-slate-900">{item.ingredient}</p><p className="text-[9px] text-slate-400">RxCUI {item.rxcui ?? "unmapped"}</p></>}</td><td className="px-3 py-3 text-xs text-slate-700">{record.display}</td><td className="px-3 py-3 text-[10px] font-medium text-slate-600">{record.sourceLabel}</td><td className="px-3 py-3 text-[10px] font-medium text-slate-600">{record.status}</td></tr>))}</tbody></table></div></section>
    <section className="p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-teal-700">Evidence copilot</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Ask the reconciled record</h3></div><button type="button" onClick={() => download(`parthia-${activePatientId}-reconciliation.md`, buildClinicianReport(caseData, run, decisions))} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-[10px] font-semibold text-slate-700"><Icon name="download" />Export audit report</button></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{CLINICIAN_CHAT_EXAMPLES.slice(0, 5).map((example) => <button type="button" key={example} onClick={() => void ask(example)} className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-medium text-slate-600 hover:bg-teal-50">{example}</button>)}</div><div className="mt-4 max-h-72 space-y-3 overflow-y-auto">{messages.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><Icon name="chat" className="mx-auto h-5 w-5 text-teal-700"/><p className="mt-2 text-xs font-medium text-slate-600">Ask about evidence, provenance, disagreements, or agent actions.</p></div> : messages.map((message, index) => <div key={`${message.question}-${index}`}><p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-2.5 text-xs text-white">{message.question}</p><div className={`mt-2 max-w-[90%] rounded-2xl rounded-tl-md border px-4 py-3 ${message.reply.refused ? "border-red-200 bg-red-50" : "border-teal-100 bg-teal-50"}`}><p className="mb-1 text-[8px] font-semibold uppercase text-slate-400">{message.reply.source === "openrouter" ? "OpenRouter · grounded" : "Deterministic evidence path"}</p><p className="whitespace-pre-line text-xs leading-5 text-slate-700">{message.reply.text}</p></div></div>)}</div><div className="mt-4 flex overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-teal-600"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void ask()} placeholder="Ask Parthia about this record…" className="min-w-0 flex-1 px-4 py-3 text-xs outline-none"/><button type="button" onClick={() => void ask()} disabled={agentAnswering} className="inline-flex items-center gap-2 bg-teal-700 px-5 text-xs font-semibold text-white disabled:opacity-60">{agentAnswering ? "Thinking" : "Ask"}<Icon name="arrow" /></button></div></section>
  </>;
}
