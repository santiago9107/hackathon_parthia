"use client";

import { useState } from "react";
import { ChoiceGroup, Form, FormPage, SavedPanel, SubmitBar, TextArea, TextField, useSave } from "@/components/log/FormKit";
import { SafetyUpdateNotice } from "@/components/patient/SafetyUpdateNotice";
import { usePatient } from "@/lib/context/PatientContext";
import { demoTimestamp } from "@/lib/mockData";
import { addEntries } from "@/lib/passport/actions";
import { newId } from "@/lib/passport/ops";
import { youSource } from "@/lib/log/entries";
import type { Scale1to5, SymptomEntry } from "@/lib/types";

/** Common symptoms; the wording matches what the safety rules look for. */
const COMMON = ["Dizziness on standing", "Bruising easily", "Nosebleed", "Dry mouth", "Forgetful / foggy", "Fatigue", "Nausea / stomach upset", "Headache", "Swollen ankles", "Shortness of breath", "Drowsy during the day", "Fall"];

const SEVERITY: { value: Scale1to5; label: string; hint: string }[] = [
  { value: 1, label: "1", hint: "Barely" },
  { value: 2, label: "2", hint: "Mild" },
  { value: 3, label: "3", hint: "Moderate" },
  { value: 4, label: "4", hint: "Strong" },
  { value: 5, label: "5", hint: "Severe" },
];

export default function SymptomPage() {
  const { patientId, flags } = usePatient();
  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState<Scale1to5 | null>(null);
  const [note, setNote] = useState("");
  const [errs, setErrs] = useState<{ symptom?: string; severity?: string }>({});
  const [saved, setSaved] = useState<{ text: string; beforeRuleIds: string[]; beforeFlagIds: string[] } | null>(null);
  const { busy, error, save } = useSave();

  async function submit() {
    const e = { symptom: symptom.trim() ? undefined : "What did you notice?", severity: severity ? undefined : "How strong was it?" };
    setErrs(e);
    if (e.symptom || e.severity) return;
    const entry: SymptomEntry = { id: newId("sy-you"), patientId, timestamp: demoTimestamp(), symptom: symptom.trim(), severity: severity!, note: note.trim() || undefined, source: youSource() };
    // The flags already firing before this save, captured in the user event.
    const beforeRuleIds = flags.map((f) => f.ruleId);
    const beforeFlagIds = flags.map((f) => f.id);
    const text = [entry.symptom, entry.note].filter(Boolean).join(". ");
    if (await save(() => addEntries(patientId, "symptoms", [entry], `Symptom: ${entry.symptom} (${entry.severity}/5)`))) setSaved({ text, beforeRuleIds, beforeFlagIds });
  }

  return (
    <FormPage title="Log a symptom" subtitle="Anything you noticed — the safety check looks for symptoms that can be linked to medicines.">
      {saved ? (
        <SavedPanel title="Symptom saved" onAnother={() => { setSaved(null); setSymptom(""); setSeverity(null); setNote(""); }} links={[{ href: "/medications/", label: "See medication safety" }, { href: "/", label: "Home" }]}>
          <SafetyUpdateNotice beforeRuleIds={saved.beforeRuleIds} beforeFlagIds={saved.beforeFlagIds} savedText={saved.text} />
          <p className="mt-3">If a symptom is severe or sudden — chest pain, trouble breathing, signs of a stroke — call 911.</p>
        </SavedPanel>
      ) : (
        <Form label="Log a symptom" onSubmit={submit}>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">Common symptoms</p>
            <div className="flex flex-wrap gap-2">
              {COMMON.map((s) => (
                <button key={s} type="button" aria-pressed={symptom === s} onClick={() => { setSymptom(s); setErrs((x) => ({ ...x, symptom: undefined })); }}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium ring-1 ${symptom === s ? "bg-brand-700 text-white ring-brand-700" : "bg-surface text-ink-soft ring-line-strong hover:bg-brand-50"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <TextField label="Symptom" value={symptom} onChange={setSymptom} error={errs.symptom} placeholder="Or describe it in your own words" />
          <ChoiceGroup legend="How strong?" columns={5} value={severity} onChange={(v) => { setSeverity(v); setErrs((x) => ({ ...x, severity: undefined })); }} error={errs.severity} options={SEVERITY} />
          <TextArea label="Notes" value={note} onChange={setNote} placeholder="When it happened, what you were doing…" />
          <SubmitBar label="Save symptom" busy={busy} error={error} />
        </Form>
      )}
    </FormPage>
  );
}
