"use client";

import { useState } from "react";
import { Form, FormPage, ListEditor, SavedPanel, SelectField, SubmitBar, TextArea, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { editEntry } from "@/lib/passport/actions";
import { looksLikePhone, youSource } from "@/lib/log/entries";
import type { EmergencyContact, EmergencyInfo } from "@/lib/types";
import { AppIcon } from "@/components/AppIcon";

const BLOOD_TYPES = ["", "A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];

export default function EmergencyInfoPage() {
  const { passportStatus, record } = usePatient();
  if (passportStatus !== "ready") return <FormPage title="Emergency info" showDemoDate={false}><p className="text-sm text-ink-muted">Loading your Passport…</p></FormPage>;
  return <EmergencyForm key={record.patient.id} existing={record.emergency} />;
}

function EmergencyForm({ existing }: { existing?: EmergencyInfo }) {
  const { patientId, record } = usePatient();
  const [bloodType, setBloodType] = useState(existing?.bloodType ?? "");
  const [contacts, setContacts] = useState<EmergencyContact[]>(existing?.contacts.length ? existing.contacts : [{ name: "", relationship: "", phone: "" }]);
  const [allergies, setAllergies] = useState(existing?.criticalAllergies ?? record.allergies.filter((a) => a.severity === "severe").map((a) => a.substance));
  const [conditions, setConditions] = useState(existing?.criticalConditions ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [contactErr, setContactErr] = useState<string>();
  const [saved, setSaved] = useState(false);
  const { busy, error, save } = useSave();

  const setContact = (i: number, k: keyof EmergencyContact, v: string) => setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  async function submit() {
    const filled = contacts.filter((c) => c.name.trim() || c.phone.trim());
    if (filled.some((c) => !c.name.trim() || !looksLikePhone(c.phone))) return setContactErr("Each contact needs a name and a phone number.");
    setContactErr(undefined);
    const info: EmergencyInfo = {
      id: existing?.id ?? `em-${patientId}`, patientId, bloodType: bloodType || undefined,
      contacts: filled.map((c) => ({ name: c.name.trim(), relationship: c.relationship.trim() || "Contact", phone: c.phone.trim() })),
      criticalAllergies: allergies, criticalConditions: conditions, notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(), source: youSource(),
    };
    if (await save(() => editEntry(patientId, "emergency", info, "Updated emergency info"))) setSaved(true);
  }

  if (saved) return <FormPage title="Emergency info" showDemoDate={false}><SavedPanel title="Emergency info saved" links={[{ href: "/passport/emergency/", label: "View emergency card" }]} /></FormPage>;

  return (
    <FormPage title="Emergency info" subtitle="What first responders and clinicians need to know if you can't tell them. It appears on your emergency card." showDemoDate={false}>
      <Form label="Emergency info" onSubmit={submit}>
        <SelectField label="Blood type" optional value={bloodType} onChange={setBloodType} options={BLOOD_TYPES.map((b) => ({ value: b, label: b || "Don't know" }))} />
        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-semibold text-ink">Emergency contacts</legend>
          {contacts.map((c, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-3">
              <TextField label="Name" value={c.name} onChange={(v) => setContact(i, "name", v)} autoComplete="off" />
              <TextField label="Relationship" value={c.relationship} onChange={(v) => setContact(i, "relationship", v)} placeholder="e.g. Daughter" />
              <TextField label="Phone" type="tel" inputMode="tel" value={c.phone} onChange={(v) => setContact(i, "phone", v)} />
              {contacts.length > 1 && (
                <button type="button" onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))} className="min-h-11 justify-self-start text-sm font-semibold text-attention sm:col-span-3">Remove contact</button>
              )}
            </div>
          ))}
          {contactErr && <p role="alert" className="text-sm font-medium text-attention">{contactErr}</p>}
          <button type="button" onClick={() => setContacts((cs) => [...cs, { name: "", relationship: "", phone: "" }])} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"><AppIcon name="plus" className="h-4 w-4" />Add another contact</button>
        </fieldset>
        <ListEditor label="Critical allergies" items={allergies} onChange={setAllergies} placeholder="e.g. Penicillin — hives" />
        <ListEditor label="Critical conditions" items={conditions} onChange={setConditions} placeholder="e.g. Takes a blood thinner" hint={`From your Passport: ${record.patient.conditions.map((c) => c.name).join(", ")}`} />
        <TextArea label="Anything else responders should know" value={notes} onChange={setNotes} placeholder="e.g. Pacemaker, advance directive on file with Dr. Nwosu" />
        <SubmitBar label="Save emergency info" busy={busy} error={error} />
      </Form>
    </FormPage>
  );
}
