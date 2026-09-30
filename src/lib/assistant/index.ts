import type { PatientRecord, RiskFlag } from "../types";
import { mean, withinLastDays, formatDate } from "../safetyEngine/rules/types";
import { labHistory, latestLabs } from "../passport/selectors";
import { openIssues, type ReconIssue } from "../reconcile";

/**
 * CONVERSATIONAL ASSISTANT — scripted, data-grounded responder.
 *
 * Answers only from the patient's own record. There is no language model in
 * this phase; intents are matched with simple keyword rules and every reply
 * is assembled from the record and the safety engine's flags.
 *
 * The `AssistantProvider` interface is the seam for a real model later
 * (e.g. an LLM call with the record as retrieval context). The UI labels
 * every reply "AI-generated" regardless of provider so the disclosure
 * doesn't depend on which one is wired in.
 */

export interface AssistantReply {
  text: string;
  /** Which parts of the record this answer drew on. */
  sources: string[];
  /** Follow-up prompts the UI can offer as chips. */
  suggestions?: string[];
  urgent?: boolean;
}

export interface AssistantInput {
  record: PatientRecord;
  flags: RiskFlag[];
  now: Date;
  /** Differences between records (Phase G reconciliation). */
  issues?: ReconIssue[];
}

export interface AssistantProvider {
  name: string;
  respond(question: string, input: AssistantInput): Promise<AssistantReply>;
}

const EMERGENCY = /chest pain|can'?t breathe|trouble breathing|suicid|kill myself|end my life|stroke|face droop|overdose|passed out|unconscious/i;

function firstName(name: string) {
  return name.split(" ")[0];
}

function listFlags(flags: RiskFlag[], limit = 3): string {
  if (flags.length === 0) return "The safety check found nothing to flag right now.";
  return flags
    .slice(0, limit)
    .map((f, i) => `${i + 1}. ${f.title} (${f.severity}). ${f.suggestedNextStep}`)
    .join("\n");
}

