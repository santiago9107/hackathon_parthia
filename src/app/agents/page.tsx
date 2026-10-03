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

function AgentCard({ agent }: { agent: AgentPersona }) {
  const steps = stepsFor(agent);
  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ backgroundColor: agent.color }} />
      <div className="flex items-start gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface ring-4 ring-surface" aria-hidden><AgentFace id={agent.id} size={48} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-ink">{agent.name}</p>
              <p className="text-[13px] font-medium" style={{ color: agent.color }}>{agent.role}</p>
            </div>
            {agent.tribute && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-[#5c430d]"><SponsorLogo name={agent.tribute} /></span>}
          </div>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{agent.audience}</p>

          <p className="mt-3 rounded-xl border border-line bg-cream px-3 py-2.5 text-[13px] font-medium leading-relaxed text-ink-soft">
            &ldquo;{agent.assurance}&rdquo;
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{agent.description}</p>

          <p className="mt-3 border-l-2 pl-3 text-[12px] italic leading-relaxed text-ink-muted" style={{ borderColor: `${agent.color}66` }}>
            {agent.why}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {(agent.does ?? agent.tools).map((t) => (
              <span key={t} className={`rounded-md px-2 py-0.5 text-[11px] ${agent.does ? "bg-brand-50 text-brand-800" : "bg-cream-dark font-mono text-ink-soft"}`}>
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">
            {steps > 0 && <><strong className="text-ink">{steps}</strong> steps in Margaret&apos;s run · </>}
            {stat(agent)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-muted">{agent.code}</p>
        </div>
      </div>
    </Card>
  );
}

export default function AgentsPage() {
  const blocked = guardrails();
  return (
    <div className="mx-auto max-w-5xl">
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {AGENTS.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-navy">What no agent can do</h2>
        <p className="mt-1 text-sm text-ink-muted">Read live from the policy every agent calls. These requests are refused, with the reason below.</p>
        <ul className="mt-4 divide-y divide-line">
          {blocked.map((b) => (
            <li key={b.tool} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="flex w-56 shrink-0 items-center gap-2 text-sm font-semibold text-attention"><AppIcon name="close" className="h-4 w-4" />{b.label}</span>
              <span className="text-sm text-ink-soft">{b.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-sm text-ink-muted">
        See them work: <Link href="/" className="font-semibold text-brand-700 underline">Margaret&apos;s home</Link> for Nova, and the{" "}
        <Link href="/clinician/" className="font-semibold text-brand-700 underline">clinician view</Link> for Reid, Dex, Fotini, Willem, Elsie, Aaron and Iris. <Link href="/analytics/" className="font-semibold text-brand-700 underline">Open the live analytics view</Link>.
      </p>
      <Card className="mt-6 flex items-center gap-4 p-4"><Image src="/try-it-qr.png" alt="QR code for the Parthia Health demo" width={96} height={96} /><div><p className="text-sm font-semibold text-ink">Try it on your phone</p><p className="mt-1 text-xs text-ink-muted">Scan to open the live demonstration.</p></div></Card>
    </div>
  );
}
