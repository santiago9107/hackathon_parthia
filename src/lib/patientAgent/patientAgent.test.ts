import { describe, expect, it } from "vitest";
import { checkTool } from "../clinician/policy";
import { buildMedication } from "../log/entries";
import { getSeedRecord, referenceNow } from "../mockData";
import { emptyPassport } from "../passport/collections";
import { mergeRecord } from "../passport/merge";
import { upsertItems } from "../passport/ops";
import { CONTACT_REFUSAL, answerPatient, directiveTool, type PatientAgentContext } from ".";
import { validateNeutral } from "./neutral";
import { resolvePageContext } from "./pageContext";
import { evaluatePassportChange } from "./safetyWatch";
import type { PatientReply } from "./types";

const now = referenceNow();
const AT = "2026-09-11T09:00:00";

function context(withAdvil = true): PatientAgentContext {
  const baselineRecord = getSeedRecord("p-harold")!;
  if (!withAdvil) {
    const update = evaluatePassportChange({ record: baselineRecord, baselineRecord, now });
    return { record: baselineRecord, update, page: resolvePageContext("/", update), now, issues: [] };
  }
  const advil = buildMedication(
    { name: "Advil", dose: "200", unit: "mg", frequency: "as needed", startDate: "2026-09-11", indication: "Knee pain", prescriber: "over the counter", status: "active", stoppedOn: "" },
    undefined,
    new Date(AT),
  );
  const local = upsertItems(emptyPassport("p-harold"), "medications", [advil], "confirmed", AT);
  const record = mergeRecord(baselineRecord, local);
  const update = evaluatePassportChange({ record, baselineRecord, now, local });
  return { record, update, page: resolvePageContext("/", update), now, issues: [] };
}

const ask = (question: string, ctx = context()) => answerPatient(question, ctx);
const authored = (reply: PatientReply) => reply.segments.filter((s) => s.kind === "authored");
const allText = (reply: PatientReply) => reply.segments.map((s) => s.text).join("\n");

/* ---- Urgent symptoms come first ----------------------------------------- */

const URGENT_PHRASES: [string, "physical" | "self-harm"][] = [
  ["I have chest pain", "physical"],
  ["I am having trouble breathing", "physical"],
  ["shortness of breath since this morning", "physical"],
  ["there is severe bleeding and it will not stop", "physical"],
  ["my stools are black and tarry", "physical"],
  ["I passed out in the kitchen", "physical"],
  ["I keep having thoughts of hurting myself", "self-harm"],
];

describe("urgent symptoms are answered before anything else", () => {
  for (const [phrase, kind] of URGENT_PHRASES) {
    it(`"${phrase}" returns the ${kind} notice`, async () => {
      const reply = await ask(phrase);
      expect(reply.urgent).toBe(kind);
      expect(reply.refused).toBeUndefined();
      expect(reply.segments.every((s) => s.kind === "quoted")).toBe(true);
    });
  }

  it("wins even when the question also asks something ordinary", async () => {
    const reply = await ask("I have chest pain, and what should I ask my doctor about my warfarin?");
    expect(reply.urgent).toBe("physical");
    expect(allText(reply)).not.toMatch(/Warfarin/);
  });

  it("self-harm wording outranks a physical match", async () => {
    const reply = await ask("I fainted and I have been thinking of hurting myself");
    expect(reply.urgent).toBe("self-harm");
  });
});

/* ---- Directive requests are refused ------------------------------------- */

describe("requests to change a medicine or to contact someone are refused", () => {
  const cases: [string, string][] = [
    ["Stop my warfarin", checkTool("stop_medication").reason],
    ["Should I take Advil instead?", checkTool("substitute_medication").reason],
    ["Can you increase my dose?", checkTool("change_dose").reason],
  ];

  for (const [question, reason] of cases) {
    it(`"${question}" is refused with the policy reason`, async () => {
      const reply = await ask(question);
      expect(reply.refused).toBe(true);
      expect(reply.segments[0]).toEqual({ kind: "refusal", text: reason });
    });
  }

  it('"Call my doctor for me" is refused, because the agent contacts nobody', async () => {
    const reply = await ask("Call my doctor for me");
    expect(reply.refused).toBe(true);
    expect(reply.segments[0]).toEqual({ kind: "refusal", text: CONTACT_REFUSAL });
  });

  it("a question that only mentions a dose is answered, not refused", async () => {
    const reply = await ask("What is my warfarin dose?");
    expect(reply.refused).toBeUndefined();
    expect(directiveTool("What is my warfarin dose?")).toBeNull();
    expect(allText(reply)).toMatch(/Warfarin/);
  });
});

