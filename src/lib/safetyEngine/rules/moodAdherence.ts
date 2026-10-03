import type { MoodCheckIn, RiskFlag } from "../../types";
import { daysBetween, formatDate, makeFlag, mean, type RuleDefinition } from "./types";

const BASELINE_WINDOW_DAYS = 14; // mood before the change
const MIN_FOLLOWUP_DAYS = 14; // must have at least 2 weeks after the change
const LOOKBACK_FOR_CHANGES_DAYS = 60;
const MIN_DECLINE = 0.8; // points on the 1–5 scale

function moodsInRange(moods: MoodCheckIn[], from: Date, to: Date): MoodCheckIn[] {
  return moods.filter((m) => {
    const t = new Date(m.timestamp).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
}

/** Least-squares slope of mood score per day; negative = declining. */
function slopePerDay(moods: MoodCheckIn[]): number {
  if (moods.length < 3) return 0;
  const t0 = new Date(moods[0].timestamp).getTime();
  const xs = moods.map((m) => (new Date(m.timestamp).getTime() - t0) / 86_400_000);
  const ys = moods.map((m) => m.score);
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * RULE: Mood decline following a medication change.
 *
 * For every medication change in the last 60 days that has at least two
 * weeks of follow-up, compare the average mood in the two weeks before the
 * change with the average since. If mood dropped by 0.8+ points on the 1–5
 * scale, or the post-change trend is clearly downward, raise a flag. This is
 * a correlation, not a diagnosis — which is why the next step is a question
 * for the prescriber, and the flag also nudges about adherence, since low
 * mood is one of the most common reasons people stop taking medicines.
 */
export const moodAfterMedicationChangeRule: RuleDefinition = {
  id: "drug-mood/decline-after-change",
  category: "drug-mood",
  name: "Mood decline after a medication change",
  description:
    "Compares your mood check-ins in the two weeks before a medication change with the two-plus weeks after it, and flags a clear drop.",
  evaluate(record, ctx) {
    const flags: RiskFlag[] = [];
    const moods = [...record.moods].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const event of record.patient.medicationHistory) {
      const changeDate = new Date(`${event.date}T00:00:00`);
      const age = daysBetween(changeDate, ctx.now);
      if (age < MIN_FOLLOWUP_DAYS || age > LOOKBACK_FOR_CHANGES_DAYS) continue;

      const before = moodsInRange(moods, new Date(changeDate.getTime() - BASELINE_WINDOW_DAYS * 86_400_000), changeDate);
      const after = moodsInRange(moods, changeDate, ctx.now);
      if (before.length < 5 || after.length < 7) continue;

      const beforeMean = mean(before.map((m) => m.score))!;
      const afterMean = mean(after.map((m) => m.score))!;
      const decline = beforeMean - afterMean;
      const slope = slopePerDay(after);
      const lastWeek = after.filter((m) => daysBetween(new Date(m.timestamp), ctx.now) <= 7);
      const lastWeekMean = mean(lastWeek.map((m) => m.score));

      const clearDrop = decline >= MIN_DECLINE;
      const trendingDown = slope <= -0.04 && lastWeekMean !== null && lastWeekMean < beforeMean - 0.5;
      if (!clearDrop && !trendingDown) continue;

      const severity = (lastWeekMean ?? afterMean) <= 2.5 ? "high" : "moderate";
      flags.push(
        makeFlag(
          {
            patientId: record.patient.id,
            ruleId: moodAfterMedicationChangeRule.id,
            category: "drug-mood",
            severity,
            title: `Mood has dropped since ${event.medicationName} was ${event.type === "dose-changed" ? "adjusted" : event.type}`,
            medications: [event.medicationName],
            explanation:
              `Your mood check-ins averaged ${beforeMean.toFixed(1)} out of 5 in the two weeks before ${formatDate(event.date)}, when ${event.detail.replace(/\.$/, "").toLowerCase()}. Since then they average ${afterMean.toFixed(1)}` +
              (lastWeekMean !== null ? ` and ${lastWeekMean.toFixed(1)} over the last week` : "") +
              ". A change like this can be a side effect, an adjustment period, or unrelated — but low mood also makes it much harder to keep taking medicines consistently, so it is worth raising early.",
            suggestedNextStep: `Ask your doctor whether the ${event.medicationName.toLowerCase()} change could be affecting your mood, and mention if you have missed any doses.`,
            evidence: [
              `${event.medicationName}: ${event.detail} (${formatDate(event.date)}).`,
              `Average mood before: ${beforeMean.toFixed(2)} (${before.length} check-ins). After: ${afterMean.toFixed(2)} (${after.length} check-ins).`,
              `Trend since change: ${slope.toFixed(3)} points/day.`,
            ],
          },
          ctx,
        ),
      );
    }
    return flags;
  },
};

export const moodRules: RuleDefinition[] = [moodAfterMedicationChangeRule];
