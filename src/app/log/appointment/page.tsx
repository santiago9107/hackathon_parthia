"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Form, FormPage, SavedPanel, SubmitBar, TextArea, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { REFERENCE_DATE } from "@/lib/mockData";
import { addEntries, editEntry } from "@/lib/passport/actions";
import { newId } from "@/lib/passport/ops";
import { youSource } from "@/lib/log/entries";
import type { Appointment } from "@/lib/types";

export default function AppointmentPage() {
  return (
    <Suspense fallback={<FormPage title="Appointment"><p className="text-sm text-ink-muted">Loading…</p></FormPage>}>
      <AppointmentEditor />
    </Suspense>
  );
}

function AppointmentEditor() {
  const id = useSearchParams().get("id");
  const { record, local, passportStatus } = usePatient();
  const pending = local?.entries.find((e) => e.collection === "appointments" && e.item.id === id && e.status === "pending")?.item as Appointment | undefined;
  const existing = id ? record.appointments.find((a) => a.id === id) ?? pending : undefined;
  if (id && !existing) {
    return <FormPage title="Edit an appointment"><p className="text-sm text-ink-muted">{passportStatus === "ready" ? "That appointment isn't in your Passport." : "Loading your Passport…"}</p></FormPage>;
  }
  return <AppointmentForm key={existing?.id ?? "new"} existing={existing} />;
}

function AppointmentForm({ existing }: { existing?: Appointment }) {
  const { patientId, record, now } = usePatient();
  const [date, setDate] = useState(existing?.start.slice(0, 10) ?? REFERENCE_DATE);
  const [time, setTime] = useState(existing?.start.slice(11, 16) ?? "09:00");
  const [clinician, setClinician] = useState(existing?.clinician ?? "");
  const [specialty, setSpecialty] = useState(existing?.specialty ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [notes, setNotes] = useState(existing?.patientNotes ?? "");
  const [errs, setErrs] = useState<{ date?: string; clinician?: string; reason?: string }>({});
  const [saved, setSaved] = useState(false);
  const { busy, error, save } = useSave();

  async function submit() {
    const e = { date: date ? undefined : "When is it?", clinician: clinician.trim() ? undefined : "Who is it with?", reason: reason.trim() ? undefined : "What is it for? A few words is fine." };
    setErrs(e);
    if (e.date || e.clinician || e.reason) return;
    const start = `${date}T${time || "09:00"}:00`;
    const appt: Appointment = {
      ...(existing ?? {}),
      id: existing?.id ?? newId("ap-you"), patientId, start,
      status: start >= now.toISOString().slice(0, 19) ? "booked" : "fulfilled",
      clinician: clinician.trim(), specialty: specialty.trim() || "General", location: location.trim() || undefined,
      reason: reason.trim(), patientNotes: notes.trim() || undefined, source: youSource(),
    };
    if (await save(() => (existing ? editEntry(patientId, "appointments", appt, `Edited appointment with ${appt.clinician}`) : addEntries(patientId, "appointments", [appt], `Added appointment with ${appt.clinician}`)))) setSaved(true);
  }

  if (saved) {
    return (
      <FormPage title="Appointment">
        <SavedPanel title="Appointment saved" links={[{ href: "/passport/appointments/", label: "My appointments" }, { href: "/passport/share/", label: "Prepare what to share" }]} />
      </FormPage>
    );
  }

  return (
    <FormPage title={existing ? "Edit an appointment" : "Add an appointment"} subtitle="Keep upcoming and past visits together, with what you want to bring up.">
      <Form label="Appointment" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={date} onChange={setDate} error={errs.date} />
          <TextField label="Time" type="time" value={time} onChange={setTime} />
        </div>
        <datalist id="team">{record.careTeam.map((m) => <option key={m.id} value={m.name} />)}</datalist>
        <TextField label="With" value={clinician} onChange={(v) => { setClinician(v); const m = record.careTeam.find((c) => c.name === v); if (m?.specialty && !specialty) setSpecialty(m.specialty); }} error={errs.clinician} list="team" placeholder="e.g. Dr. Nwosu" />
        <TextField label="Specialty" value={specialty} onChange={setSpecialty} optional placeholder="e.g. Cardiology" />
        <TextField label="Where" value={location} onChange={setLocation} optional placeholder="Clinic or address" />
        <TextField label="Reason" value={reason} onChange={setReason} error={errs.reason} placeholder="e.g. INR check, follow-up" />
        <TextArea label="What I want to bring up" value={notes} onChange={setNotes} placeholder="Questions, symptoms, refills…" />
        <SubmitBar label="Save appointment" busy={busy} error={error} />
      </Form>
    </FormPage>
  );
}
