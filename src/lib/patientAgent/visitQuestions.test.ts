import { describe, expect, it } from "vitest";
import { buildMedication } from "../log/entries";
import { getSeedRecord, referenceNow } from "../mockData";
import { emptyPassport, type LocalPassport } from "../passport/collections";
import { mergeRecord } from "../passport/merge";
import { upsertItems } from "../passport/ops";
import { findIssues } from "../reconcile";
import type { PatientRecord } from "../types";
import { validateNeutral } from "./neutral";
import { evaluatePassportChange } from "./safetyWatch";
import { buildVisitQuestions, MAX_VISIT_QUESTIONS, MIN_VISIT_QUESTIONS, VISIT_QUESTION_FALLBACK } from "./visitQuestions";

const now = referenceNow();
const AT = "2026-09-11T09:00:00";

const harold = () => getSeedRecord("p-harold")!;

/** Advil 200 mg as needed, exactly as the medication form builds it. */
function advil() {
  return buildMedication(
    {
      name: "Advil",
      dose: "200",
      unit: "mg",
      frequency: "as needed",
      startDate: "2026-09-11",
      indication: "Knee pain",
      prescriber: "over the counter",
      status: "active",
      stoppedOn: "",
    },
    undefined,
    new Date(AT),
  );
}

function withAdvil(): { record: PatientRecord; local: LocalPassport } {
  const local = upsertItems(emptyPassport("p-harold"), "medications", [advil()], "confirmed", AT);
  return { record: mergeRecord(harold(), local), local };
}

function haroldQuestions() {
  const { record, local } = withAdvil();
  const update = evaluatePassportChange({ record, baselineRecord: harold(), now, local });
  return buildVisitQuestions(update, findIssues(record, local), record);
}

describe("buildVisitQuestions", () => {
  it("writes 3 to 5 questions for Harold once a patient-entered Advil is added", () => {
    const questions = haroldQuestions();
    expect(questions.length).toBeGreaterThanOrEqual(MIN_VISIT_QUESTIONS);
    expect(questions.length).toBeLessThanOrEqual(MAX_VISIT_QUESTIONS);
    // The finding that is new since his last visit comes first.
    expect(questions[0].kind).toBe("new-finding");
    expect(questions[0].id).toBe("allergy/medication-conflict/al-h1");
    expect(questions[0].text).toContain("Advil");
  });

  it("gives every question a question mark and at least one citation", () => {
    for (const q of haroldQuestions()) {
      expect(q.text.endsWith("?"), q.text).toBe(true);
      expect(q.citations.length).toBeGreaterThan(0);
    }
  });

  it("keeps every authored line neutral and quotes the rule text verbatim", () => {
    const questions = haroldQuestions();
    for (const q of questions) {
      for (const segment of q.segments) {
        if (segment.kind === "authored") expect(validateNeutral(segment.text), segment.text).toBeNull();
      }
    }
    // The verbatim rule next step is carried as a quoted segment, unaltered.
    const first = questions[0];
    expect(first.segments.some((s) => s.kind === "quoted" && s.text.startsWith("Before your next dose, ask"))).toBe(true);
  });

  it("never repeats the same question", () => {
    const texts = haroldQuestions().map((q) => q.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("returns the single neutral fallback when nothing is open", () => {
    const record = harold();
    const empty = { findings: [], newFindings: [], updatedFindings: [], patientReportedOnly: [], newCount: 0 };
    const questions = buildVisitQuestions(empty, [], record);
    expect(questions).toHaveLength(1);
    expect(questions[0].text).toBe(VISIT_QUESTION_FALLBACK);
    expect(validateNeutral(questions[0].text)).toBeNull();
    expect(questions[0].text.endsWith("?")).toBe(true);
  });
});