export const scriptedProvider: AssistantProvider = {
  name: "scripted",
  async respond(question, { record, flags, now, issues = [] }) {
    const q = question.toLowerCase().trim();
    const { patient } = record;
    const name = firstName(patient.name);

    if (EMERGENCY.test(q)) {
      return {
        urgent: true,
        text: "I can't help with an emergency. If you or someone near you is in danger right now, call your local emergency number (911 in the US) or go to the nearest emergency department. If you're having thoughts of harming yourself, you can call or text 988 in the US to reach the Suicide & Crisis Lifeline.",
        sources: [],
      };
    }

    const passportReply = answerFromPassport(q, record, now, issues);
    if (passportReply) return passportReply;

    // A specific medication mentioned?
    const med = patient.medications.find((m) => q.includes(m.genericName) || q.includes(m.name.toLowerCase().split(" ")[0]));
    if (med) {
      const related = flags.filter((f) => f.medications.includes(med.name));
      return {
        text:
          `${med.name} ${med.dose}, ${med.frequency} — on your list since ${formatDate(med.startDate)}${med.indication ? ` for ${med.indication.toLowerCase()}` : ""}.` +
          (related.length > 0
            ? `\n\nIt is involved in ${related.length} active safety flag${related.length === 1 ? "" : "s"}:\n${listFlags(related)}`
            : "\n\nIt isn't involved in any active safety flags."),
        sources: ["Medication list", ...(related.length ? ["Safety engine flags"] : [])],
        suggestions: ["What should I ask my doctor?", "Show my mood trend"],
      };
    }

    if (/^(hi|hello|hey|good (morning|afternoon|evening))/.test(q)) {
      return {
        text: `Hi ${name}. I can answer questions from your Passport — medications, allergies, labs, appointments, your care team, screenings, nutrition and safety flags — using only your own records. What would you like to know?`,
        sources: [],
        suggestions: ["What medications am I taking?", "Why was something flagged?", "How has my mood been?"],
      };
    }

    if (/(what|which).*(medic|pill|drug|taking)|my (medic|pill|drug)s?\b|list/.test(q)) {
      return {
        text:
          `You have ${patient.medications.length} medicines on your list:\n` +
          patient.medications.map((m) => `• ${m.name} ${m.dose} — ${m.frequency}`).join("\n"),
        sources: ["Medication list"],
        suggestions: ["Any interactions?", "What changed recently?"],
      };
    }

    if (/chang|new|recent|start|stop|dose/.test(q) && /med|pill|drug|prescri/.test(q) || /what changed/.test(q)) {
      const recent = patient.medicationHistory.filter((e) => (now.getTime() - new Date(e.date).getTime()) / 86_400_000 <= 60);
      return {
        text:
          recent.length > 0
            ? `Recent changes in the last 60 days:\n${recent.map((e) => `• ${formatDate(e.date)}: ${e.detail}`).join("\n")}`
            : "No medication changes recorded in the last 60 days.",
        sources: ["Medication history"],
        suggestions: ["Has that affected my mood?", "Why was something flagged?"],
      };
    }

    if (/flag|risk|safe|interact|warn|why|concern|danger/.test(q)) {
      return {
        text: `The safety check found ${flags.length} item${flags.length === 1 ? "" : "s"} for you:\n${listFlags(flags, 5)}\n\nEach of these is a question to raise, not a change to make on your own.`,
        sources: ["Safety engine flags", "Medication list", "Nutrition, mood and symptom entries"],
        suggestions: ["What should I ask my doctor?", "Tell me about the first one"],
      };
    }

    if (/mood|feel|depress|sad|down|anxious|happy|mental/.test(q)) {
      const week = withinLastDays(record.moods, 7, now);
      const prior = withinLastDays(record.moods, 21, now).filter((m) => !week.includes(m));
      const cur = mean(week.map((m) => m.score));
      const prev = mean(prior.map((m) => m.score));
      const moodFlags = flags.filter((f) => f.category === "drug-mood");
      return {
        text:
          (cur === null
            ? "You haven't logged a mood check-in in the last week."
            : `Your mood check-ins averaged ${cur.toFixed(1)} out of 5 this week` +
              (prev !== null ? `, compared with ${prev.toFixed(1)} over the two weeks before.` : ".")) +
          (moodFlags.length > 0 ? `\n\n${moodFlags[0].explanation}\n\n${moodFlags[0].suggestedNextStep}` : ""),
        sources: ["Mood check-ins", ...(moodFlags.length ? ["Safety engine flags"] : [])],
        suggestions: ["Show my trends", "What should I ask my doctor?"],
      };
    }

    if (/eat|food|nutrition|diet|meal|grapefruit|vitamin k|green|salad|sugar|salt|sodium|drink|alcohol/.test(q)) {
      const recent = withinLastDays(record.nutrition, 14, now);
      const days = new Set(recent.map((e) => e.timestamp.slice(0, 10))).size;
      const tagCounts = new Map<string, number>();
      for (const e of recent) for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      const nutriFlags = flags.filter((f) => f.category === "drug-nutrient");
      const top = [...tagCounts.entries()]
        .filter(([t]) => t !== "balanced")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t, c]) => `${t.replace(/-/g, " ")} (${c})`);
      return {
        text:
          `You logged meals on ${days} of the last 14 days (${recent.length} entries).` +
          (top.length ? ` Most frequent tags: ${top.join(", ")}.` : "") +
          (nutriFlags.length > 0
            ? `\n\nFood-medicine flags:\n${listFlags(nutriFlags)}`
            : "\n\nNo food-medicine interactions were flagged."),
        sources: ["Nutrition entries", ...(nutriFlags.length ? ["Safety engine flags"] : [])],
        suggestions: ["What should I ask my doctor?", "Show my trends"],
      };
    }

    if (/symptom|dizz|bruis|tired|fatigue|nause|headache|dry mouth|fogg|forget/.test(q)) {
      const recent = withinLastDays(record.symptoms, 14, now);
      const counts = new Map<string, number>();
      for (const s of recent) counts.set(s.symptom, (counts.get(s.symptom) ?? 0) + 1);
      const lines = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s, c]) => `• ${s} — ${c} time${c === 1 ? "" : "s"}`);
      const related = flags.filter((f) => f.evidence.some((e) => /symptom/i.test(e)));
      return {
        text:
          (lines.length ? `Symptoms you logged in the last two weeks:\n${lines.join("\n")}` : "No symptoms logged in the last two weeks.") +
          (related.length ? `\n\n${related.length} safety flag${related.length === 1 ? "" : "s"} reference these symptoms — for example: ${related[0].title}.` : ""),
        sources: ["Symptom entries", ...(related.length ? ["Safety engine flags"] : [])],
        suggestions: ["Why was that flagged?", "What should I ask my doctor?"],
      };
    }

    if (/lab|inr|a1c|glucose|cholesterol|ldl|potassium|kidney|egfr|blood pressure|\bbp\b|vital/.test(q)) {
      const labs = latestLabs(patient.labs).map((l) => `• ${l.name}: ${l.value}${l.unit ? " " + l.unit : ""} (${formatDate(l.date)}) — ${l.status}`);
      const v = [...patient.vitals].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      return {
        text:
          `Your most recent labs:\n${labs.join("\n")}` +
          (v ? `\n\nLatest vitals (${formatDate(v.timestamp)}): BP ${v.systolic}/${v.diastolic}, heart rate ${v.heartRate}, weight ${v.weightKg} kg.` : ""),
        sources: ["Lab results", "Vitals"],
        suggestions: ["Any interactions?", "What should I ask my doctor?"],
      };
    }

    if (/doctor|ask|visit|share|question|clinic/.test(q)) {
      const recordQs = issues.filter((i) => !i.resolution || i.resolution.askClinician).map((i) => i.question);
      const all = [...flags.map((f) => f.suggestedNextStep), ...recordQs];
      return {
        text:
          all.length > 0
            ? `Questions worth bringing to ${patient.primaryClinician}:\n` +
              all.map((t, i) => `${i + 1}. ${t}`).join("\n") +
              "\n\nYou can print or share the visit summary from Passport → Share."
            : `Nothing is flagged right now, but it's always reasonable to ask ${patient.primaryClinician} for a medication review.`,
        sources: ["Safety engine flags", ...(recordQs.length ? ["Differences between records"] : [])],
        suggestions: ["Open the share view"],
      };
    }

    if (/install|notif|remind|phone|app/.test(q)) {
      return {
        text: "You can install Parthia Health on your phone from the “Install” button in the header, and turn on medication reminders and check-in nudges from the same screen.",
        sources: [],
      };
    }

    return {
      text: `I can only answer from your own records, ${name}. Try asking about your medications, allergies, labs, next appointment, care team, screenings, why something was flagged, or what to ask your doctor.`,
      sources: [],
      suggestions: ["What medications am I taking?", "When is my next appointment?", "Do my records disagree?", "What should I ask my doctor?"],
    };
  },
};

