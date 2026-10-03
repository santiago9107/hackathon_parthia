import type { PatientRecord } from "../types";

/**
 * "What's missing from my Passport" — practical gaps a patient can fill,
 * each with a link to where they'd fix it. Not a score.
 */
export interface Gap {
  id: string;
  title: string;
  why: string;
  href: string;
  action: string;
}

const DAY = 86_400_000;

export function passportGaps(record: PatientRecord, now: Date): Gap[] {
  const gaps: Gap[] = [];
  const e = record.emergency;
  const daysAgo = (iso: string) => (now.getTime() - new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).getTime()) / DAY;

  if (!e || e.contacts.length === 0) {
    gaps.push({ id: "emergency-contact", title: "No emergency contact", why: "First responders and clinicians need someone to call.", href: "/log/emergency/", action: "Add a contact" });
  }
  if (!e?.bloodType) {
    gaps.push({ id: "blood-type", title: "Blood type not recorded", why: "Useful on your emergency card.", href: "/log/emergency/", action: "Add blood type" });
  }
  if (record.allergies.length === 0) {
    gaps.push({ id: "allergies", title: "No allergies recorded", why: "If you have none, saying so is still useful to clinicians.", href: "/log/allergy/", action: "Add allergies" });
  }
  if (!record.careTeam.some((m) => m.role === "primary-care" || m.isPrimary)) {
    gaps.push({ id: "primary-care", title: "No primary clinician", why: "Your Passport summary is addressed to them.", href: "/passport/sources/", action: "Import your care team" });
  }
  if (!record.nutritionProfile) {
    gaps.push({ id: "nutrition-profile", title: "No nutrition profile", why: "Diet affects how some medicines work.", href: "/log/nutrition-profile/", action: "Describe how you eat" });
  }
  const lastBp = record.patient.vitals.filter((v) => v.systolic).map((v) => v.timestamp).sort().pop();
  if (!lastBp || daysAgo(lastBp) > 30) {
    gaps.push({ id: "bp", title: "No blood pressure in the last 30 days", why: "Several of your medicines affect blood pressure.", href: "/log/vitals/", action: "Log a reading" });
  }
  const lastPhq = record.assessments.filter((a) => a.instrument === "PHQ-9").map((a) => a.date).sort().pop();
  if (!lastPhq || daysAgo(lastPhq) > 90) {
    gaps.push({ id: "phq9", title: "No mood screening in the last 3 months", why: "Mood and medicines affect each other.", href: "/log/phq-9/", action: "Take the PHQ-9" });
  }
  const lastFlu = record.immunizations.filter((i) => /influenza|flu/i.test(i.vaccine)).map((i) => i.date).sort().pop();
  if (!lastFlu || daysAgo(lastFlu) > 365) {
    gaps.push({ id: "flu", title: "No flu shot recorded in the last year", why: "Worth checking with your pharmacist.", href: "/passport/clinical/", action: "Review immunizations" });
  }
  const upcoming = record.appointments.some((a) => a.status === "booked" && new Date(a.start).getTime() >= now.getTime() - DAY);
  if (!upcoming) {
    gaps.push({ id: "appointment", title: "No upcoming appointment", why: "Good to have a date to bring your questions to.", href: "/log/appointment/", action: "Add an appointment" });
  }
  const docsFromOthers = record.documents.length > 0;
  if (!docsFromOthers) {
    gaps.push({ id: "documents", title: "No documents yet", why: "Visit summaries and prescriptions help complete the picture.", href: "/passport/add/scan/", action: "Scan a document" });
  }
  return gaps;
}

/** Most recent change anywhere in the Passport (for "last updated"). */
export function lastUpdated(record: PatientRecord): string {
  const stamps = [
    ...record.patient.vitals.map((v) => v.timestamp),
    ...record.patient.labs.map((l) => l.date),
    ...record.moods.map((m) => m.timestamp),
    ...record.nutrition.map((n) => n.timestamp),
    ...record.symptoms.map((s) => s.timestamp),
    ...record.encounters.map((e) => e.date),
    ...record.assessments.map((a) => a.date),
    ...record.documents.map((d) => d.date),
    ...[record.emergency?.updatedAt, record.nutritionProfile?.updatedAt].filter(Boolean) as string[],
  ];
  return stamps.sort().pop() ?? "";
}
