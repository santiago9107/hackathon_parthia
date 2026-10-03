"use client";
import { useState } from "react";
import {
  PHOTON_CATALOG_LABEL,
  PHOTON_DRAFT_OPTIONS,
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
export function PhotonScreenPanel({ className = "" }: { className?: string }) {
  const [selected, setSelected] = useState<string[]>([PHOTON_DRAFT_OPTIONS[0]?.treatmentKey ?? ""]);
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
    setOutcome(await runPhotonScreen(selected));
    setBusy("idle");
  }
  async function connectPatient() {
    setBusy("syncing");
    setSync(await syncPhotonPatient());
    setBusy("idle");
  }
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`} aria-labelledby="photon-screen-heading">
      <h2 id="photon-screen-heading" className="text-base font-semibold text-slate-900">Photon screening</h2>
      <p className="mt-1 text-sm text-slate-600">
        Drug-drug and drug-allergy screening of a drafted prescription against the sandbox patient&apos;s medication history and
        allergies. Synthetic patient. Read-only.
      </p>
      <p className="mt-1 text-xs text-slate-500">{PHOTON_CATALOG_LABEL}</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">Sandbox patient</p>
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
          {PHOTON_DRAFT_OPTIONS.map((draft) => {
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