/** Active provider. Swap for a model-backed provider behind an env var later. */
export const assistant: AssistantProvider = scriptedProvider;

const daysUntil = (iso: string, now: Date) => Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);
const LAB_WORDS: [RegExp, RegExp][] = [
  [/egfr|kidney/, /egfr/i],
  [/a1c|hba1c/, /a1c/i],
  [/inr/, /inr/i],
  [/potassium/, /potassium/i],
  [/ldl|cholesterol/, /ldl/i],
  [/tsh|thyroid/, /tsh/i],
];

/**
 * Intents that draw on the fuller Passport (Phase G). Returns null when the
 * question isn't one of these, so the original intents still apply.
 */
function answerFromPassport(q: string, record: PatientRecord, now: Date, issues: ReconIssue[]): AssistantReply | null {
  const { patient } = record;

  if (/allerg|allergic|reaction to/.test(q)) {
    const list = record.allergies;
    return {
      text:
        (list.length
          ? `Allergies in your Passport:\n${list.map((a) => `• ${a.substance}${a.reaction ? ` — ${a.reaction.toLowerCase()}` : ""} (${a.severity}${a.type === "intolerance" ? ", intolerance" : ""})`).join("\n")}`
          : "You haven't recorded any allergies.") +
        "\n\nThe safety check compares these against every medicine on your list, including ones you add or scan.",
      sources: ["Allergies"],
      suggestions: ["Any interactions?", "What medications am I taking?"],
    };
  }

  if (/phq|gad|screen|questionnaire|anxiety score|depression score/.test(q)) {
    const latest = (inst: "PHQ-9" | "GAD-7") => record.assessments.filter((a) => a.instrument === inst).sort((a, b) => b.date.localeCompare(a.date));
    const lines = (["PHQ-9", "GAD-7"] as const).flatMap((inst) => {
      const [cur, prev] = latest(inst);
      if (!cur) return [];
      return [`• ${inst}: ${cur.score} (${cur.severity.toLowerCase()}) on ${formatDate(cur.date)}${prev ? `, previously ${prev.score} on ${formatDate(prev.date)}` : ""}`];
    });
    return {
      text:
        (lines.length ? `Your latest screenings:\n${lines.join("\n")}` : "You haven't completed a PHQ-9 or GAD-7 screening yet. You can take one from Log.") +
        "\n\nThese are screenings, not diagnoses — a clinician interprets them with you.",
      sources: ["Screening questionnaires"],
      suggestions: ["How has my mood been?", "What should I ask my doctor?"],
    };
  }

  if (/appointment|next visit|when do i see|upcoming|schedul/.test(q)) {
    const upcoming = record.appointments.filter((a) => a.status === "booked" && daysUntil(a.start, now) >= 0).sort((a, b) => a.start.localeCompare(b.start));
    return {
      text: upcoming.length
        ? `Upcoming appointments:\n${upcoming.map((a) => `• ${formatDate(a.start)} — ${a.clinician} (${a.specialty}): ${a.reason}${a.patientNotes ? `\n   Your notes: ${a.patientNotes}` : ""}`).join("\n")}`
        : "You have no upcoming appointments in your Passport.",
      sources: ["Appointments"],
      suggestions: ["What should I ask my doctor?", "Who is on my care team?"],
    };
  }

  if (/care team|who is my|who's my|cardiolog|pharmacist|dietitian|specialist|phone number|contact/.test(q) && !/emergency/.test(q)) {
    return {
      text: record.careTeam.length
        ? `Your care team:\n${record.careTeam.map((c) => `• ${c.name}${c.specialty ? ` — ${c.specialty}` : ""}${c.organization ? `, ${c.organization}` : ""}${c.phone ? ` · ${c.phone}` : ""}`).join("\n")}`
        : "You haven't added anyone to your care team yet.",
      sources: ["Care team"],
      suggestions: ["When is my next appointment?"],
    };
  }

  if (/emergency (card|info|contact)|blood type/.test(q)) {
    const e = record.emergency;
    return {
      text: e
        ? `Your emergency card:\n• Blood type: ${e.bloodType ?? "not recorded"}\n• Critical allergies: ${e.criticalAllergies.join(", ") || "none listed"}\n• Conditions: ${e.criticalConditions.join(", ") || "none listed"}\n• Contacts: ${e.contacts.map((c) => `${c.name} (${c.relationship}) ${c.phone}`).join("; ") || "none"}`
        : "You haven't filled in your emergency card yet. You can do it from Passport → Emergency card.",
      sources: ["Emergency information"],
    };
  }

  if (/differ|disagree|mismatch|reconcil|conflict between|records (say|match)/.test(q)) {
    const open = openIssues(issues);
    return {
      text: open.length
        ? `${open.length} difference${open.length === 1 ? "" : "s"} between your records still to review:\n${open.map((i) => `• ${i.title} — ${i.explanation}`).join("\n")}\n\nYou can resolve them in Passport → Review.`
        : issues.length
          ? "You've reviewed every difference between your records."
          : "Your connected records agree with your own list — no differences found.",
      sources: ["Differences between records"],
      suggestions: ["What should I ask my doctor?"],
    };
  }

  if (/limit|restrict|dietitian|diet plan|nutrition goal|how much (salt|sodium|sugar)/.test(q) && record.nutritionProfile) {
    const n = record.nutritionProfile;
    const note = [...n.dietitianNotes].sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      text:
        `Your nutrition profile (${n.dietaryPattern}):\n` +
        (n.restrictions.length ? `Limits: ${n.restrictions.join("; ")}\n` : "") +
        (n.goals.length ? `Goals: ${n.goals.join("; ")}` : "") +
        (note ? `\n\nLatest note from ${note.author} (${formatDate(note.date)}): ${note.note}` : ""),
      sources: ["Nutrition profile"],
      suggestions: ["What have I been eating?"],
    };
  }

  // A specific lab's history ("how is my eGFR trending?")
  const lab = LAB_WORDS.find(([w]) => w.test(q));
  if (lab && /trend|history|over time|changing|chang|going|falling|rising/.test(q)) {
    const latest = latestLabs(patient.labs).find((l) => lab[1].test(l.name));
    if (latest) {
      const hist = labHistory(patient.labs, latest.loincCode ?? latest.name);
      return {
        text: `${latest.name} over time:\n${hist.map((l) => `• ${formatDate(l.date)}: ${l.value}${l.unit ? ` ${l.unit}` : ""} (${l.status})`).join("\n")}`,
        sources: ["Lab results"],
        suggestions: ["What should I ask my doctor?"],
      };
    }
  }

  return null;
}
