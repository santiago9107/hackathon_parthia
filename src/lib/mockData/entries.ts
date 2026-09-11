import type {
  MoodCheckIn,
  NutritionEntry,
  NutritionTag,
  PatientId,
  Scale1to5,
  SymptomEntry,
} from "../types";

/**
 * SYNTHETIC daily entries for the three personas.
 *
 * Generated deterministically (seeded PRNG) so the demo looks the same every
 * time. Each persona has a hand-designed "story" that the safety engine
 * should be able to pick up:
 *
 *  - Harold:   swings between kale-heavy and no-greens days (vitamin K
 *              variability on warfarin), and grapefruit juice a few mornings.
 *  - Margaret: mood ~4 until her sertraline dose changed on 22 Aug, then a
 *              steady slide to ~2; dry mouth / fogginess symptoms.
 *  - Rosa:     logs nutrition for a few days, then goes quiet for several;
 *              early metformin stomach upset that fades.
 */

/** Fixed "today" so the demo is stable regardless of the real clock. */
export const REFERENCE_DATE = "2026-09-11";
const DAYS_OF_HISTORY = 35;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayString(daysBeforeReference: number): string {
  const d = new Date(`${REFERENCE_DATE}T12:00:00`);
  d.setDate(d.getDate() - daysBeforeReference);
  return d.toISOString().slice(0, 10);
}

function at(date: string, hour: number, minute = 0): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function clamp1to5(n: number): Scale1to5 {
  return Math.max(1, Math.min(5, Math.round(n))) as Scale1to5;
}

interface Meal {
  meal: NutritionEntry["meal"];
  description: string;
  tags: NutritionTag[];
}

const MEALS = {
  balancedBreakfast: [
    { meal: "breakfast", description: "Oatmeal with blueberries and walnuts", tags: ["balanced"] },
    { meal: "breakfast", description: "Scrambled eggs, whole-grain toast", tags: ["balanced"] },
    { meal: "breakfast", description: "Greek yogurt with sliced almonds", tags: ["balanced"] },
  ] as Meal[],
  grapefruitBreakfast: [
    { meal: "breakfast", description: "Grapefruit juice, toast with butter", tags: ["grapefruit"] },
    { meal: "breakfast", description: "Half a grapefruit, boiled egg", tags: ["grapefruit"] },
  ] as Meal[],
  greensLunch: [
    { meal: "lunch", description: "Large kale salad with grilled chicken", tags: ["high-vitamin-k", "balanced"] },
    { meal: "lunch", description: "Spinach and feta wrap", tags: ["high-vitamin-k"] },
    { meal: "dinner", description: "Sautéed broccoli and brussels sprouts with salmon", tags: ["high-vitamin-k", "balanced"] },
  ] as Meal[],
  noGreensLunch: [
    { meal: "lunch", description: "Turkey sandwich on white bread, chips", tags: ["high-sodium"] },
    { meal: "lunch", description: "Cheese pizza, two slices", tags: ["high-sodium"] },
    { meal: "lunch", description: "Chicken noodle soup, crackers", tags: ["high-sodium"] },
  ] as Meal[],
  dinner: [
    { meal: "dinner", description: "Baked chicken, brown rice, carrots", tags: ["balanced"] },
    { meal: "dinner", description: "Grilled fish, roasted potatoes", tags: ["balanced"] },
    { meal: "dinner", description: "Beef stew with bread", tags: ["high-sodium"] },
    { meal: "dinner", description: "Pasta with tomato sauce", tags: [] },
  ] as Meal[],
  sweetSnack: [
    { meal: "snack", description: "Pan dulce and sweetened coffee", tags: ["high-sugar", "caffeine"] },
    { meal: "snack", description: "Two cookies and orange juice", tags: ["high-sugar"] },
    { meal: "snack", description: "Ice cream", tags: ["high-sugar"] },
  ] as Meal[],
  potassiumSnack: [
    { meal: "snack", description: "Two bananas", tags: ["high-potassium"] },
    { meal: "snack", description: "Baked potato with low-sodium salt substitute", tags: ["high-potassium"] },
  ] as Meal[],
  alcohol: [
    { meal: "dinner", description: "Glass of red wine with dinner", tags: ["alcohol"] },
    { meal: "dinner", description: "Two beers with tacos", tags: ["alcohol", "high-sodium"] },
  ] as Meal[],
};

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

interface Generated {
  symptoms: SymptomEntry[];
  moods: MoodCheckIn[];
  nutrition: NutritionEntry[];
}

