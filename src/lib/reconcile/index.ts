import type { Allergy, Medication, PatientRecord } from "../types";
import type { LocalPassport, Resolution, SourceConnection } from "../passport/collections";
import { normDose, normFrequency, sameAllergy } from "../passport/importPlan";

/**
 * RECONCILIATION
 *
 * The same medicine or allergy can arrive from several places — the patient,
 * a hospital record, a scanned prescription. This compares them across
 * sources and lists what the patient should look at:
 *
 *   duplicate            same medicine, same dose, listed twice
 *   dose-conflict        same medicine, different dose
 *   frequency-conflict   same medicine and dose, different schedule
 *   missing-from-source  on the Passport, but not on a connected record
 *                        (e.g. over-the-counter or prescribed elsewhere)
 *   possibly-stopped     a connected record says it was stopped; the
 *                        Passport still lists it
 *   allergy-missing-from-source
 *
 * Matching is by generic name (which comes from RxNorm where available).
 * Pending imports take part, so a conflict shows up before it's confirmed.
 */

export type IssueKind = "duplicate" | "dose-conflict" | "frequency-conflict" | "missing-from-source" | "possibly-stopped" | "allergy-missing-from-source";

export interface ReconEntry<T = Medication | Allergy> {
  item: T;
  /** Confirmed (in the record) or waiting for review. */
  state: "confirmed" | "pending";
}

export type ResolutionEffect =
  | { type: "keep-only"; keepId: string }
  | { type: "acknowledge" }
  | { type: "ask-clinician" }
  | { type: "mark-stopped"; medicationId: string };

export interface ResolutionOption {
  id: string;
  label: string;
  effect: ResolutionEffect;
}

export interface ReconIssue {
  id: string;
  kind: IssueKind;
  title: string;
  explanation: string;
  /** Phrased as a question for the clinician summary. */
  question: string;
  medications: ReconEntry<Medication>[];
  allergies: ReconEntry<Allergy>[];
  source?: string;
  options: ResolutionOption[];
  resolution?: Resolution;
}

const active = (m: Medication) => (m.status ?? "active") === "active";

function pendingOf<T>(local: LocalPassport | undefined, collection: "medications" | "allergies"): T[] {
  return (local?.entries ?? []).filter((e) => e.collection === collection && e.status === "pending" && !e.removed).map((e) => e.item as unknown as T);
}

const describeMed = (m: Medication) => `${m.name} ${m.dose}, ${m.frequency}`;

