import type { Medication, RiskFlag } from "../../types";
import { labHistory } from "../../passport/selectors";
import {
  BP_LOWERING_CLASSES,
  EGFR_DECLINE_FRACTION,
  EGFR_DECLINE_POINTS,
  EGFR_HIGH_CONCERN,
  EGFR_LOOKBACK_DAYS,
  EGFR_REDUCED,
  LOW_BP_DIASTOLIC,
  LOW_BP_LOOKBACK_DAYS,
  LOW_BP_MIN_READINGS,
  LOW_BP_SYSTOLIC,
  LOW_RESTING_HR,
  LOW_RESTING_HR_LOOKBACK_DAYS,
  LOW_RESTING_HR_MIN_DAYS,
  PHQ9_HIGH,
  PHQ9_LOOKBACK_DAYS,
  PHQ9_MEANINGFUL_RISE,
  PHQ9_MODERATE,
  RENAL_REVIEW,
  VERY_LOW_BP_SYSTOLIC,
  VERY_LOW_RESTING_HR,
  matches,
} from "../knowledge";
import { daysBetween, formatDate, makeFlag, withinLastDays, type RuleDefinition } from "./types";

/**
 * RULES THAT USE THE FULL PATIENT PASSPORT — device readings, allergies,
 * screening questionnaires and lab trends. Same contract as every other
 * rule: evidence, a plain-language explanation, and a next step phrased as a
 * question for the clinician. Only confirmed data ever reaches these.
 */

const DIZZY = /dizz|lighthead|faint|fall|unsteady/i;

/* ---- Repeated low blood pressure on 2+ blood-pressure-lowering medicines -- */
export const lowBpMultipleAgentsRule: RuleDefinition = {
  id: "vitals/low-bp-multiple-bp-meds",
  category: "drug-vitals",
  name: "Repeated low blood pressure on several blood-pressure medicines",
  description: `Looks for ${LOW_BP_MIN_READINGS}+ readings below ${LOW_BP_SYSTOLIC}/${LOW_BP_DIASTOLIC} in the last ${LOW_BP_LOOKBACK_DAYS} days (home cuff, devices or clinic) when two or more medicines that lower blood pressure are on the list.`,
  evaluate(record, ctx) {
    const meds = record.patient.medications.filter((m) => BP_LOWERING_CLASSES.has(m.class));
    if (meds.length < 2) return [];
    const readings = withinLastDays(record.patient.vitals, LOW_BP_LOOKBACK_DAYS, ctx.now).filter((v) => v.systolic !== undefined && v.diastolic !== undefined);
    const low = readings.filter((v) => v.systolic! < LOW_BP_SYSTOLIC || v.diastolic! < LOW_BP_DIASTOLIC);
    if (low.length < LOW_BP_MIN_READINGS) return [];
    const lowest = [...low].sort((a, b) => a.systolic! - b.systolic!)[0];
    const dizzy = withinLastDays(record.symptoms, LOW_BP_LOOKBACK_DAYS, ctx.now).filter((s) => DIZZY.test(s.symptom));
    const severity = lowest.systolic! < VERY_LOW_BP_SYSTOLIC || (dizzy.length >= 2 && low.length >= 5) ? "high" : "moderate";
    return [
      makeFlag(
        {
          patientId: record.patient.id, ruleId: this.id, category: "drug-vitals", severity,
          title: "Blood pressure running low on several blood-pressure medicines",
          medications: meds.map((m) => m.name),
          explanation:
            `${low.length} of your ${readings.length} blood pressure readings in the last two weeks were below ${LOW_BP_SYSTOLIC}/${LOW_BP_DIASTOLIC}, while you take ${meds.length} medicines that lower blood pressure. ` +
            "Together they may be lowering it more than intended at times, which can cause dizziness and falls.",
          suggestedNextStep: "Ask your doctor whether your blood-pressure medicines, their doses or their timing should be reviewed, and share your home readings.",
          evidence: [
            `Blood-pressure-lowering medicines: ${meds.map((m) => `${m.name} ${m.dose}`).join(", ")}.`,
            `${low.length} low readings in ${LOW_BP_LOOKBACK_DAYS} days; lowest ${lowest.systolic}/${lowest.diastolic} on ${formatDate(lowest.timestamp)} (${lowest.source.label}).`,
            ...(dizzy.length ? [`${dizzy.length} dizziness or unsteadiness entries in the same period.`] : []),
          ],
        },
        ctx,
      ),
    ];
  },
};

