"use client";

import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, TextLink, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { withinLastDays } from "@/lib/safetyEngine/rules/types";
import type { NutritionTag } from "@/lib/types";

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
  for (const n of [...last14].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    const k = n.timestamp.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), n]);
  }

  return (
    <div className="space-y-6">
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
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ink-soft"><span className="capitalize text-ink-muted">{m.meal}:</span> {m.description}</span>
                      <SourceBadge source={m.source} compact />
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
