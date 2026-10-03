"use client";

import { useState } from "react";
import { ChoiceGroup, Form, FormPage, SavedPanel, SubmitBar, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { demoTimestamp } from "@/lib/mockData";
import { addEntries } from "@/lib/passport/actions";
import { newId } from "@/lib/passport/ops";
import { parseNumber, toKg, validateVitals, youSource, type VitalsInput } from "@/lib/log/entries";
import type { MeasurementSetting, VitalSign } from "@/lib/types";

export default function VitalsPage() {
  const { patientId } = usePatient();
  const [v, setV] = useState<VitalsInput>({ systolic: "", diastolic: "", heartRate: "", weight: "", weightUnit: "lb" });
  const [where, setWhere] = useState<MeasurementSetting>("home-cuff");
  const [errs, setErrs] = useState<ReturnType<typeof validateVitals>>({});
  const [saved, setSaved] = useState<VitalSign | null>(null);
  const { busy, error, save } = useSave();
  const set = (k: keyof VitalsInput) => (val: string) => setV((x) => ({ ...x, [k]: val }));

  async function submit() {
    const e = validateVitals(v);
    setErrs(e);
    if (Object.keys(e).length) return;
    const sys = parseNumber(v.systolic);
    const wt = parseNumber(v.weight);
    const reading: VitalSign = {
      id: newId("v-you"), patientId, timestamp: demoTimestamp(),
      systolic: sys, diastolic: parseNumber(v.diastolic), heartRate: parseNumber(v.heartRate),
      weightKg: wt !== undefined ? toKg(wt, v.weightUnit) : undefined,
      bpSetting: sys !== undefined ? where : undefined, source: youSource(),
    };
    const summary = [sys && `BP ${reading.systolic}/${reading.diastolic}`, reading.heartRate && `HR ${reading.heartRate}`, reading.weightKg && `${reading.weightKg} kg`].filter(Boolean).join(", ");
    if (await save(() => addEntries(patientId, "vitals", [reading], `Reading: ${summary}`))) setSaved(reading);
  }

  const unitToggle = (
    <div role="group" aria-label="Weight unit" className="inline-flex shrink-0 rounded-xl bg-cream-dark p-1">
      {(["lb", "kg"] as const).map((u) => (
        <button key={u} type="button" aria-pressed={v.weightUnit === u} onClick={() => setV((x) => ({ ...x, weightUnit: u }))} className={`min-h-10 min-w-11 rounded-lg px-3 text-sm font-semibold ${v.weightUnit === u ? "bg-surface text-brand-800 shadow-card" : "text-ink-soft"}`}>{u}</button>
      ))}
    </div>
  );

  return (
    <FormPage title="Log a reading" subtitle="Blood pressure, heart rate and weight. Fill in whatever you measured.">
      {saved ? (
        <SavedPanel title="Reading saved" onAnother={() => { setSaved(null); setV((x) => ({ ...x, systolic: "", diastolic: "", heartRate: "", weight: "" })); }} links={[{ href: "/passport/clinical/", label: "See vitals" }, { href: "/", label: "Home" }]}>
          {saved.systolic && saved.systolic >= 180 && <p className="font-semibold text-attention">A top number of 180 or higher is very high. If you also have chest pain, shortness of breath, weakness, or trouble speaking, call 911. Otherwise, re-check after resting 5 minutes and contact your care team.</p>}
          {saved.systolic && saved.systolic < 90 && <p>That&apos;s a low reading. If you feel faint or dizzy, sit or lie down, and let your care team know.</p>}
        </SavedPanel>
      ) : (
        <Form label="Log a reading" onSubmit={submit}>
          {errs.form && <p role="alert" className="text-sm font-medium text-attention">{errs.form}</p>}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Top number" hint="Systolic" type="number" inputMode="numeric" value={v.systolic} onChange={set("systolic")} error={errs.systolic} placeholder="120" />
            <TextField label="Bottom number" hint="Diastolic" type="number" inputMode="numeric" value={v.diastolic} onChange={set("diastolic")} error={errs.diastolic} placeholder="80" />
          </div>
          <ChoiceGroup legend="Where did you measure it?" columns={3} value={where} onChange={setWhere}
            options={[{ value: "home-cuff", label: "Home cuff" }, { value: "clinic", label: "Clinic" }, { value: "manual", label: "Other" }]} />
          <TextField label="Heart rate" hint="Beats per minute" type="number" inputMode="numeric" value={v.heartRate} onChange={set("heartRate")} error={errs.heartRate} optional placeholder="70" />
          <TextField label="Weight" type="number" inputMode="decimal" value={v.weight} onChange={set("weight")} error={errs.weight} optional suffix={unitToggle} />
          <SubmitBar label="Save reading" busy={busy} error={error} />
        </Form>
      )}
    </FormPage>
  );
}