/* ---- Low resting heart rate on a beta-blocker ----------------------------- */
export const lowRestingHrBetaBlockerRule: RuleDefinition = {
  id: "vitals/low-resting-hr-beta-blocker",
  category: "drug-vitals",
  name: "Low resting heart rate on a beta-blocker",
  description: `Looks for a resting heart rate below ${LOW_RESTING_HR} on ${LOW_RESTING_HR_MIN_DAYS}+ days in the last ${LOW_RESTING_HR_LOOKBACK_DAYS} (from a watch or readings) when a beta-blocker is on the list.`,
  evaluate(record, ctx) {
    const bb = record.patient.medications.filter((m) => m.class === "beta-blocker");
    if (!bb.length) return [];
    const recent = withinLastDays(record.patient.vitals, LOW_RESTING_HR_LOOKBACK_DAYS, ctx.now);
    const lowDays = new Map<string, { hr: number; source: string }>();
    for (const v of recent) {
      const hr = v.restingHeartRate ?? (v.bpSetting && v.heartRate !== undefined ? v.heartRate : undefined);
      if (hr === undefined || hr >= LOW_RESTING_HR) continue;
      const d = v.timestamp.slice(0, 10);
      if (!lowDays.has(d) || hr < lowDays.get(d)!.hr) lowDays.set(d, { hr, source: v.source.label });
    }
    if (lowDays.size < LOW_RESTING_HR_MIN_DAYS) return [];
    const lowest = Math.min(...[...lowDays.values()].map((x) => x.hr));
    const tired = withinLastDays(record.symptoms, LOW_RESTING_HR_LOOKBACK_DAYS, ctx.now).filter((s) => /dizz|faint|fatigue|tired|short of breath/i.test(s.symptom));
    return [
      makeFlag(
        {
          patientId: record.patient.id, ruleId: this.id, category: "drug-vitals", severity: lowest < VERY_LOW_RESTING_HR || tired.length >= 3 ? "high" : "moderate",
          title: "Resting heart rate below 50 while taking a beta-blocker",
          medications: bb.map((m) => m.name),
          explanation:
            `Your resting heart rate was below ${LOW_RESTING_HR} beats a minute on ${lowDays.size} days in the last two weeks. ${bb.map((m) => m.name).join(" and ")} slows the heart on purpose, ` +
            "but a rate this low can sometimes cause tiredness, dizziness or fainting. Your clinician can tell whether it's expected for you.",
          suggestedNextStep: "Ask your doctor whether this heart rate is expected on your dose, and mention any tiredness, dizziness or near-fainting.",
          evidence: [
            `On the list: ${bb.map((m) => `${m.name} ${m.dose}`).join(", ")}.`,
            `Low resting heart rate on ${[...lowDays.keys()].sort().map((d) => formatDate(d)).join(", ")}; lowest ${lowest} bpm (${[...lowDays.values()][0].source}).`,
            ...(tired.length ? [`${tired.length} related symptom entries (tiredness, dizziness) in the same period.`] : []),
          ],
        },
        ctx,
      ),
    ];
  },
};

