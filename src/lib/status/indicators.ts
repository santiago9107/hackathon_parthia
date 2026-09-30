import type { DomainIndicator, PatientRecord, RiskFlag, StatusLevel } from "../types";
import { mean, withinLastDays } from "../safetyEngine/rules/types";
import { latestLabs } from "../passport/selectors";

/**
 * Four SEPARATE domain indicators. Deliberately not combined into a single
 * score: a patient can be doing well on nutrition and poorly on mood, and
 * flattening that into one number hides exactly what matters.
 */

export function medicationSafetyIndicator(flags: RiskFlag[]): DomainIndicator {
  const high = flags.filter((f) => f.severity === "high").length;
  const moderate = flags.filter((f) => f.severity === "moderate").length;
  const level: StatusLevel = high > 0 ? "attention" : moderate > 0 ? "watch" : "good";
  return {
    domain: "medication-safety",
    label: "Medication Safety",
    level,
    metric: flags.length === 0 ? "No flags" : `${flags.length} flag${flags.length === 1 ? "" : "s"}`,
    headline:
      level === "attention"
        ? `${high} item${high === 1 ? "" : "s"} worth raising with your doctor soon`
        : level === "watch"
          ? `${moderate} item${moderate === 1 ? "" : "s"} to mention at your next visit`
          : "No interactions or burden concerns found",
    detail:
      flags.length > 0
        ? flags
            .slice(0, 2)
            .map((f) => f.title)
            .join(" · ")
        : "Your medication list was checked against nutrition, mood and symptom entries.",
  };
}

export function physicalIndicator(record: PatientRecord, now: Date): DomainIndicator {
  const current = latestLabs(record.patient.labs);
  const abnormal = current.filter((l) => l.status === "abnormal");
  const borderline = current.filter((l) => l.status === "borderline");
  const recentSymptoms = withinLastDays(record.symptoms, 7, now);
  const avgSeverity = mean(recentSymptoms.map((s) => s.severity));
  const severeSymptoms = recentSymptoms.filter((s) => s.severity >= 4);

  let level: StatusLevel = "good";
  if (abnormal.length >= 2 || severeSymptoms.length >= 3) level = "attention";
  else if (abnormal.length === 1 || borderline.length >= 2 || (avgSeverity ?? 0) >= 3) level = "watch";

  const latestVitals = [...record.patient.vitals].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const bp = latestVitals?.systolic ? `BP ${latestVitals.systolic}/${latestVitals.diastolic}` : null;

  return {
    domain: "physical",
    label: "Physical & Labs",
    level,
    metric: abnormal.length > 0 ? `${abnormal.length} lab${abnormal.length === 1 ? "" : "s"} out of range` : bp ?? "Labs in range",
    headline:
      abnormal.length > 0
        ? `${abnormal.map((l) => l.name).join(", ")} outside the target range`
        : borderline.length > 0
          ? `${borderline.map((l) => l.name).join(", ")} borderline`
          : "Recent labs and vitals look steady",
    detail:
      recentSymptoms.length > 0
        ? `${recentSymptoms.length} symptom entr${recentSymptoms.length === 1 ? "y" : "ies"} this week (most common: ${mostCommon(recentSymptoms.map((s) => s.symptom))}).`
        : "No symptoms logged this week.",
  };
}

export function mentalHealthIndicator(record: PatientRecord, now: Date): DomainIndicator {
  const lastWeek = withinLastDays(record.moods, 7, now);
  const prior = withinLastDays(record.moods, 21, now).filter((m) => !lastWeek.includes(m));
  const current = mean(lastWeek.map((m) => m.score));
  const previous = mean(prior.map((m) => m.score));

  let level: StatusLevel = "good";
  if (current !== null && current < 2.6) level = "attention";
  else if (current !== null && (current < 3.3 || (previous !== null && previous - current >= 0.6))) level = "watch";
  else if (current === null) level = "watch";

  const trend =
    current !== null && previous !== null
      ? current - previous <= -0.4
        ? "trending down"
        : current - previous >= 0.4
          ? "trending up"
          : "steady"
      : "not enough data";

  return {
    domain: "mental-health",
    label: "Mental Health",
    level,
    metric: current !== null ? `${current.toFixed(1)} / 5 this week` : "No check-ins this week",
    headline:
      current === null
        ? "No mood check-ins in the last 7 days"
        : level === "attention"
          ? "Mood has been low most days this week"
          : level === "watch"
            ? `Mood is ${trend} compared with the previous two weeks`
            : `Mood is ${trend} and in a comfortable range`,
    detail:
      previous !== null
        ? `Previous two weeks averaged ${previous.toFixed(1)}. ${lastWeek.length} check-in${lastWeek.length === 1 ? "" : "s"} this week.`
        : `${lastWeek.length} check-ins this week.`,
  };
}

export function nutritionIndicator(record: PatientRecord, now: Date): DomainIndicator {
  const WINDOW = 14;
  const recent = withinLastDays(record.nutrition, WINDOW, now);
  const loggedDays = new Set(recent.map((e) => e.timestamp.slice(0, 10))).size;
  const daysWith = (tag: string) => new Set(recent.filter((e) => e.tags.includes(tag as never)).map((e) => e.timestamp.slice(0, 10))).size;
  const sugarDays = daysWith("high-sugar");
  const sodiumDays = daysWith("high-sodium");
  const hasDiabetes = record.patient.conditions.some((c) => c.category === "diabetes");
  const hasCardio = record.patient.conditions.some((c) => c.category === "hypertension" || c.category === "cardiovascular");

  const concerns: string[] = [];
  if (hasDiabetes && sugarDays >= 4) concerns.push(`sweet snacks on ${sugarDays} of ${WINDOW} days`);
  if (hasCardio && sodiumDays >= 7) concerns.push(`salty meals on ${sodiumDays} of ${WINDOW} days`);
  const inconsistent = loggedDays < WINDOW * 0.6;

  let level: StatusLevel = "good";
  if (inconsistent && concerns.length > 0) level = "attention";
  else if (inconsistent || concerns.length > 0) level = "watch";

  return {
    domain: "nutrition",
    label: "Nutrition",
    level,
    metric: `${loggedDays} of ${WINDOW} days logged`,
    headline: inconsistent
      ? "Logging has gaps — patterns are hard to see"
      : concerns.length > 0
        ? `Mostly logged, with ${concerns[0]}`
        : "Logging consistently, meals look balanced",
    detail:
      concerns.length > 0
        ? `Noted: ${concerns.join("; ")}.`
        : inconsistent
          ? "Even a one-line entry per meal helps the safety check spot food-medicine patterns."
          : `${recent.length} meals logged over the last two weeks.`,
  };
}

export function computeIndicators(record: PatientRecord, flags: RiskFlag[], now: Date): DomainIndicator[] {
  return [
    medicationSafetyIndicator(flags),
    physicalIndicator(record, now),
    mentalHealthIndicator(record, now),
    nutritionIndicator(record, now),
  ];
}

function mostCommon(items: string[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}
