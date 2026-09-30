"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChoiceGroup, Form, FormPage, SavedPanel, SelectField, SubmitBar, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { REFERENCE_DATE } from "@/lib/mockData";
import { addEntries, editEntry } from "@/lib/passport/actions";
import { buildMedication, medicationChangeEvent, validateMedication, youSource, type MedicationInput } from "@/lib/log/entries";
import { DRUGS, lookupDrug } from "@/lib/terminology/medications";
import type { Medication } from "@/lib/types";

const UNITS = ["mg", "mcg", "g", "units", "mL", "puffs", "drops", "tablet(s)"];
const FREQUENCIES = ["once daily", "twice daily", "three times daily", "at bedtime", "every morning", "as needed", "once weekly"];

export default function MedicationPage() {
  return (
    <Suspense fallback={<FormPage title="Medication"><p className="text-sm text-ink-muted">Loading…</p></FormPage>}>
      <MedicationEditor />
    </Suspense>
  );
}

function MedicationEditor() {
  const id = useSearchParams().get("id");
  const { record, local, passportStatus } = usePatient();
  const all = [...record.patient.medications, ...record.pastMedications];
  const pending = local?.entries.find((e) => e.collection === "medications" && e.item.id === id && e.status === "pending")?.item as Medication | undefined;
  const existing = id ? all.find((m) => m.id === id) ?? pending : undefined;

  if (id && !existing) {
    return (
      <FormPage title="Edit a medication">
        <p className="text-sm text-ink-muted">{passportStatus === "ready" ? "That medication isn't in your Passport." : "Loading your Passport…"}</p>
      </FormPage>
    );
  }
  return <MedicationForm key={existing?.id ?? "new"} existing={existing} isPending={!!pending && existing === pending} />;
}

function splitDose(dose: string): { dose: string; unit: string } {
  const m = dose.match(/^\s*([\d.,]+)\s*(.*)$/);
  return m ? { dose: m[1], unit: m[2] || "mg" } : { dose: "", unit: "mg" };
}

function MedicationForm({ existing, isPending }: { existing?: Medication; isPending: boolean }) {
  const { patientId, record } = usePatient();
  const [input, setInput] = useState<MedicationInput>(() => ({
    name: existing?.name ?? "",
    ...splitDose(existing?.dose ?? ""),
    frequency: existing?.frequency ?? "",
    startDate: existing?.startDate ?? REFERENCE_DATE,
    indication: existing?.indication ?? "",
    prescriber: existing?.prescriber ?? "",
    status: existing?.status === "stopped" ? "stopped" : "active",
    stoppedOn: existing?.stoppedOn ?? "",
  }));
  const [errs, setErrs] = useState<ReturnType<typeof validateMedication>>({});
  const [saved, setSaved] = useState<Medication | null>(null);
  const { busy, error, save } = useSave();
  const set = <K extends keyof MedicationInput>(k: K) => (v: MedicationInput[K]) => setInput((x) => ({ ...x, [k]: v }));
  const recognised = input.name ? lookupDrug(input.name) : undefined;

  async function submit() {
    const e = validateMedication(input);
    setErrs(e);
    if (Object.keys(e).length) return;
    const med = buildMedication(input, existing);
    const event = medicationChangeEvent(patientId, isPending ? undefined : existing, med, REFERENCE_DATE);
    const ok = await save(async () => {
      if (existing) await editEntry(patientId, "medications", med, isPending ? `Corrected and confirmed medication: ${med.name} ${med.dose}` : `Edited medication: ${med.name} ${med.dose}`);
      else await addEntries(patientId, "medications", [med], `Added medication: ${med.name} ${med.dose}`);
      if (event) await addEntries(patientId, "medicationHistory", [{ ...event, source: youSource() }], `Medication change: ${event.detail}`);
    });
    if (ok) setSaved(med);
  }

  if (saved) {
    return (
      <FormPage title={existing ? "Edit a medication" : "Add a medication"}>
        <SavedPanel title={`${saved.name} saved`} links={[{ href: "/medications/", label: "Check medication safety" }, { href: "/passport/medications/", label: "My medications" }]}>
          {saved.class === "other" && !lookupDrug(saved.name) && <p>We didn&apos;t recognise this name, so the safety check can&apos;t look for interactions with it yet. Your clinician or pharmacist can.</p>}
          <p className="mt-1">The safety check has re-run with your updated list.</p>
        </SavedPanel>
      </FormPage>
    );
  }

  return (
    <FormPage title={existing ? (isPending ? "Correct an imported medication" : "Edit a medication") : "Add a medication"} subtitle="Include over-the-counter medicines and supplements — they can interact too.">
      {!existing && record.patient.medications.length > 0 && (
        <details className="mb-5 rounded-xl border border-line bg-surface p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">Or edit one of your current medicines</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {record.patient.medications.map((m) => (
              <li key={m.id}><Link href={`/log/medication/?id=${encodeURIComponent(m.id)}`} className="inline-flex min-h-11 items-center text-brand-800 hover:underline">{m.name} {m.dose}</Link></li>
            ))}
          </ul>
        </details>
      )}
      <Form label="Medication" onSubmit={submit}>
        <datalist id="drug-names">
          {DRUGS.flatMap((d) => [d.display, ...d.brands]).map((n) => <option key={n} value={n} />)}
        </datalist>
        <TextField label="Medicine name" value={input.name} onChange={set("name")} error={errs.name} list="drug-names" placeholder="e.g. Lisinopril or Zestril"
          hint={recognised ? `Recognised: ${recognised.display} (${recognised.class.replace(/-/g, " ")})` : undefined} />
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <TextField label="Dose" type="number" inputMode="decimal" value={input.dose} onChange={set("dose")} error={errs.dose} placeholder="20" />
          <SelectField label="Unit" value={input.unit} onChange={set("unit")} options={UNITS.map((u) => ({ value: u, label: u }))} />
        </div>
        <datalist id="freqs">{FREQUENCIES.map((f) => <option key={f} value={f} />)}</datalist>
        <TextField label="How often" value={input.frequency} onChange={set("frequency")} error={errs.frequency} list="freqs" placeholder="e.g. once daily" />
        <TextField label="Started" type="date" value={input.startDate} onChange={set("startDate")} error={errs.startDate} />
        <TextField label="What it's for" value={input.indication} onChange={set("indication")} optional placeholder="e.g. Blood pressure" />
        <TextField label="Prescribed by" value={input.prescriber} onChange={set("prescriber")} optional placeholder="e.g. Dr. Nwosu, or 'over the counter'" />
        {existing && !isPending && (
          <ChoiceGroup legend="Still taking it?" columns={2} value={input.status} onChange={set("status")}
            options={[{ value: "active", label: "Yes, still taking it" }, { value: "stopped", label: "No, I stopped" }]} />
        )}
        {input.status === "stopped" && <TextField label="Stopped on" type="date" value={input.stoppedOn} onChange={set("stoppedOn")} error={errs.stoppedOn} />}
        <p className="text-xs text-ink-muted">Recording a change here doesn&apos;t change your prescription. Talk to your doctor or pharmacist before starting, stopping or changing a medicine.</p>
        <SubmitBar label={existing ? (isPending ? "Save and confirm" : "Save changes") : "Add medication"} busy={busy} error={error} />
      </Form>
    </FormPage>
  );
}
