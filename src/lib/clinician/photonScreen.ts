import { PHOTON_CATALOG_LOOKED_UP_ON, PHOTON_DEMO_DRAFTS, photonTreatment, photonTreatmentId } from "./photonCatalog";
import { PHOTON_EXAMPLE_SCREENS } from "./photonExamples";
import { PHOTON_RECORDED_SCREENS, type RecordedPhotonScreen } from "./photonRecorded";
/**
 * Typed client for the root `api/photon/*` functions.
 *
 * Screening is read-only decision support. Nothing here prescribes, changes,
 * stops or doses a medication, and every result carries the provenance of the
 * data behind it so the UI can never show synthetic data as live.
 */
export type PhotonProvenance = "live" | "recorded" | "synthetic";
/** Exact labels. "live" is reserved for a response from a real sandbox call. */
export const PHOTON_LIVE_LABEL = "Photon screening (Neutron sandbox, live)";
export const PHOTON_RECORDED_LABEL = "Recorded sandbox response";
export const PHOTON_SYNTHETIC_LABEL = "Example screening response (synthetic). Live Neutron screening unavailable.";
export const PHOTON_SYNC_LIVE_LABEL = "Photon patient sync (Neutron sandbox, live)";
export const PHOTON_CATALOG_LABEL = `Treatment and allergen ids looked up live from the Neutron sandbox on ${PHOTON_CATALOG_LOOKED_UP_ON}`;
export interface PhotonScreenEntity {
  id: string;
  name: string;
  kind: string;
}
export interface PhotonScreenAlert {
  type: string;
  severity: string;
  description: string;
  involvedEntities: PhotonScreenEntity[];
}
export interface PhotonDraft {
  treatmentKey: string;
  label: string;
  expects: string;
}
export interface PhotonScreenOutcome {
  provenance: PhotonProvenance;
  label: string;
  drafts: PhotonDraft[];
  alerts: PhotonScreenAlert[];
  /** Present when the live call could not be used, in plain words. */
  reason?: string;
  screenedAt?: string;
  patientId?: string;
}
export interface PhotonSyncOutcome {
  live: boolean;
  label: string;
  patientId?: string;
  externalId?: string;
  created?: boolean;
  updated?: boolean;
  syncedAt?: string;
  reason?: string;
}
export const PHOTON_DRAFT_OPTIONS: PhotonDraft[] = PHOTON_DEMO_DRAFTS;
export function photonProvenanceLabel(provenance: PhotonProvenance): string {
  if (provenance === "live") return PHOTON_LIVE_LABEL;
  if (provenance === "recorded") return PHOTON_RECORDED_LABEL;
  return PHOTON_SYNTHETIC_LABEL;
}
function draftsFor(treatmentKeys: string[]): PhotonDraft[] {
  return treatmentKeys.map((treatmentKey) => {
    const option = PHOTON_DEMO_DRAFTS.find((draft) => draft.treatmentKey === treatmentKey);
    return option ?? { treatmentKey, label: photonTreatment(treatmentKey)?.label ?? treatmentKey, expects: "" };
  });
}
/**
 * Fallback used only when the live call fails. Prefers a response really
 * captured from the sandbox; otherwise returns a synthetic example, labelled
 * as one. Never labels a synthetic example recorded.
 */
export function photonFallback(
  treatmentKeys: string[],
  reason: string,
  recorded: Record<string, RecordedPhotonScreen> = PHOTON_RECORDED_SCREENS,
): PhotonScreenOutcome {
  const captures = treatmentKeys.map((key) => recorded[key]).filter(Boolean) as RecordedPhotonScreen[];
  if (captures.length === treatmentKeys.length && captures.length > 0) {
    return {
      provenance: "recorded",
      label: PHOTON_RECORDED_LABEL,
      drafts: draftsFor(treatmentKeys),
      alerts: captures.flatMap((capture) => capture.alerts),
      screenedAt: captures[0].recordedAt,
      reason,
    };
  }
  return {
    provenance: "synthetic",
    label: PHOTON_SYNTHETIC_LABEL,
    drafts: draftsFor(treatmentKeys),
    alerts: treatmentKeys.flatMap((key) => PHOTON_EXAMPLE_SCREENS[key] ?? []),
    reason,
  };
}
function statusReason(status: number, detail?: string): string {
  if (status === 404) return "The screening function is not served here. Run it on Vercel or with vercel dev.";
  if (status === 503) return detail ? `The sandbox screening call did not succeed: ${detail}` : "The sandbox screening call did not succeed.";
  return `The screening call returned status ${status}.`;
}
/**
 * Runs the read-only screen through the server function. Credentials stay on
 * the server: this only ever sends treatment ids.
 */
export async function runPhotonScreen(
  treatmentKeys: string[],
  options: { recorded?: Record<string, RecordedPhotonScreen>; fetchImpl?: typeof fetch } = {},
): Promise<PhotonScreenOutcome> {
  const doFetch = options.fetchImpl ?? fetch;
  let treatmentIds: string[];
  try {
    treatmentIds = treatmentKeys.map((key) => photonTreatmentId(key));
  } catch {
    return photonFallback(treatmentKeys, "That draft is not in the demo screening catalog.", options.recorded);
  }
  try {
    const response = await doFetch("/api/photon/screen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ treatmentIds }),
    });
    const payload = await response.json() as {
      alerts?: PhotonScreenAlert[];
      patientId?: string;
      screenedAt?: string;
      detail?: string;
    };
    if (!response.ok) return photonFallback(treatmentKeys, statusReason(response.status, payload?.detail), options.recorded);
    return {
      provenance: "live",
      label: PHOTON_LIVE_LABEL,
      drafts: draftsFor(treatmentKeys),
      alerts: payload.alerts ?? [],
      screenedAt: payload.screenedAt,
      patientId: payload.patientId,
    };
  } catch {
    return photonFallback(treatmentKeys, "The screening call could not be reached from this browser.", options.recorded);
  }
}
/**
 * Creates the synthetic sandbox patient once and returns his Photon id. Safe
 * to call repeatedly: the server function is idempotent.
 */
export async function syncPhotonPatient(options: { fetchImpl?: typeof fetch } = {}): Promise<PhotonSyncOutcome> {
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch("/api/photon/sync-patient", { method: "POST" });
    const payload = await response.json() as {
      patientId?: string;
      externalId?: string;
      created?: boolean;
      updated?: boolean;
      syncedAt?: string;
      detail?: string;
    };
    if (!response.ok) {
      return { live: false, label: "Sandbox patient sync unavailable", reason: statusReason(response.status, payload?.detail) };
    }
    return {
      live: true,
      label: PHOTON_SYNC_LIVE_LABEL,
      patientId: payload.patientId,
      externalId: payload.externalId,
      created: payload.created,
      updated: payload.updated,
      syncedAt: payload.syncedAt,
    };
  } catch {
    return { live: false, label: "Sandbox patient sync unavailable", reason: "The sync call could not be reached from this browser." };
  }
}
