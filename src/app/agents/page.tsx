import Link from "next/link";
import Image from "next/image";
import { PageHeader, Card } from "@/components/PageHeader";
import { AGENTS, guardrails, type AgentPersona } from "@/lib/agents/roster";
import { runClinicianAgent } from "@/lib/clinician/agent";
import { buildClinicianCase } from "@/lib/clinician/cases";
import { PHOTON_DEMO_DRAFTS } from "@/lib/clinician/photonCatalog";
import { RULES } from "@/lib/safetyEngine";
import { AppIcon } from "@/components/AppIcon";
import { AgentFace } from "@/components/agents/AgentFace";
import { SponsorLogo } from "@/components/agents/SponsorLogo";
import { AgentFlow, AgentMotionStyles, STEP_SECONDS } from "@/components/agents/AgentFlow";
import { stepIndexOf } from "@/lib/agents/flow";

/**
 * The agent roster. Every count on this page comes from a real run of the
 * clinician agent on Margaret's case, done at build time, so it reads the same
 * code the clinician view runs.
 */
const margaret = runClinicianAgent(buildClinicianCase("p-margaret"), { confirmations: { "passport:otc-diphenhydramine": true }, resumed: true });

function stepsFor(agent: AgentPersona) {
  return margaret.trace.filter((t) => (agent.tools as string[]).includes(t.tool)).length;
}

function stat(agent: AgentPersona): string {
  switch (agent.id) {
    case "patient": return "No model, no API key";
    case "records": return `${margaret.records.length} records into ${margaret.medications.length} medicines for Margaret`;
    case "safety": return `${RULES.length} Parthia rules · ${margaret.findings.length} questions for Margaret's care team`;
    case "photon": return `${PHOTON_DEMO_DRAFTS.length} drafts screened in the live Photon sandbox`;
    default: return `${margaret.findings.length} findings routed, none skipped`;
  }
}

function AgentCard({ agent, index }: { agent: AgentPersona; index: number }) {
  const steps = stepsFor(agent);
  const step = stepIndexOf(agent.id);
  const chips = (agent.does ?? agent.tools).slice(0, 3);
  const live = agent.id === "photon";
  return (
    <article
      className={`af-card overflow-hidden rounded-card border bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${live ? "border-gold-500 ring-2 ring-gold-500" : "border-line"}`}
      style={{ "--d": `${Math.max(step, 0) * STEP_SECONDS}s`, "--in": `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="h-[3px]" style={{ backgroundColor: agent.color }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface ring-2 ring-line" aria-hidden><AgentFace id={agent.id} size={40} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight text-ink">{agent.name}</p>
            <p className="text-xs font-medium leading-tight" style={{ color: agent.color }}>{agent.role}</p>
          </div>
          {agent.tribute && <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-[#5c430d]"><SponsorLogo name={agent.tribute} /></span>}
        </div>
        <p className="mt-3 text-[13px] leading-snug text-ink-soft">&ldquo;{agent.assurance}&rdquo;</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((t) => (
            <span key={t} className={`rounded-md px-2 py-0.5 text-[11px] ${agent.does ? "bg-brand-50 text-brand-800" : "bg-cream-dark font-mono text-ink-soft"}`}>{t}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {steps > 0 && <><strong className="text-ink">{steps}</strong> steps in Margaret&apos;s run · </>}
          {stat(agent)}
        </p>
        {live && (
          <Link href="/clinician/#photon-screen" className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gold-100 px-3 py-2 text-xs font-bold text-[#5c430d] hover:bg-gold-200">
            <span>Live integration: Photon Neutron sandbox</span><span aria-hidden>See it in the clinician view</span>
          </Link>
        )}
        <details className="mt-2 text-xs text-ink-soft">
          <summary className="cursor-pointer font-semibold text-brand-700">About this agent</summary>
          <p className="mt-2 leading-relaxed">{agent.description}</p>
          <p className="mt-2 border-l-2 pl-3 italic leading-relaxed text-ink-muted" style={{ borderColor: `${agent.color}66` }}>{agent.why}</p>
          <p className="mt-2 font-mono text-[11px] text-ink-muted">{agent.code}</p>
        </details>
      </div>
    </article>
  );
}

const named = (id: string) => AGENTS.find((a) => a.id === id)!.name;
const captions = [
  `${named("patient")} hears Margaret's question and checks for urgent symptoms first.`,
  `${named("records")} gathers ${margaret.records.length} records and merges them into ${margaret.medications.length} medicines.`,
  `${named("safety")} checks ${RULES.length} rules and raises ${margaret.findings.length} questions for her care team.`,
  "The router sends each fact to the right specialist and links shared ingredients.",
  `${named("cardiology")}, ${named("nutrition")} and ${named("behavioral")} review in parallel, each from their own field.`,
  `${named("photon")} screens a drafted prescription against Photon's live sandbox.`,
  "The safety reviewer blocks unsupported facts and directive wording.",
  `${named("liaison")} lays out the review for the clinician. Every finding waits for a person.`,
];

export default function AgentsPage() {
  const blocked = guardrails();
  return (
    <div className="mx-auto max-w-6xl">
      <AgentMotionStyles />
      <PageHeader
        eyebrow="The agent team"
        title={`${AGENTS.length} agents, one patient, the same guardrails`}
        subtitle="Each agent owns one part of the job, from Margaret's own questions to a clinician's Photon check. They hand work to each other and to people, and every one of them calls the same policy before it acts."
      />

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-soft">
        <span><strong className="text-ink">{AGENTS.length}</strong> agents</span>
        <span><strong className="text-ink">{margaret.trace.length}</strong> steps in Margaret&apos;s run</span>
        <span><strong className="text-ink">{blocked.length}</strong> actions no agent can take</span>
        <span><strong className="text-ink">1</strong> shared policy</span>
      </div>

      <h2 className="mb-3 font-serif text-xl font-semibold text-navy">How they hand work to each other</h2>
      <AgentFlow captions={captions} />

      <h2 className="mb-3 mt-8 font-serif text-xl font-semibold text-navy">The team</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent, index) => <AgentCard key={agent.id} agent={agent} index={index} />)}
      </div>

      <Card className="mt-8 p-4 sm:p-5">
        <h2 className="font-serif text-xl font-semibold text-navy">What no agent can do</h2>
        <p className="mt-1 text-sm text-ink-muted">Read live from the policy every agent calls. These requests are refused, with the reason below.</p>
        <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
          {blocked.map((b) => (
            <li key={b.tool} className="flex flex-col gap-0.5 border-t border-line py-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-attention"><AppIcon name="close" className="h-4 w-4" />{b.label}</span>
              <span className="pl-6 text-[13px] text-ink-soft">{b.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-sm text-ink-muted">
        See them work: <Link href="/" className="font-semibold text-brand-700 underline">Margaret&apos;s home</Link> for Nova, and the{" "}
        <Link href="/clinician/" className="font-semibold text-brand-700 underline">clinician view</Link> for Reid, Dex, Fotini, Willem, Elsie, Aaron and Iris, and the{" "}
        <Link href="/analytics/" className="font-semibold text-brand-700 underline">holistic analysis</Link> for the heart-failure domains.
      </p>
      <Card className="mt-6 flex items-center gap-4 p-4"><Image src="/try-it-qr.png" alt="QR code for the Parthia Health demo" width={96} height={96} /><div><p className="text-sm font-semibold text-ink">Try it on your phone</p><p className="mt-1 text-xs text-ink-muted">Scan to open the live demonstration.</p></div></Card>
    </div>
  );
}