/* ---- Medicine that conflicts with a recorded allergy ----------------------- */
export const allergyConflictRule: RuleDefinition = {
  id: "allergy/medication-conflict",
  category: "drug-allergy",
  name: "Medicine that matches a recorded allergy",
  description: "Checks every medicine on your list against the allergies and intolerances in your Passport, by name and by medicine family (for example, NSAIDs).",
  evaluate(record, ctx) {
    const flags: RiskFlag[] = [];
    for (const allergy of record.allergies) {
      if (allergy.category !== "medication" || !allergy.matches) continue;
      const { genericNames = [], classes = [] } = allergy.matches;
      const hits: Medication[] = record.patient.medications.filter(
        (m) => (genericNames.length > 0 && matches(m, { kind: "generic", names: genericNames })) || (classes.length > 0 && matches(m, { kind: "class", classes })),
      );
      for (const med of hits) {
        const intolerance = allergy.type === "intolerance";
        flags.push(
          makeFlag(
            {
              patientId: record.patient.id, ruleId: `${this.id}/${allergy.id}`, category: "drug-allergy",
              severity: allergy.severity === "severe" ? "high" : intolerance || allergy.severity === "mild" ? "low" : "moderate",
              title: `${med.name} may conflict with your ${intolerance ? "intolerance" : "allergy"} to ${allergy.substance}`,
              medications: [med.name],
              explanation:
                `Your Passport records ${intolerance ? "an intolerance" : "an allergy"} to ${allergy.substance}${allergy.reaction ? ` (${allergy.reaction.toLowerCase()})` : ""}. ` +
                `${med.name} ${med.genericName !== allergy.substance.toLowerCase() && classes.includes(med.class) ? `belongs to the same family of medicines (${med.class.replace(/-/g, " ")})` : "matches it"}. ` +
                "The prescriber may already know and have chosen it on purpose — but it's important they do know.",
              suggestedNextStep: `Before your next dose, ask the prescriber or your pharmacist whether ${med.name} is safe for you given your ${allergy.substance} ${intolerance ? "intolerance" : "allergy"}.`,
              evidence: [
                `${intolerance ? "Intolerance" : "Allergy"}: ${allergy.substance}, ${allergy.severity}${allergy.reaction ? ` — ${allergy.reaction}` : ""} (${allergy.source.label}).`,
                `Medicine: ${med.name} ${med.dose} ${med.frequency}${med.prescriber ? `, prescribed by ${med.prescriber}` : ""} (${med.source.label}).`,
              ],
            },
            ctx,
          ),
        );
      }
    }
    return flags;
  },
};

/* ---- PHQ-9 rising after a medication change -------------------------------- */
export const phq9RiseAfterChangeRule: RuleDefinition = {
  id: "drug-mood/phq9-rise-after-change",
  category: "drug-mood",
  name: "Depression screening score rising after a medication change",
  description: `Compares PHQ-9 screening scores before and after each medication change in the last ${PHQ9_LOOKBACK_DAYS} days. Raises it if the score rose ${PHQ9_MEANINGFUL_RISE}+ points or moved into the Moderate range (${PHQ9_MODERATE}+). Complements the daily-mood rule.`,
  evaluate(record, ctx) {
    const phq = record.assessments.filter((a) => a.instrument === "PHQ-9").sort((a, b) => a.date.localeCompare(b.date));
    if (phq.length < 2) return [];
    const flags: RiskFlag[] = [];
    const changes = record.patient.medicationHistory.filter((e) => {
      const age = daysBetween(new Date(`${e.date}T12:00:00`), ctx.now);
      return age >= 0 && age <= PHQ9_LOOKBACK_DAYS;
    });
    for (const change of changes) {
      const before = phq.filter((a) => a.date <= change.date).pop();
      const after = phq.filter((a) => a.date > change.date);
      if (!before || !after.length) continue;
      const latest = after[after.length - 1];
      const rise = latest.score - before.score;
      if (rise < PHQ9_MEANINGFUL_RISE && !(latest.score >= PHQ9_MODERATE && before.score < PHQ9_MODERATE)) continue;
      const selfHarm = after.some((a) => (a.answers?.[8] ?? 0) > 0);
      flags.push(
        makeFlag(
          {
            patientId: record.patient.id, ruleId: `${this.id}/${change.id}`, category: "drug-mood",
            severity: latest.score >= PHQ9_HIGH || selfHarm ? "high" : "moderate",
            title: `Depression screening score went up after the ${change.medicationName} change`,
            medications: [change.medicationName],
            explanation:
              `Your PHQ-9 score was ${before.score} (${before.severity.toLowerCase()}) before ${change.medicationName} changed on ${formatDate(change.date)}, and ${latest.score} (${latest.severity.toLowerCase()}) on ${formatDate(latest.date)}. ` +
              "A screening score isn't a diagnosis, and medication changes can take weeks to settle — but a rise like this is worth talking over soon, not at a routine visit months away." +
              (selfHarm ? " One of your answers mentioned thoughts of self-harm: please reach out to your clinician, or call or text 988 any time." : ""),
            suggestedNextStep: `Ask the clinician who manages ${change.medicationName} whether you should be seen sooner, and share how you've been feeling since the change.`,
            evidence: [
              `Medication change: ${change.detail} (${formatDate(change.date)}).`,
              `PHQ-9 before: ${before.score} on ${formatDate(before.date)}. After: ${after.map((a) => `${a.score} on ${formatDate(a.date)}`).join(", ")}.`,
            ],
          },
          ctx,
        ),
      );
    }
    return flags;
  },
};

