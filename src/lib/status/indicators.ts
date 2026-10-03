import type { DomainIndicator, PatientRecord, RiskFlag, StatusLevel } from "../types";
import { mean, withinLastDays } from "../safetyEngine/rules/types";
import { labHistory, latestLabs } from "../passport/selectors";

/**
 * Four SEPARATE domain indicators. Deliberately not combined into a single
 * score: a patient can be doing well on nutrition and poorly on mood, and
 * flattening that into one number hides exactly what matters.
 */

export function medicationSafetyIndicator(flags: RiskFlag[], openDifferences = 0): DomainIndicator {
  const high = flags.filter((f) => f.severity === "high").length;
  const moderate = flags.filter((f) => f.severity === "moderate").length;
  const level: StatusLevel = high > 0 ? "attention" : moderate > 0 || openDifferences > 0 ? "watch" : "good";
  const diff = openDifferences > 0 ? `${openDifferences} difference${openDifferences === 1 ? "" : "s"} between your records to review` : null;
  return {
    domain: "medication-safety",
    label: "Medication Safety",
    level,
    metric: [flags.length === 0 ? "No flags" : `${flags.length} flag${flags.length === 1 ? "" : "s"}`, openDifferences ? `${openDifferences} to reconcile` : null].filter(Boolean).join(" · "),
    headline:
      level === "attention"
        ? `${high} item${high === 1 ? "" : "s"} worth raising with your doctor soon`
        : moderate > 0
          ? `${moderate} item${moderate === 1 ? "" : "s"} to mention at your next visit`
          : diff
            ? diff.charAt(0).toUpperCase() + diff.slice(1)
            : "No interactions or burden concerns found",
    detail:
      flags.length > 0
        ? [...flags.slice(0, 2).map((f) => f.title), ...(diff && level === "attention" ? [diff] : [])].join(" · ")
        : "Your medication list was checked against nutrition, mood, symptoms, readings, labs and allergies.",
  };
}

export function physicalIndicator(record: PatientRecord, now: Date): DomainIndicator {
  const current = latestLabs(record.patient.labs);
  const abnormal = current.filter((l) => l.status === "abnormal");
  const borderline = current.filter((l) => l.status === "borderline");
  const recentSymptoms = withinLastDays(record.symptoms, 7, now);
  const avgSeverity = mean(recentSymptoms.map((s) => s.severity));
  const severeSymptoms = recentSymptoms.filter((s) => s.severity >= 4);

  // Readings from home cuffs, wearables and clinic visits (last 14 days).
  const readings = withinLastDays(record.patient.vitals, 14, now);
  const bpReadings = readings.filter((v) => v.systolic !== undefined && v.diastolic !== undefined);
  const lowBp = bpReadings.filter((v) => v.systolic! < 100 || v.diastolic! < 60);
  const avgSys = mean(bpReadings.map((v) => v.systolic!));
  const lowHrDays = new Set(readings.filter((v) => (v.restingHeartRate ?? 99) < 50).map((v) => v.timestamp.slice(0, 10))).size;
  const egfr = labHistory(record.patient.labs, "eGFR");
  const egfrFalling = egfr.length >= 2 && egfr[egfr.length - 1].value < 60 && Math.max(...egfr.map((l) => l.value)) - egfr[egfr.length - 1].value >= 5;
  const readingConcerns: string[] = [];
  if (lowBp.length >= 3) readingConcerns.push(`${lowBp.length} low blood pressure readings`);
  if (bpReadings.length >= 3 && (avgSys ?? 0) >= 140) readingConcerns.push(`blood pressure averaging ${Math.round(avgSys!)} systolic`);
  if (lowHrDays >= 3) readingConcerns.push(`resting heart rate under 50 on ${lowHrDays} days`);
  if (egfrFalling) readingConcerns.push("kidney function (eGFR) falling");

  let level: StatusLevel = "good";
  if (abnormal.length >= 2 || severeSymptoms.length >= 3 || lowBp.length >= 5 || lowBp.some((v) => v.systolic! < 90)) level = "attention";
  else if (abnormal.length === 1 || borderline.length >= 2 || (avgSeverity ?? 0) >= 3 || readingConcerns.length > 0) level = "watch";

  const latestVitals = [...record.patient.vitals].filter((v) => v.systolic !== undefined).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const bp = latestVitals?.systolic ? `BP ${latestVitals.systolic}/${latestVitals.diastolic}` : null;
  const activity = readings.filter((v) => v.steps !== undefined || v.sleepHours !== undefined);
  const steps = mean(activity.filter((v) => v.steps !== undefined).map((v) => v.steps!));
  const sleep = mean(activity.filter((v) => v.sleepHours !== undefined).map((v) => v.sleepHours!));
  const deviceLine = activity.length
    ? ` From your devices: ${[steps !== null ? `${Math.round(steps).toLocaleString("en-US")} steps a day` : null, sleep !== null ? `${sleep.toFixed(1)} h sleep` : null].filter(Boolean).join(", ")}.`
    : "";

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
      (readingConcerns.length ? `Readings: ${readingConcerns.join("; ")}. ` : "") +
      (recentSymptoms.length > 0
        ? `${recentSymptoms.length} symptom entr${recentSymptoms.length === 1 ? "y" : "ies"} this week (most common: ${mostCommon(recentSymptoms.map((s) => s.symptom))}).`
        : "No symptoms logged this week.") +
      deviceLine,
  };
}

