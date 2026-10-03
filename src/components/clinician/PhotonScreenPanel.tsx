"use client";
import { useState } from "react";
import { photonDemoDrafts, photonDemoPatientName, type PhotonDemoPatientId } from "@/lib/clinician/photonCatalog";
import {
  PHOTON_CATALOG_LABEL,
  type PhotonScreenOutcome,
  type PhotonSyncOutcome,
  runPhotonScreen,
  syncPhotonPatient,
} from "@/lib/clinician/photonScreen";
/**
 * Photon Neutron screening panel. Self-contained: it calls the root api/photon
 * functions itself, so it can be dropped into any clinician view.
 *
 * Read-only decision support. The panel screens drafted prescriptions and
 * shows what the sandbox says about them. It cannot prescribe, change, stop or
 * dose a medication, and the result is a question for the clinician, not an
 * instruction. Live results are labelled live; anything else is labelled for
 * what it is.
 */
const severityStyle: Record<string, string> = {
  MAJOR: "border-red-200 bg-red-50 text-red-800",
  MODERATE: "border-amber-200 bg-amber-50 text-amber-800",
  MINOR: "border-slate-200 bg-slate-50 text-slate-700",
};
const provenanceStyle: Record<PhotonScreenOutcome["provenance"], string> = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-800",
  recorded: "border-slate-200 bg-slate-100 text-slate-700",
  synthetic: "border-amber-200 bg-amber-50 text-amber-800",
};
function entityLine(alert: PhotonScreenOutcome["alerts"][number]): string {
  return alert.involvedEntities.map((entity) => `${entity.name} (${entity.kind})`).join(", ");
}
/** Pure view of a screening outcome. Rendered by the panel and by tests. */
export function PhotonScreenResultView({ outcome }: { outcome: PhotonScreenOutcome }) {
  return (
    <div className="mt-4">
      <div className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${provenanceStyle[outcome.provenance]}`}>
        {outcome.label}
      </div>
      {outcome.reason && <p className="mt-2 text-xs text-slate-600">{outcome.reason}</p>}
      {outcome.screenedAt && (
        <p className="mt-1 text-xs text-slate-500">
          {outcome.provenance === "live" ? "Screened at " : "Captured at "}
          {outcome.screenedAt}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Drafts screened: {outcome.drafts.map((draft) => draft.label).join(", ") || "none"}
      </p>
      {outcome.alerts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          No interaction or allergy alert came back for this draft.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {outcome.alerts.map((alert, index) => (
            <li key={`${alert.type}-${index}`} className={`rounded-xl border p-3 ${severityStyle[alert.severity] ?? severityStyle.MINOR}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{alert.type}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide">{alert.severity}</span>
              </div>
              <p className="mt-2 text-sm leading-6">{alert.description}</p>
              {alert.involvedEntities.length > 0 && (
                <p className="mt-1 text-xs opacity-80">Involves: {entityLine(alert)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-600">
        Decision support only. This panel does not prescribe, change, stop or dose anything. Only the clinician decides, and
        prescribing goes through Photon&apos;s authorized provider workflow.
      </p>
    </div>
  );
}
export function PhotonScreenPanel({ className = "", patientId = "p-harold" }: { className?: string; patientId?: PhotonDemoPatientId }) {
  const draftOptions = photonDemoDrafts(patientId);
  const [selected, setSelected] = useState<string[]>([draftOptions[0]?.treatmentKey ?? ""]);
  const [outcome, setOutcome] = useState<PhotonScreenOutcome | null>(null);
  const [sync, setSync] = useState<PhotonSyncOutcome | null>(null);
  const [busy, setBusy] = useState<"idle" | "screening" | "syncing">("idle");
  function toggle(treatmentKey: string) {
    setSelected((current) => (
      current.includes(treatmentKey) ? current.filter((key) => key !== treatmentKey) : [...current, treatmentKey]
    ));
  }
  async function screen() {
    if (!selected.length) return;
    setBusy("screening");
    setOutcome(await runPhotonScreen(selected, { patientId }));
    setBusy("idle");
  }
  async function connectPatient() {
    setBusy("syncing");
    setSync(await syncPhotonPatient({ patientId }));
    setBusy("idle");
  }
  const steps = [
    { label: "Connect sandbox patient", done: Boolean(sync) },
    { label: "Pick a draft", done: selected.length > 0 },
    { label: "Photon screens it", done: Boolean(outcome) },
    { label: "Read the alerts", done: Boolean(outcome) },
    { label: "A clinician decides", done: false },
  ];
  const current = steps.findIndex((step) => !step.done);
  return (
    <section className={`overflow-hidden rounded-2xl border-2 border-amber-300 bg-white p-5 ${className}`} aria-labelledby="photon-screen-heading">
      <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-900">
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded bg-amber-400 text-[11px] font-black text-slate-900">P</span>
          Photon Health
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">Live integration, Photon Neutron sandbox</span>
      </div>
      <h2 id="photon-screen-heading" className="text-base font-semibold text-slate-900">Photon screening</h2>
      <p className="mt-1 text-sm text-slate-600">
        Drug-drug and drug-allergy screening of a drafted prescription against {photonDemoPatientName(patientId)}&apos;s medication history and
        allergies. Synthetic patient. Read-only. Fotini, the Photon screening agent, runs this step.
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs" aria-label="Screening steps">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${step.done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : i === current ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <span className="tabular-nums">{i + 1}</span>{step.label}
            </span>
            {i < steps.length - 1 && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-slate-500">{PHOTON_CATALOG_LABEL}</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">Sandbox patient: {photonDemoPatientName(patientId)}</p>
          <button
            type="button"
            onClick={connectPatient}
            disabled={busy !== "idle"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-500 disabled:opacity-50"
          >
            {busy === "syncing" ? "Connecting" : "Connect sandbox patient"}
          </button>
        </div>
        {sync && (
          <div className="mt-2 text-xs" aria-live="polite">
            <span className={`inline-flex rounded-md border px-2 py-0.5 font-semibold ${sync.live ? provenanceStyle.live : provenanceStyle.synthetic}`}>
              {sync.label}
            </span>
            {sync.patientId && (
              <p className="mt-1 text-slate-600">
                Photon patient {sync.patientId}
                {sync.created ? ", created now" : ", already present"}
                {sync.updated ? ", history refreshed" : ""}
              </p>
            )}
            {sync.reason && <p className="mt-1 text-slate-600">{sync.reason}</p>}
          </div>
        )}
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-800">Draft a prescription to screen</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {draftOptions.map((draft) => {
            const active = selected.includes(draft.treatmentKey);
            return (
              <button
                key={draft.treatmentKey}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(draft.treatmentKey)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${active ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-700"}`}
              >
                {draft.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={screen}
        disabled={busy !== "idle" || selected.length === 0}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy === "screening" ? "Screening" : "Screen draft"}
      </button>
      <div aria-live="polite">{outcome && <PhotonScreenResultView outcome={outcome} />}</div>
    </section>
  );
}
export default PhotonScreenPanel;