export function findIssues(record: PatientRecord, local: LocalPassport | undefined): ReconIssue[] {
  const issues: ReconIssue[] = [];
  const meds: ReconEntry<Medication>[] = [
    ...record.patient.medications.map((item) => ({ item, state: "confirmed" as const })),
    ...pendingOf<Medication>(local, "medications").filter(active).map((item) => ({ item, state: "pending" as const })),
  ];

  // 1. The same medicine listed more than once.
  const byGeneric = new Map<string, ReconEntry<Medication>[]>();
  for (const e of meds) byGeneric.set(e.item.genericName, [...(byGeneric.get(e.item.genericName) ?? []), e]);
  for (const [generic, group] of byGeneric) {
    if (group.length < 2) continue;
    const doses = new Set(group.map((e) => normDose(e.item.dose)));
    const freqs = new Set(group.map((e) => normFrequency(e.item.frequency)));
    const name = group[0].item.name;
    const sources = [...new Set(group.map((e) => e.item.source.label))];
    const keepOptions: ResolutionOption[] = group.map((e) => ({
      id: `keep:${e.item.id}`,
      label: `${e.item.dose}, ${e.item.frequency} is right (${e.item.source.label})`,
      effect: { type: "keep-only", keepId: e.item.id },
    }));
    if (doses.size > 1) {
      issues.push({
        id: `dose-conflict:${generic}`, kind: "dose-conflict", title: `${name}: different doses in your records`,
        explanation: `${sources.join(" and ")} list different doses: ${group.map((e) => `${e.item.dose} (${e.item.source.label})`).join(" vs ")}. Only one is probably current — a dose change may not have reached every record.`,
        question: `Which dose of ${name} should I be taking? My records show ${group.map((e) => e.item.dose).join(" and ")}.`,
        medications: group, allergies: [],
        options: [...keepOptions, { id: "ask", label: "I'm not sure — ask my clinician", effect: { type: "ask-clinician" } }],
      });
    } else if (freqs.size > 1) {
      issues.push({
        id: `frequency-conflict:${generic}`, kind: "frequency-conflict", title: `${name}: different schedules in your records`,
        explanation: `${group.map((e) => `${e.item.source.label} says ${e.item.frequency}`).join("; ")}. It's worth making sure everyone has the same instructions.`,
        question: `How often should I take ${name}? My records disagree (${group.map((e) => e.item.frequency).join(" vs ")}).`,
        medications: group, allergies: [],
        options: [...keepOptions, { id: "ask", label: "I'm not sure — ask my clinician", effect: { type: "ask-clinician" } }],
      });
    } else {
      issues.push({
        id: `duplicate:${generic}`, kind: "duplicate", title: `${name} is listed twice`,
        explanation: `The same medicine and dose came from ${sources.join(" and ")}. Keeping one entry avoids it looking like you take a double dose.`,
        question: `Please confirm I take ${describeMed(group[0].item)} only once.`,
        medications: group, allergies: [],
        options: [{ id: `keep:${group[0].item.id}`, label: "Keep one entry", effect: { type: "keep-only", keepId: group[0].item.id } }, { id: "ack", label: "They're different — keep both", effect: { type: "acknowledge" } }],
      });
    }
  }

  // 2. Compare with each connected record's snapshot.
  const ehrs = (local?.connections ?? []).filter((c): c is SourceConnection & { snapshot: NonNullable<SourceConnection["snapshot"]> } => c.kind === "ehr" && !!c.snapshot && c.status === "connected");
  for (const c of ehrs) {
    const listed = new Map(c.snapshot.medications.map((m) => [m.genericName, m]));
    for (const e of meds.filter((x) => x.state === "confirmed")) {
      const m = e.item;
      const inSource = listed.get(m.genericName);
      if (!inSource) {
        issues.push({
          id: `missing-from-source:${c.id}:${m.genericName}`, kind: "missing-from-source", source: c.name,
          title: `${m.name} isn't on your ${c.name.replace(/ \(simulated\)$/, "")} record`,
          explanation: `Your Passport lists ${describeMed(m)}${m.prescriber ? ` (${m.prescriber})` : ""}, but your hospital record doesn't. It may be over the counter or prescribed elsewhere — clinicians there may not know you take it.`,
          question: `Can you add ${m.name} ${m.dose} to my record? I take it, but it isn't on my medication list with you.`,
          medications: [e], allergies: [],
          options: [
            { id: "ask", label: "I'll tell my care team", effect: { type: "ask-clinician" } },
            { id: "stopped", label: "I no longer take it", effect: { type: "mark-stopped", medicationId: m.id } },
            { id: "ack", label: "They already know", effect: { type: "acknowledge" } },
          ],
        });
      } else if (inSource.status !== "active") {
        issues.push({
          id: `possibly-stopped:${c.id}:${m.genericName}`, kind: "possibly-stopped", source: c.name,
          title: `${m.name} may have been stopped`,
          explanation: `Your ${c.name.replace(/ \(simulated\)$/, "")} record marks ${inSource.name} as ${inSource.status}, but your Passport still lists it as something you take.`,
          question: `My record shows ${m.name} as ${inSource.status}. Should I still be taking it?`,
          medications: [e], allergies: [],
          options: [
            { id: "still", label: "I still take it — ask my clinician", effect: { type: "ask-clinician" } },
            { id: "stopped", label: "I stopped it", effect: { type: "mark-stopped", medicationId: m.id } },
          ],
        });
      }
    }
    for (const a of record.allergies.filter((x) => x.category === "medication")) {
      if (c.snapshot.allergies.some((s) => sameAllergy(s, a))) continue;
      issues.push({
        id: `allergy-missing-from-source:${c.id}:${a.substance.toLowerCase()}`, kind: "allergy-missing-from-source", source: c.name,
        title: `Your ${a.substance} allergy isn't on your ${c.name.replace(/ \(simulated\)$/, "")} record`,
        explanation: `Your Passport records an allergy to ${a.substance}${a.reaction ? ` (${a.reaction.toLowerCase()})` : ""}, but your hospital record doesn't list it. Allergies are important for everyone who prescribes for you to know.`,
        question: `Can you add my allergy to ${a.substance} to my record?`,
        medications: [], allergies: [{ item: a, state: "confirmed" }],
        options: [{ id: "ask", label: "I'll tell my care team", effect: { type: "ask-clinician" } }, { id: "ack", label: "They already know", effect: { type: "acknowledge" } }],
      });
    }
  }

  const resolutions = new Map((local?.resolutions ?? []).map((r) => [r.issueId, r]));
  return issues.map((i) => ({ ...i, resolution: resolutions.get(i.id) }));
}

/** Issues the patient hasn't dealt with yet. */
export function openIssues(issues: ReconIssue[]): ReconIssue[] {
  return issues.filter((i) => !i.resolution);
}

/** Questions to put in the clinician summary: open issues + ones the patient chose to ask about. */
export function questionsForClinician(issues: ReconIssue[]): string[] {
  return issues.filter((i) => !i.resolution || i.resolution.askClinician).map((i) => i.question);
}
