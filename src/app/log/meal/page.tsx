"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { ChipGroup, ChoiceGroup, Form, FormPage, SavedPanel, SubmitBar, TextArea, TextField, useSave } from "@/components/log/FormKit";
import { usePatient } from "@/lib/context/PatientContext";
import { buildNutritionEntry, validateNutrition, type NutritionErrors, type NutritionInput } from "@/lib/log/entries";
import { demoTimestamp } from "@/lib/mockData";
import { compactMealPhoto } from "@/lib/nutrition/photo";
import { applyMealRecognition, recognizeMeal, type MealRecognition } from "@/lib/nutrition/recognition";
import { addEntries } from "@/lib/passport/actions";
import type { NutritionEntry, NutritionTag } from "@/lib/types";

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

const EMPTY: NutritionInput = {
  meal: null, description: "", tags: [], tagsConfirmed: false, portion: "", ingredients: "",
  caloriesKcal: "", proteinG: "", carbohydratesG: "", sodiumMg: "", sugarG: "", potassiumMg: "", vitaminKMcg: "",
};

export default function MealPage() {
  const { patientId, record } = usePatient();
  const [input, setInput] = useState<NutritionInput>(EMPTY);
  const [errs, setErrs] = useState<NutritionErrors>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealRecognition | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, save } = useSave();

  const update = <K extends keyof NutritionInput>(key: K, value: NutritionInput[K]) => {
    const needsReview = key === "description" || key === "tags";
    setInput((current) => ({ ...current, [key]: value, ...(needsReview ? { tagsConfirmed: false } : {}) }));
    setErrs((current) => ({ ...current, [key]: undefined, ...(needsReview ? { confirmation: undefined } : {}) }));
  };

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      update("photoDataUrl", await compactMealPhoto(file));
    } catch (reason) {
      setPhotoError(reason instanceof Error ? reason.message : "That photo could not be opened.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function analyzePhoto() {
    if (!input.photoDataUrl) return;
    setAnalysisBusy(true);
    setAnalysisError(null);
    try {
      const result = await recognizeMeal(input.photoDataUrl);
      setAnalysis(result);
      setInput((current) => applyMealRecognition(current, result));
      setErrs({});
    } catch (reason) {
      setAnalysisError(reason instanceof Error ? reason.message : "The AI could not analyze this photo.");
    } finally {
      setAnalysisBusy(false);
    }
  }

  async function submit() {
    const validation = validateNutrition(input);
    setErrs(validation);
    if (Object.keys(validation).length) return;
    const entry = buildNutritionEntry(input, patientId, demoTimestamp());
    if (await save(() => addEntries(patientId, "nutrition", [entry], `Meal: ${entry.description}`))) setSaved(true);
  }

  function reset() {
    setInput(EMPTY);
    setErrs({});
    setPhotoError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setSaved(false);
  }

  return (
    <FormPage title="Log a meal" subtitle="Snap the meal, let AI suggest what it contains, then review every field before saving.">
      {saved ? (
        <SavedPanel title="Meal saved" onAnother={reset} links={[{ href: "/passport/nutrition/", label: "See nutrition" }, { href: "/", label: "Home" }]}>
          The photo and the values you confirmed are now part of your food history.
        </SavedPanel>
      ) : (
        <Form label="Log a meal" onSubmit={submit}>
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-serif text-lg font-semibold text-navy">Meal photo</h2>
            <p className="mt-1 text-sm text-ink-muted">The app keeps a compact preview. It is sent to OpenAI only if you tap Analyze with AI; the original file is never uploaded.</p>
            {input.photoDataUrl && (
              <div className="relative mt-3 aspect-[4/3] max-h-80 overflow-hidden rounded-xl bg-cream-dark">
                <Image src={input.photoDataUrl} alt="Meal preview" fill unoptimized className="object-cover" sizes="(max-width: 640px) 100vw, 640px" />
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only" tabIndex={-1} aria-label="Take a food photo" />
            <input ref={fileRef} type="file" accept="image/*" onChange={choosePhoto} className="sr-only" tabIndex={-1} aria-label="Choose a food photo" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={photoBusy} onClick={() => cameraRef.current?.click()} className="min-h-11 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{photoBusy ? "Preparing…" : "Take photo"}</button>
              <button type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()} className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold text-brand-700 ring-1 ring-line">Choose photo</button>
              {input.photoDataUrl && <button type="button" disabled={analysisBusy} onClick={analyzePhoto} className="min-h-11 rounded-full bg-gold-100 px-4 text-sm font-semibold text-[#5c430d] ring-1 ring-gold-200 disabled:opacity-60">{analysisBusy ? "Analyzing…" : analysis ? "Analyze again" : "Analyze with AI"}</button>}
              {input.photoDataUrl && <button type="button" onClick={() => { update("photoDataUrl", undefined); setAnalysis(null); setAnalysisError(null); }} className="min-h-11 rounded-full px-4 text-sm font-semibold text-ink-muted ring-1 ring-line">Remove</button>}
            </div>
            {(photoError || errs.photoDataUrl) && <p role="alert" className="mt-2 text-sm font-medium text-attention">{photoError ?? errs.photoDataUrl}</p>}
            {analysisError && <p role="alert" className="mt-3 rounded-lg bg-attention-soft p-3 text-sm font-medium text-attention">{analysisError}</p>}
            {analysis && (
              <div className="mt-3 rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm text-ink-soft">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-ink">AI suggestions added for review</strong>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{analysis.confidence} confidence</span>
                </div>
                {analysis.possibleAllergens.length > 0 && <p className="mt-2"><strong>Possible allergens:</strong> {analysis.possibleAllergens.join(", ")}.</p>}
                {analysis.uncertainties.length > 0 && <p className="mt-1"><strong>Uncertain:</strong> {analysis.uncertainties.join("; ")}.</p>}
                {record.allergies.some((allergy) => allergy.category === "food" && allergy.source.verified) && (
                  <p className="mt-2 font-medium text-attention">Your Passport lists food allergies. AI cannot verify hidden ingredients or cross-contact—check the label or preparer.</p>
                )}
              </div>
            )}
          </section>

          <ChoiceGroup legend="Meal" columns={2} value={input.meal} onChange={(value) => update("meal", value)} error={errs.meal} options={MEALS} />
          <TextField label="What did you have?" value={input.description} onChange={(value) => update("description", value)} error={errs.description} placeholder="e.g. spinach salad with chicken" />
          <TextField label="Portion" value={input.portion} onChange={(value) => update("portion", value)} optional placeholder="e.g. 1 bowl or about 2 cups" />
          <TextArea label="Known ingredients" value={input.ingredients} onChange={(value) => update("ingredients", value)} hint="Separate ingredients with commas. Include sauces, toppings and packaged ingredients when you know them." placeholder="spinach, chicken, walnuts, vinaigrette" />
          <ChipGroup legend="Food tags" hint="Choose only what you recognize. These tags power medication-food checks." options={TAGS} value={input.tags} onChange={(value) => update("tags", value)} />

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-serif text-lg font-semibold text-navy">Nutrients from a label or estimate <span className="font-sans text-sm font-normal text-ink-muted">(optional)</span></h2>
            <p className="mt-1 text-sm text-ink-muted">AI estimates can be substantially wrong because portions and hidden ingredients are difficult to see. Edit or clear any value you cannot confirm.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="Calories" value={input.caloriesKcal} onChange={(value) => update("caloriesKcal", value)} error={errs.caloriesKcal} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">kcal</span>} />
              <TextField label="Protein" value={input.proteinG} onChange={(value) => update("proteinG", value)} error={errs.proteinG} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">g</span>} />
              <TextField label="Carbohydrates" value={input.carbohydratesG} onChange={(value) => update("carbohydratesG", value)} error={errs.carbohydratesG} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">g</span>} />
              <TextField label="Sodium" value={input.sodiumMg} onChange={(value) => update("sodiumMg", value)} error={errs.sodiumMg} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">mg</span>} />
              <TextField label="Sugar" value={input.sugarG} onChange={(value) => update("sugarG", value)} error={errs.sugarG} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">g</span>} />
              <TextField label="Potassium" value={input.potassiumMg} onChange={(value) => update("potassiumMg", value)} error={errs.potassiumMg} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">mg</span>} />
              <TextField label="Vitamin K" value={input.vitaminKMcg} onChange={(value) => update("vitaminKMcg", value)} error={errs.vitaminKMcg} optional type="number" inputMode="decimal" min="0" suffix={<span className="flex items-center text-sm text-ink-muted">mcg</span>} />
            </div>
          </section>

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${errs.confirmation ? "border-attention" : "border-line-strong"}`}>
            <input type="checkbox" checked={input.tagsConfirmed} onChange={(event) => update("tagsConfirmed", event.target.checked)} className="mt-1 h-5 w-5 accent-brand-700" />
            <span className="text-sm text-ink-soft">
              <strong className="block text-ink">I reviewed the description, ingredients and tags.</strong>
              A photo cannot prove a meal is allergen-free. If an allergy is serious or ingredients are uncertain, check the label or ask the preparer.
            </span>
          </label>
          {errs.confirmation && <p className="-mt-3 text-sm font-medium text-attention">{errs.confirmation}</p>}

          <SubmitBar label="Save confirmed meal" busy={busy || photoBusy} error={error} />
        </Form>
      )}
    </FormPage>
  );
}