/* ---- Everything the agent writes itself stays neutral -------------------- */

const BATTERY = [
  "What changed since my last visit?",
  "Why is this flagged?",
  "Why is Advil flagged?",
  "Where did this medicine come from?",
  "Where did Advil come from?",
  "What should I ask at my visit?",
  "What medications am I taking?",
  "How has my mood been?",
  "Do my records disagree?",
  "What is my warfarin dose?",
  "Am I allergic to anything?",
  "When is my next appointment?",
  "Hello",
];

describe("the ported neutral-language check holds across ordinary questions", () => {
  for (const question of BATTERY) {
    it(`"${question}" writes no directive wording`, async () => {
      for (const ctx of [context(true), context(false)]) {
        const reply = await answerPatient(question, ctx);
        for (const segment of authored(reply)) expect(validateNeutral(segment.text)).toBeNull();
        expect(reply.answeredBy).toBe("rules");
      }
    });
  }

  it("flags the reference wording it was ported to catch", () => {
    expect(validateNeutral("Stop the ibuprofen until you see your doctor.")).toBe("directive language");
    expect(validateNeutral("You should take this with food.")).toBe("directive language");
    expect(validateNeutral("Your records list ibuprofen from two places.")).toBeNull();
  });
});

/* ---- The page-aware intents answer from the SafetyUpdate ----------------- */

describe("page-aware intents answer from the record with citations", () => {
  it("names the real new count and the updated flag", async () => {
    const reply = await ask("What changed since my last visit?");
    expect(allText(reply)).toMatch(/1 new thing to ask your doctor about/);
    expect(allText(reply)).toMatch(/now also involves Advil/);
    expect(allText(reply)).toMatch(/in no clinical record yet/);
    expect(reply.citations.some((c) => c.ruleId === "allergy/medication-conflict/al-h1")).toBe(true);
  });

  it("gives the zero case when nothing was added on this device", async () => {
    const reply = await answerPatient("What changed since my last visit?", context(false));
    expect(allText(reply)).toMatch(/Nothing new since your last visit\./);
    expect(reply.citations.length).toBeGreaterThan(0);
  });

  it("explains a flag with its rule and its evidence", async () => {
    const reply = await ask("Why is Advil flagged?");
    expect(allText(reply)).toMatch(/Ibuprofen/);
    expect(reply.citations.some((c) => c.ruleId)).toBe(true);
  });

  it("names where an item came from, with its own source badge", async () => {
    const reply = await ask("Where did Advil come from?");
    expect(allText(reply)).toMatch(/Entered by you/);
    expect(reply.citations.some((c) => c.source?.kind === "patient-entered")).toBe(true);
  });

  it("turns findings into questions for the visit, quoting the rule text", async () => {
    const reply = await ask("What should I ask at my visit?");
    const quoted = reply.segments.filter((s) => s.kind === "quoted").map((s) => s.text);
    expect(quoted.length).toBeGreaterThan(0);
    // Rule text is quoted verbatim: every suggestedNextStep is already something to raise.
    expect(quoted.every((t) => /\bask\b/i.test(t))).toBe(true);
    expect(reply.citations.length).toBeGreaterThan(0);
  });

  it("every intent reply carries at least one citation", async () => {
    for (const question of ["What changed since my last visit?", "Why is this flagged?", "Where did Advil come from?", "What should I ask at my visit?"]) {
      expect((await ask(question)).citations.length).toBeGreaterThan(0);
    }
  });
});