function generateHarold(): Generated {
  const patientId: PatientId = "p-harold";
  const rand = mulberry32(11);
  const out: Generated = { symptoms: [], moods: [], nutrition: [] };
  let n = 0;

  for (let d = DAYS_OF_HISTORY; d >= 0; d--) {
    const date = dayString(d);
    // Mood: steady, 3–4.
    out.moods.push({
      id: `mo-h-${n++}`,
      patientId,
      timestamp: at(date, 20, 30),
      score: clamp1to5(3.6 + (rand() - 0.5) * 1.4),
    });

    // Breakfast: grapefruit some mornings (days 3, 10, 17, 24 before today).
    const grapefruitDay = d % 7 === 3;
    const breakfast = grapefruitDay ? pick(rand, MEALS.grapefruitBreakfast) : pick(rand, MEALS.balancedBreakfast);
    out.nutrition.push({ id: `nu-h-${n++}`, patientId, timestamp: at(date, 7, 45), ...breakfast });

    // Lunch/dinner: alternating "greens weeks" (kale, spinach) and "no greens".
    const greensWeek = Math.floor(d / 7) % 2 === 0;
    if (greensWeek && rand() < 0.85) {
      out.nutrition.push({ id: `nu-h-${n++}`, patientId, timestamp: at(date, 12, 30), ...pick(rand, MEALS.greensLunch) });
    } else {
      out.nutrition.push({ id: `nu-h-${n++}`, patientId, timestamp: at(date, 12, 30), ...pick(rand, MEALS.noGreensLunch) });
    }
    if (rand() < 0.8) {
      out.nutrition.push({ id: `nu-h-${n++}`, patientId, timestamp: at(date, 18, 45), ...pick(rand, MEALS.dinner) });
    }

    // Symptoms: bruising more often after aspirin was added (22 days ago), mild dizziness occasionally.
    const aspirinStarted = d <= 22;
    if (aspirinStarted && rand() < 0.35) {
      out.symptoms.push({ id: `sy-h-${n++}`, patientId, timestamp: at(date, 9, 0), symptom: "Bruising easily", severity: clamp1to5(2 + rand() * 1.5), note: "Noticed new bruises on forearm." });
    }
    if (rand() < 0.15) {
      out.symptoms.push({ id: `sy-h-${n++}`, patientId, timestamp: at(date, 10, 15), symptom: "Dizziness on standing", severity: clamp1to5(1.5 + rand()) });
    }
    if (d === 6) {
      out.symptoms.push({ id: `sy-h-${n++}`, patientId, timestamp: at(date, 21, 0), symptom: "Nosebleed", severity: 2, note: "Stopped after a few minutes." });
    }
  }
  return out;
}

function generateMargaret(): Generated {
  const patientId: PatientId = "p-margaret";
  const rand = mulberry32(72);
  const out: Generated = { symptoms: [], moods: [], nutrition: [] };
  let n = 0;
  const DOSE_CHANGE_DAYS_AGO = 20; // 2026-08-22

  for (let d = DAYS_OF_HISTORY; d >= 0; d--) {
    const date = dayString(d);

    // Mood: ~4 before dose change, then a gradual decline to ~2.
    let baseline: number;
    if (d > DOSE_CHANGE_DAYS_AGO) baseline = 3.9;
    else {
      const daysSince = DOSE_CHANGE_DAYS_AGO - d;
      baseline = Math.max(1.9, 3.7 - daysSince * 0.09);
    }
    if (rand() < 0.9) {
      out.moods.push({
        id: `mo-m-${n++}`,
        patientId,
        timestamp: at(date, 21, 0),
        score: clamp1to5(baseline + (rand() - 0.5) * 0.9),
        note: d === 4 ? "Didn't feel like getting out of bed." : undefined,
      });
    }

    // Nutrition: reasonably consistent, higher sodium.
    out.nutrition.push({ id: `nu-m-${n++}`, patientId, timestamp: at(date, 8, 0), ...pick(rand, MEALS.balancedBreakfast) });
    if (rand() < 0.75) out.nutrition.push({ id: `nu-m-${n++}`, patientId, timestamp: at(date, 12, 45), ...pick(rand, MEALS.noGreensLunch) });
    if (rand() < 0.85) out.nutrition.push({ id: `nu-m-${n++}`, patientId, timestamp: at(date, 18, 30), ...pick(rand, MEALS.dinner) });

    // Symptoms: anticholinergic-type (dry mouth, fogginess) increasing; fatigue.
    if (rand() < 0.4) {
      out.symptoms.push({ id: `sy-m-${n++}`, patientId, timestamp: at(date, 9, 30), symptom: "Dry mouth", severity: clamp1to5(2 + rand() * 1.5) });
    }
    if (d <= DOSE_CHANGE_DAYS_AGO && rand() < 0.45) {
      out.symptoms.push({ id: `sy-m-${n++}`, patientId, timestamp: at(date, 14, 0), symptom: "Forgetful / foggy", severity: clamp1to5(2.5 + rand() * 1.5), note: d === 2 ? "Missed my afternoon pills twice this week." : undefined });
    }
    if (rand() < 0.5) {
      out.symptoms.push({ id: `sy-m-${n++}`, patientId, timestamp: at(date, 16, 0), symptom: "Fatigue", severity: clamp1to5(2.5 + rand() * 1.5) });
    }
    if (d <= 10 && rand() < 0.3) {
      out.symptoms.push({ id: `sy-m-${n++}`, patientId, timestamp: at(date, 7, 30), symptom: "Dizziness on standing", severity: clamp1to5(2 + rand() * 1.5) });
    }
  }
  return out;
}

