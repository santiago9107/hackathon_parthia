/**
 * The clinician page does a lot, so this bar says what the job is, in order:
 * reconcile, review, screen with Photon, decide. Each step links to its part
 * of the page. The Photon step is the live sponsor integration and is marked.
 */
const STEPS = [
  { href: "#agent-workspace", label: "Reconcile records", hint: "5 sources, one list" },
  { href: "#review-queue", label: "Review findings", hint: "Every one needs a person" },
  { href: "#photon-screen", label: "Screen with Photon", hint: "Live drug and allergy check", sponsor: true },
  { href: "#finding-detail", label: "Decide", hint: "Only a clinician acts" },
] as const;

function Chevron() {
  return <svg viewBox="0 0 24 24" className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>;
}

function Check() {
  return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

export function ClinicianJourney({ launched, reviewed }: { launched: boolean; reviewed: boolean }) {
  const done = [launched, launched && reviewed, false, reviewed];
  return (
    <nav aria-label="Clinician journey" className="mb-4">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1.5">
        {STEPS.map((step, i) => {
          const sponsor = "sponsor" in step && step.sponsor;
          return (
            <li key={step.label} className="flex flex-1 items-center gap-1.5">
              <a
                href={step.href}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 transition hover:-translate-y-0.5 hover:shadow-md ${sponsor ? "border-2 border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done[i] ? "bg-emerald-600 text-white" : sponsor ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-600"}`}>
                  {done[i] ? <Check /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold leading-tight text-slate-900">
                    {step.label}
                    {sponsor && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold leading-none text-slate-900">PHOTON HEALTH</span>}
                  </span>
                  <span className="mt-0.5 block text-xs leading-tight text-slate-500">{step.hint}</span>
                </span>
              </a>
              {i < STEPS.length - 1 && <Chevron />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
