"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChoiceGroup, Form, FormPage, SavedPanel, SubmitBar, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { addEntries, editEntry } from "@/lib/passport/actions";
import { allergyMatches, buildAllergy, validateAllergy, type AllergyInput } from "@/lib/log/entries";
import { DRUGS } from "@/lib/terminology/medications";
import type { Allergy } from "@/lib/types";

export default function AllergyPage() {
  return (
    <Suspense fallback={<FormPage title="Allergy"><p className="text-sm text-ink-muted">Loading…</p></FormPage>}>
      <AllergyEditor />
    </Suspense>
  );
}

function AllergyEditor() {
  const id = useSearchParams().get("id");
  const { record, local, passportStatus } = usePatient();
  const pending = local?.entries.find((e) => e.collection === "allergies" && e.item.id === id && e.status === "pending")?.item as Allergy | undefined;
  const existing = id ? record.allergies.find((a) => a.id === id) ?? pending : undefined;
  if (id && !existing) {
    return <FormPage title="Edit an allergy"><p className="text-sm text-ink-muted">{passportStatus === "ready" ? "That allergy isn't in your Passport." : "Loading your Passport…"}</p></FormPage>;
  }
  return <AllergyForm key={existing?.id ?? "new"} existing={existing} />;
}

function AllergyForm({ existing }: { existing?: Allergy }) {
  const { patientId, record } = usePatient();
  const [input, setInput] = useState<AllergyInput>({
    substance: existing?.substance ?? "",
    category: existing?.category ?? "medication",
    reaction: existing?.reaction ?? "",
    severity: existing?.severity ?? "moderate",
    type: existing?.type ?? "allergy",
  });
  const [errs, setErrs] = useState<ReturnType<typeof validateAllergy>>({});
  const [saved, setSaved] = useState<Allergy | null>(null);
  const { busy, error, save } = useSave();
  const set = <K extends keyof AllergyInput>(k: K) => (v: AllergyInput[K]) => setInput((x) => ({ ...x, [k]: v }));
  const matches = input.category === "medication" && input.substance ? allergyMatches(input.substance) : undefined;
  const conflicts = matches ? record.patient.medications.filter((m) => matches.genericNames?.includes(m.genericName) || matches.classes?.includes(m.class)) : [];

  async function submit() {
    const e = validateAllergy(input);
    setErrs(e);
    if (Object.keys(e).length) return;
    const allergy = buildAllergy(input, patientId, existing);
    if (await save(() => (existing ? editEntry(patientId, "allergies", allergy, `Edited allergy: ${allergy.substance}`) : addEntries(patientId, "allergies", [allergy], `Added allergy: ${allergy.substance}`)))) setSaved(allergy);
  }

  if (saved) {
    return (
      <FormPage title="Allergy">
        <SavedPanel title={`${saved.substance} saved`} onAnother={() => { setSaved(null); setInput({ substance: "", category: "medication", reaction: "", severity: "moderate", type: "allergy" }); }} anotherLabel="Add another" links={[{ href: "/passport/", label: "My Passport" }, { href: "/passport/emergency/", label: "Emergency card" }]} />
      </FormPage>
    );
  }

  return (
    <FormPage title={existing ? "Edit an allergy" : "Add an allergy"} subtitle="Medicines, foods or anything else you react to.">
      <Form label="Allergy" onSubmit={submit}>
        <ChoiceGroup legend="Type of allergy" columns={2} value={input.category} onChange={set("category")}
          options={[{ value: "medication", label: "Medicine" }, { value: "food", label: "Food" }, { value: "environment", label: "Environment", hint: "Pollen, latex…" }, { value: "other", label: "Other" }]} />
        <datalist id="allergens">{DRUGS.map((d) => <option key={d.generic} value={d.display} />)}<option value="NSAIDs" /><option value="Sulfa antibiotics" /></datalist>
        <TextField label="What are you allergic to?" value={input.substance} onChange={set("substance")} error={errs.substance} list={input.category === "medication" ? "allergens" : undefined} placeholder={input.category === "medication" ? "e.g. Penicillin, NSAIDs" : "e.g. Peanuts"} />
        {conflicts.length > 0 && (
          <p role="alert" className="rounded-xl border border-attention/30 bg-attention-soft p-3 text-sm text-ink">
            <strong>Heads up:</strong> {conflicts.map((m) => m.name).join(", ")} on your current list may be covered by this allergy. The safety check will raise it as a question for your doctor or pharmacist.
          </p>
        )}
        <TextField label="What happens?" value={input.reaction} onChange={set("reaction")} optional placeholder="e.g. Hives, stomach bleeding" />
        <ChoiceGroup legend="How serious?" columns={3} value={input.severity} onChange={set("severity")}
          options={[{ value: "mild", label: "Mild" }, { value: "moderate", label: "Moderate" }, { value: "severe", label: "Severe" }]} />
        <ChoiceGroup legend="Is it an allergy or a side effect?" columns={2} value={input.type} onChange={set("type")}
          options={[{ value: "allergy", label: "Allergy", hint: "Rash, swelling, trouble breathing" }, { value: "intolerance", label: "Side effect / intolerance", hint: "e.g. nausea" }]} />
        <SubmitBar label="Save allergy" busy={busy} error={error} />
      </Form>
    </FormPage>
  );
}