function generateRosa(): Generated {
  const patientId: PatientId = "p-rosa";
  const rand = mulberry32(65);
  const out: Generated = { symptoms: [], moods: [], nutrition: [] };
  let n = 0;

  // Logging pattern: logs for ~3 days, then silent for 3–5 days.
  const loggedDays = new Set<number>();
  let d = DAYS_OF_HISTORY;
  while (d >= 0) {
    const onDays = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < onDays && d >= 0; k++, d--) loggedDays.add(d);
    d -= 3 + Math.floor(rand() * 3);
  }

  for (let day = DAYS_OF_HISTORY; day >= 0; day--) {
    const date = dayString(day);
    // Mood: dip around diagnosis, recovering. Checked in most days.
    const baseline = day > 28 ? 2.8 : 3.4 + (35 - day) * 0.02;
    if (rand() < 0.8) {
      out.moods.push({ id: `mo-r-${n++}`, patientId, timestamp: at(date, 21, 15), score: clamp1to5(baseline + (rand() - 0.5) * 1.2) });
    }

    if (loggedDays.has(day)) {
      out.nutrition.push({ id: `nu-r-${n++}`, patientId, timestamp: at(date, 7, 30), ...pick(rand, MEALS.balancedBreakfast) });
      if (rand() < 0.7) out.nutrition.push({ id: `nu-r-${n++}`, patientId, timestamp: at(date, 13, 0), ...pick(rand, MEALS.noGreensLunch) });
      if (rand() < 0.5) out.nutrition.push({ id: `nu-r-${n++}`, patientId, timestamp: at(date, 16, 0), ...pick(rand, MEALS.sweetSnack) });
      if (rand() < 0.3) out.nutrition.push({ id: `nu-r-${n++}`, patientId, timestamp: at(date, 10, 30), ...pick(rand, MEALS.potassiumSnack) });
      if (rand() < 0.2) out.nutrition.push({ id: `nu-r-${n++}`, patientId, timestamp: at(date, 19, 0), ...pick(rand, MEALS.alcohol) });
      else if (rand() < 0.7) out.nutrition.push({ id: `nu-r-${n++}`, patientId, timestamp: at(date, 19, 0), ...pick(rand, MEALS.dinner) });
    }

    // Metformin started 39 days ago; stomach upset fades over the first 3 weeks.
    const metforminUpset = Math.max(0, 0.7 - (35 - day) * 0.03);
    if (rand() < metforminUpset) {
      out.symptoms.push({ id: `sy-r-${n++}`, patientId, timestamp: at(date, 13, 30), symptom: "Nausea / stomach upset", severity: clamp1to5(2 + rand() * 1.5), note: "After lunch." });
    }
    if (rand() < 0.12) {
      out.symptoms.push({ id: `sy-r-${n++}`, patientId, timestamp: at(date, 15, 0), symptom: "Headache", severity: clamp1to5(1.5 + rand() * 1.5) });
    }
  }
  return out;
}

const generated: Record<PatientId, Generated> = {
  "p-harold": generateHarold(),
  "p-margaret": generateMargaret(),
  "p-rosa": generateRosa(),
};

export function entriesFor(patientId: PatientId): Generated {
  return generated[patientId] ?? { symptoms: [], moods: [], nutrition: [] };
}
