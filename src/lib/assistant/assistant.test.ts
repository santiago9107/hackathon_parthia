import { describe, expect, it } from "vitest";
import { getSeedRecord, referenceNow } from "../mockData";
import { evaluatePatient } from "../safetyEngine";
import type { ReconIssue } from "../reconcile";
import { scriptedProvider } from ".";

const now = referenceNow();
const ask = (patientId: string, q: string, issues: ReconIssue[] = []) => {
  const record = getSeedRecord(patientId)!;
  return scriptedProvider.respond(q, { record, flags: evaluatePatient(record, { now }), now, issues });
};

describe("assistant answers from the full Passport", () => {
  it("allergies", async () => {
    const r = await ask("p-harold", "Am I allergic to anything?");
    expect(r.text).toMatch(/Ibuprofen/);
    expect(r.sources).toEqual(["Allergies"]);
  });

  it("screenings are labelled as screenings, not diagnoses", async () => {
    const r = await ask("p-margaret", "What was my PHQ-9 score?");
    expect(r.text).toMatch(/PHQ-9: 16/);
    expect(r.text).toMatch(/screenings, not diagnoses/);
  });

  it("appointments, care team and lab trends", async () => {
    expect((await ask("p-margaret", "When is my next appointment?")).sources).toEqual(["Appointments"]);
    expect((await ask("p-margaret", "Who is on my care team?")).sources).toEqual(["Care team"]);
    const egfr = await ask("p-margaret", "How is my eGFR trending?");
    expect(egfr.text.split("\n").length).toBeGreaterThan(2);
  });

  it("record differences, and they become visit questions", async () => {
    const issue = { id: "x", kind: "missing-from-source", title: "Aspirin isn't on Epic", explanation: "e", question: "Can you add Aspirin?", options: [], medications: [], allergies: [] } as unknown as ReconIssue;
    expect((await ask("p-harold", "Do my records disagree?", [issue])).text).toMatch(/1 difference/);
    expect((await ask("p-harold", "What should I ask my doctor?", [issue])).text).toMatch(/Can you add Aspirin\?/);
  });

  it("emergencies still short-circuit", async () => {
    expect((await ask("p-rosa", "I have chest pain")).urgent).toBe(true);
  });
});