export function mentalHealthIndicator(record: PatientRecord, now: Date): DomainIndicator {
  const lastWeek = withinLastDays(record.moods, 7, now);
  const prior = withinLastDays(record.moods, 21, now).filter((m) => !lastWeek.includes(m));
  const current = mean(lastWeek.map((m) => m.score));
  const previous = mean(prior.map((m) => m.score));

  // Screening questionnaires (PHQ-9 / GAD-7) from the last 60 days. Screenings, not diagnoses.
  const since = new Date(now);
  since.setDate(since.getDate() - 60);
  const recentScreens = record.assessments.filter((a) => new Date(`${a.date}T12:00:00`) >= since).sort((a, b) => a.date.localeCompare(b.date));
  const phq = recentScreens.filter((a) => a.instrument === "PHQ-9");
  const latestPhq = phq[phq.length - 1];
  const priorPhq = record.assessments.filter((a) => a.instrument === "PHQ-9" && latestPhq && a.date < latestPhq.date).sort((a, b) => a.date.localeCompare(b.date)).pop();
  const latestGad = recentScreens.filter((a) => a.instrument === "GAD-7").pop();
  const phqRising = !!(latestPhq && priorPhq && latestPhq.score - priorPhq.score >= 5);

  let level: StatusLevel = "good";
  if ((current !== null && current < 2.6) || (latestPhq?.score ?? 0) >= 15) level = "attention";
  else if (current !== null && (current < 3.3 || (previous !== null && previous - current >= 0.6))) level = "watch";
  else if (current === null) level = "watch";
  if (level === "good" && ((latestPhq?.score ?? 0) >= 10 || (latestGad?.score ?? 0) >= 10 || phqRising)) level = "watch";
  const screenLine = [
    latestPhq && `PHQ-9 ${latestPhq.score} (${latestPhq.severity.toLowerCase()}) on ${latestPhq.date.slice(5).replace("-", "/")}${phqRising ? `, up from ${priorPhq!.score}` : ""}`,
    latestGad && `GAD-7 ${latestGad.score} (${latestGad.severity.toLowerCase()})`,
  ].filter(Boolean).join("; ");

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
      (previous !== null
        ? `Previous two weeks averaged ${previous.toFixed(1)}. ${lastWeek.length} check-in${lastWeek.length === 1 ? "" : "s"} this week.`
        : `${lastWeek.length} check-ins this week.`) + (screenLine ? ` Screening: ${screenLine}.` : ""),
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

  const profile = record.nutritionProfile;
  const limits = (profile?.restrictions ?? []).join(" ").toLowerCase();
  const sodiumLimit = /sodium|salt/.test(limits);
  const sugarLimit = /sugar|sweet/.test(limits);
  const concerns: string[] = [];
  if ((hasDiabetes || sugarLimit) && sugarDays >= 4) concerns.push(`sweet snacks on ${sugarDays} of ${WINDOW} days${sugarLimit ? " (you're limiting sugar)" : ""}`);
  if (sodiumLimit ? sodiumDays >= 5 : hasCardio && sodiumDays >= 7) concerns.push(`salty meals on ${sodiumDays} of ${WINDOW} days${sodiumLimit ? " despite a sodium limit" : ""}`);
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
      (concerns.length > 0
        ? `Noted: ${concerns.join("; ")}.`
        : inconsistent
          ? "Even a one-line entry per meal helps the safety check spot food-medicine patterns."
          : `${recent.length} meals logged over the last two weeks.`) +
      (profile ? "" : " Adding a nutrition profile helps put meals in context."),
  };
}

export function computeIndicators(record: PatientRecord, flags: RiskFlag[], now: Date, differences: { resolution?: unknown }[] = []): DomainIndicator[] {
  return [
    medicationSafetyIndicator(flags, differences.filter((d) => !d.resolution).length),
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
