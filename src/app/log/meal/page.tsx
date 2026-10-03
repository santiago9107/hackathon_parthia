"use client";

import { useState } from "react";
import { ChipGroup, ChoiceGroup, Form, FormPage, SavedPanel, SubmitBar, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { demoTimestamp } from "@/lib/mockData";
import { addEntries } from "@/lib/passport/actions";
import { newId } from "@/lib/passport/ops";
import { youSource } from "@/lib/log/entries";
import type { NutritionEntry, NutritionTag } from "@/lib/types";

/** The same closed set of tags the safety rules understand. */
const TAGS: { value: NutritionTag; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "high-vitamin-k", label: "Leafy greens (vitamin K)" },
  { value: "grapefruit", label: "Grapefruit" },
  { value: "high-sodium", label: "Salty" },
  { value: "high-sugar", label: "Sweet" },
  { value: "high-potassium", label: "High potassium" },
  { value: "alcohol", label: "Alcohol" },
  { value: "caffeine", label: "Caffeine" },
];

const MEALS: { value: NutritionEntry["meal"]; label: string; icon: string }[] = [
  { value: "breakfast", label: "Breakfast", icon: "🌅" },
  { value: "lunch", label: "Lunch", icon: "🥪" },
  { value: "dinner", label: "Dinner", icon: "🍲" },
  { value: "snack", label: "Snack", icon: "🍎" },
];

export default function MealPage() {
  const { patientId } = usePatient();
  const [meal, setMeal] = useState<NutritionEntry["meal"] | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<NutritionTag[]>([]);
  const [errs, setErrs] = useState<{ meal?: string; description?: string }>({});
  const [saved, setSaved] = useState(false);
  const { busy, error, save } = useSave();

  async function submit() {
    const e = { meal: meal ? undefined : "Which meal was it?", description: description.trim() ? undefined : "What did you have? A few words is enough." };
    setErrs(e);
    if (e.meal || e.description) return;
    const entry: NutritionEntry = { id: newId("nu-you"), patientId, timestamp: demoTimestamp(), meal: meal!, description: description.trim(), tags, source: youSource() };
    if (await save(() => addEntries(patientId, "nutrition", [entry], `Meal: ${entry.description}`))) setSaved(true);
  }

  return (
    <FormPage title="Log a meal" subtitle="Food can change how some medicines work. Even a one-line entry helps.">
      {saved ? (
        <SavedPanel title="Meal saved" onAnother={() => { setSaved(false); setMeal(null); setDescription(""); setTags([]); }} links={[{ href: "/passport/nutrition/", label: "See nutrition" }, { href: "/", label: "Home" }]} />
      ) : (
        <Form label="Log a meal" onSubmit={submit}>
          <ChoiceGroup legend="Meal" columns={2} value={meal} onChange={(v) => { setMeal(v); setErrs((x) => ({ ...x, meal: undefined })); }} error={errs.meal} options={MEALS} />
          <TextField label="What did you have?" value={description} onChange={setDescription} error={errs.description} placeholder="e.g. Spinach salad with chicken" />
          <ChipGroup legend="Tags" hint="Pick any that apply — these are what the safety check looks for." options={TAGS} value={tags} onChange={setTags} />
          <SubmitBar label="Save meal" busy={busy} error={error} />
        </Form>
      )}
    </FormPage>
  );
}