/* ---- Declining kidney function on medicines that need renal dose review --- */
export const decliningEgfrRule: RuleDefinition = {
  id: "drug-kidney/declining-egfr",
  category: "drug-kidney",
  name: "Kidney function falling on medicines that need dose review",
  description: `When eGFR is below ${EGFR_REDUCED} and has fallen by ${EGFR_DECLINE_POINTS}+ points (or ${EGFR_DECLINE_FRACTION * 100}%+) over the last year, lists medicines whose dose is usually reviewed as kidney function changes (e.g. metformin).`,
  evaluate(record, ctx) {
    const hist = labHistory(record.patient.labs, "eGFR").filter((l) => daysBetween(new Date(`${l.date}T12:00:00`), ctx.now) <= EGFR_LOOKBACK_DAYS);
    if (hist.length < 2) return [];
    const latest = hist[hist.length - 1];
    const peak = Math.max(...hist.map((l) => l.value));
    const drop = peak - latest.value;
    if (latest.value >= EGFR_REDUCED || (drop < EGFR_DECLINE_POINTS && drop / peak < EGFR_DECLINE_FRACTION)) return [];
    const involved = RENAL_REVIEW.flatMap((r) => record.patient.medications.filter((m) => matches(m, r.match)).map((m) => ({ m, note: r.note })));
    if (!involved.length) return [];
    return [
      makeFlag(
        {
          patientId: record.patient.id, ruleId: this.id, category: "drug-kidney", severity: latest.value <= EGFR_HIGH_CONCERN ? "high" : "moderate",
          title: "Kidney function is falling while you take medicines that depend on it",
          medications: involved.map((x) => x.m.name),
          explanation:
            `Your eGFR (a measure of kidney function) has gone from ${peak} to ${latest.value} over the past year. ` +
            `Some of your medicines are cleared by the kidneys: ${involved.map((x) => `${x.note}`).join("; ")}. Doses are often adjusted as kidney function changes.`,
          suggestedNextStep: `Ask your doctor whether the doses of ${involved.map((x) => x.m.name).join(" and ")} should be reviewed for your current kidney function, and when your kidneys should be checked next.`,
          evidence: [
            `eGFR results: ${hist.map((l) => `${l.value} (${formatDate(l.date)})`).join(" → ")}.`,
            `Medicines that usually need renal dose review: ${involved.map((x) => `${x.m.name} ${x.m.dose}`).join(", ")}.`,
          ],
        },
        ctx,
      ),
    ];
  },
};

export const passportRules: RuleDefinition[] = [allergyConflictRule, lowBpMultipleAgentsRule, lowRestingHrBetaBlockerRule, phq9RiseAfterChangeRule, decliningEgfrRule];
