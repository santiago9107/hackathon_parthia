"use client";

import { useState } from "react";
import { ChoiceGroup, Form, FormPage, SavedPanel, SubmitBar, TextArea, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { demoTimestamp } from "@/lib/mockData";
import { addEntries } from "@/lib/passport/actions";
import { newId } from "@/lib/passport/ops";
import { youSource } from "@/lib/log/entries";
import type { MoodCheckIn, Scale1to5 } from "@/lib/types";

const MOODS: { value: Scale1to5; label: string; icon: string }[] = [
  { value: 1, label: "Very low", icon: "😞" },
  { value: 2, label: "Low", icon: "🙁" },
  { value: 3, label: "Okay", icon: "😐" },
  { value: 4, label: "Good", icon: "🙂" },
  { value: 5, label: "Very good", icon: "😄" },
];

export default function MoodPage() {
  const { patientId } = usePatient();
  const [score, setScore] = useState<Scale1to5 | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string>();
  const [saved, setSaved] = useState(false);
  const { busy, error, save } = useSave();

  async function submit() {
    if (!score) return setErr("Choose how you're feeling.");
    const entry: MoodCheckIn = { id: newId("mo-you"), patientId, timestamp: demoTimestamp(), score, note: note.trim() || undefined, source: youSource() };
    if (await save(() => addEntries(patientId, "moods", [entry], `Mood check-in: ${score}/5`))) setSaved(true);
  }

  return (
    <FormPage title="Mood check-in" subtitle="A quick daily check-in helps you and your care team see how mood and medicines relate.">
      {saved ? (
        <SavedPanel title="Check-in saved" onAnother={() => { setSaved(false); setScore(null); setNote(""); }} anotherLabel="Check in again" links={[{ href: "/passport/mental-health/", label: "See mood trends" }, { href: "/", label: "Home" }]}>
          It&apos;s in your Passport and included in your mental-health indicator.
          {score !== null && score <= 2 && (
            <p className="mt-2">Having a hard time? Consider telling someone on your care team. If you ever have thoughts of harming yourself, call or text <a href="tel:988" className="font-semibold underline">988</a>.</p>
          )}
        </SavedPanel>
      ) : (
        <Form label="Mood check-in" onSubmit={submit}>
          <ChoiceGroup legend="How are you feeling today?" columns={5} value={score} onChange={(v) => { setScore(v); setErr(undefined); }} error={err}
            options={MOODS.map((m) => ({ value: m.value, label: m.label, icon: m.icon }))} />
          <TextArea label="Anything on your mind?" value={note} onChange={setNote} placeholder="e.g. Slept badly, worried about tomorrow's appointment" />
          <SubmitBar label="Save check-in" busy={busy} error={error} />
        </Form>
      )}
    </FormPage>
  );
}
