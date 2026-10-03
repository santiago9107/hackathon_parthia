"use client";

import Image from "next/image";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, TextLink, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { buildFoodGuidance } from "@/lib/nutrition/guidance";
import { withinLastDays } from "@/lib/safetyEngine/rules/types";
import type { NutrientEstimate, NutritionTag } from "@/lib/types";

const TAG_LABELS: Record<NutritionTag, string> = {
  "high-vitamin-k": "High vitamin K (leafy greens)",
  grapefruit: "Grapefruit",
  "high-sodium": "Salty",
  "high-sugar": "Sweet",
  "high-potassium": "High potassium",
  alcohol: "Alcohol",
  caffeine: "Caffeine",
  balanced: "Balanced",
};

export default function NutritionPage() {
  const { record, now } = usePatient();
  const p = record.nutritionProfile;
  const last28 = withinLastDays(record.nutrition, 28, now);
  const last14 = withinLastDays(record.nutrition, 14, now);
  const loggedDays = new Set(last28.map((n) => n.timestamp.slice(0, 10))).size;
  const tagDays = (Object.keys(TAG_LABELS) as NutritionTag[])
    .map((t) => ({ tag: t, days: new Set(last28.filter((n) => n.tags.includes(t)).map((n) => n.timestamp.slice(0, 10))).size }))
    .filter((t) => t.days > 0)
    .sort((a, b) => b.days - a.days);
  const byDay = new Map<string, typeof last14>();
  const guidance = buildFoodGuidance(record);
  for (const n of [...last14].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    const k = n.timestamp.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), n]);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5" accent="border-l-brand-500">
        <SectionTitle>Food guide for this Passport</SectionTitle>
        <p className="mb-4 text-sm text-ink-soft">Starting points from confirmed conditions, medicines and allergies — not a prescribed diet or a substitute for a dietitian.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {guidance.map((item) => (
            <article key={item.id} className={`rounded-xl border p-4 ${item.kind === "caution" ? "border-gold-200 bg-gold-50/50" : "border-brand-100 bg-brand-50/50"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${item.kind === "caution" ? "text-[#7a5812]" : "text-brand-700"}`}>{item.kind === "caution" ? "Use caution" : "Foods to consider"}</p>
              <h3 className="mt-1 font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{item.detail}</p>
              <p className="mt-2 text-xs text-ink-muted">Why this appears: {item.basis}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          General framework: <a href="https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">Dietary Guidelines for Americans</a>
          {" · "}<a href="https://www.nhlbi.nih.gov/health/dash-eating-plan" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">NIH DASH eating plan</a>
        </p>
      </Card>

      <Card className="p-5">
        <SectionTitle action={<TextLink href="/log/nutrition-profile/">Edit</TextLink>}>My nutrition profile</SectionTitle>
        {!p ? (
          <EmptyState action={<TextLink href="/log/nutrition-profile/">Describe how you eat</TextLink>}>No nutrition profile yet.</EmptyState>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-ink"><span className="text-ink-muted">Dietary pattern: </span>{p.dietaryPattern}</p>
              <SourceBadge source={p.source} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <List title="Limits and restrictions" items={p.restrictions} />
              <List title="Food allergies & intolerances" items={p.intolerances} empty="None recorded" />
              <List title="Goals" items={p.goals} />
            </div>
            {p.dietitianNotes.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">Dietitian notes</h3>
                <ul className="space-y-2">
                  {p.dietitianNotes.map((n) => (
                    <li key={n.date + n.author} className="rounded-xl bg-cream/60 p-3">
                      <p className="text-ink-soft">“{n.note}”</p>
                      <p className="mt-1 text-xs text-ink-muted">{n.author} · {fmtDate(n.date)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>Patterns (last 4 weeks)</SectionTitle>
        <p className="mb-3 text-sm text-ink-soft">Meals logged on <strong>{loggedDays} of 28 days</strong>.</p>
        {tagDays.length === 0 ? <EmptyState>No meals logged in the last four weeks.</EmptyState> : (
          <ul className="space-y-2">
            {tagDays.map((t) => (
              <li key={t.tag} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[14rem_1fr_3rem]">
                <span className="text-ink-soft">{TAG_LABELS[t.tag]}</span>
                <span className="h-2.5 rounded-full bg-cream-dark" aria-hidden>
                  <span className="block h-2.5 rounded-full bg-brand-500" style={{ width: `${(t.days / 28) * 100}%` }} />
                </span>
                <span className="text-right text-ink-muted">{t.days} d</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle action={<TextLink href="/log/meal/">Log a meal</TextLink>}>Daily log (last 2 weeks)</SectionTitle>
        {byDay.size === 0 ? <EmptyState>No meals logged in the last two weeks.</EmptyState> : (
          <ul className="divide-y divide-line">
            {[...byDay.entries()].map(([day, meals]) => (
              <li key={day} className="py-3 text-sm">
                <p className="mb-1 font-semibold text-ink">{fmtDate(day, { weekday: "short", month: "short", day: "numeric" })}</p>
                <ul className="space-y-1">
                  {meals.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 rounded-xl py-1">
                      {m.photoDataUrl && <Image src={m.photoDataUrl} alt="" width={88} height={66} unoptimized className="h-[66px] w-[88px] shrink-0 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-ink-soft"><span className="capitalize text-ink-muted">{m.meal}:</span> {m.description}{m.portion ? ` · ${m.portion}` : ""}</span>
                          <SourceBadge source={m.source} compact />
                        </div>
                        {m.ingredients && <p className="mt-1 text-xs text-ink-muted">Ingredients: {m.ingredients.join(", ")}</p>}
                        {m.estimatedNutrients && <p className="mt-1 text-xs font-medium text-brand-800">{nutrientSummary(m.estimatedNutrients)}</p>}
                        {m.tags.length > 0 && <p className="mt-1 text-xs text-ink-muted">{m.tags.map((tag) => TAG_LABELS[tag]).join(" · ")}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Disclaimer />
    </div>
  );
}

function nutrientSummary(nutrients: NutrientEstimate): string {
  return [
    nutrients.caloriesKcal !== undefined && `${nutrients.caloriesKcal} kcal`,
    nutrients.proteinG !== undefined && `${nutrients.proteinG} g protein`,
    nutrients.carbohydratesG !== undefined && `${nutrients.carbohydratesG} g carbs`,
    nutrients.sodiumMg !== undefined && `${nutrients.sodiumMg} mg sodium`,
    nutrients.sugarG !== undefined && `${nutrients.sugarG} g sugar`,
    nutrients.potassiumMg !== undefined && `${nutrients.potassiumMg} mg potassium`,
    nutrients.vitaminKMcg !== undefined && `${nutrients.vitaminKMcg} mcg vitamin K`,
  ].filter(Boolean).join(" · ");
}

function List({ title, items, empty = "—" }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</h3>
      {items.length === 0 ? <p className="text-ink-muted">{empty}</p> : (
        <ul className="list-disc space-y-1 pl-4 text-ink-soft">{items.map((i) => <li key={i}>{i}</li>)}</ul>
      )}
    </div>
  );
}
