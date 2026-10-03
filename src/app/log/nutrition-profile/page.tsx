"use client";

import { useState } from "react";
import { Form, FormPage, ListEditor, SavedPanel, SubmitBar, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { editEntry } from "@/lib/passport/actions";
import { youSource } from "@/lib/log/entries";
import type { NutritionProfile } from "@/lib/types";

export default function NutritionProfilePage() {
  const { passportStatus, record } = usePatient();
  if (passportStatus !== "ready") return <FormPage title="Nutrition profile" showDemoDate={false}><p className="text-sm text-ink-muted">Loading your Passport…</p></FormPage>;
  return <ProfileForm key={record.patient.id} existing={record.nutritionProfile} />;
}

function ProfileForm({ existing }: { existing?: NutritionProfile }) {
  const { patientId } = usePatient();
  const [pattern, setPattern] = useState(existing?.dietaryPattern ?? "");
  const [restrictions, setRestrictions] = useState(existing?.restrictions ?? []);
  const [intolerances, setIntolerances] = useState(existing?.intolerances ?? []);
  const [goals, setGoals] = useState(existing?.goals ?? []);
  const [err, setErr] = useState<string>();
  const [saved, setSaved] = useState(false);
  const { busy, error, save } = useSave();

  async function submit() {
    if (!pattern.trim()) return setErr("Describe how you usually eat, in a few words.");
    const profile: NutritionProfile = {
      id: existing?.id ?? `np-${patientId}`, patientId, dietaryPattern: pattern.trim(), restrictions, intolerances, goals,
      dietitianNotes: existing?.dietitianNotes ?? [], updatedAt: new Date().toISOString(), source: youSource(),
    };
    if (await save(() => editEntry(patientId, "nutritionProfile", profile, "Updated nutrition profile"))) setSaved(true);
  }

  if (saved) return <FormPage title="Nutrition profile" showDemoDate={false}><SavedPanel title="Nutrition profile saved" links={[{ href: "/passport/nutrition/", label: "See nutrition" }]} /></FormPage>;

  return (
    <FormPage title="Nutrition profile" subtitle="How you eat, what you limit, and what you're working on. Dietitian notes are kept as they are." showDemoDate={false}>
      <Form label="Nutrition profile" onSubmit={submit}>
        <TextField label="How do you usually eat?" value={pattern} onChange={(v) => { setPattern(v); setErr(undefined); }} error={err} placeholder="e.g. Home cooking, lots of rice and beans" />
        <ListEditor label="Things you limit or avoid" items={restrictions} onChange={setRestrictions} placeholder="e.g. Low salt" hint="Including anything your care team asked you to limit." />
        <ListEditor label="Food allergies and intolerances" items={intolerances} onChange={setIntolerances} placeholder="e.g. Lactose" />
        <ListEditor label="Goals" items={goals} onChange={setGoals} placeholder="e.g. More vegetables at dinner" />
        <SubmitBar label="Save profile" busy={busy} error={error} />
      </Form>
    </FormPage>
  );
}
