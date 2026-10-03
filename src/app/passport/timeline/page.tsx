"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceBadges, SOURCE_STYLES } from "@/components/passport/SourceBadge";
import { EmptyState, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { TIMELINE_CATEGORY_LABELS, buildTimeline, filterTimeline, type TimelineCategory } from "@/lib/passport/timeline";
import type { SourceKind } from "@/lib/types";

const CATEGORIES = Object.keys(TIMELINE_CATEGORY_LABELS) as TimelineCategory[];
const DEFAULT_CATEGORIES = CATEGORIES.filter((c) => c !== "daily-log");

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-11 rounded-full px-3.5 text-sm font-medium ring-1 transition ${
        on ? "bg-brand-700 text-white ring-brand-700" : "bg-surface text-ink-soft ring-line hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function TimelinePage() {
  const { record, now } = usePatient();
  const all = useMemo(() => buildTimeline(record, now), [record, now]);
  const [categories, setCategories] = useState<TimelineCategory[]>(DEFAULT_CATEGORIES);
  const [sources, setSources] = useState<SourceKind[]>([]);

  const presentSources = useMemo(() => [...new Set(all.flatMap((e) => e.sources.map((s) => s.kind)))], [all]);
  const events = filterTimeline(all, { categories, sourceKinds: sources });
  const upcoming = events.filter((e) => e.upcoming).reverse();
  const past = events.filter((e) => !e.upcoming);

  const groups = new Map<string, typeof past>();
  for (const e of past) {
    const k = fmtDate(e.when.slice(0, 10), { month: "long", year: "numeric" });
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Show</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} on={categories.includes(c)} onClick={() => setCategories((l) => toggle(l, c))}>
                {TIMELINE_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">From source</legend>
          <div className="flex flex-wrap gap-2">
            <Chip on={sources.length === 0} onClick={() => setSources([])}>All sources</Chip>
            {presentSources.map((k) => (
              <Chip key={k} on={sources.includes(k)} onClick={() => setSources((l) => toggle(l, k))}>
                {SOURCE_STYLES[k].short}
              </Chip>
            ))}
          </div>
        </fieldset>
      </Card>

      {events.length === 0 && <EmptyState>Nothing matches these filters.</EmptyState>}

      {upcoming.length > 0 && (
        <section aria-labelledby="tl-upcoming">
          <h2 id="tl-upcoming" className="mb-2 font-serif text-lg font-semibold text-navy">Coming up</h2>
          <ol className="space-y-2">
            {upcoming.map((e) => <Row key={e.id} e={e} />)}
          </ol>
        </section>
      )}

      {[...groups.entries()].map(([month, list]) => (
        <section key={month} aria-label={month}>
          <h2 className="mb-2 font-serif text-lg font-semibold text-navy">{month}</h2>
          <ol className="space-y-2">
            {list.map((e) => <Row key={e.id} e={e} />)}
          </ol>
        </section>
      ))}
      <Disclaimer />
    </div>
  );
}

function Row({ e }: { e: ReturnType<typeof buildTimeline>[number] }) {
  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            {TIMELINE_CATEGORY_LABELS[e.category]} · {fmtDate(e.when.slice(0, 10), { month: "short", day: "numeric" })}
          </p>
          <p className="mt-0.5 font-medium text-ink">{e.title}</p>
          {e.detail && <p className="mt-0.5 text-sm text-ink-muted">{e.detail}</p>}
        </div>
        <SourceBadges sources={e.sources} />
      </div>
    </>
  );
  return (
    <li>
      {e.href ? (
        <Link href={e.href} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-brand-300">{body}</Link>
      ) : (
        <div className="rounded-xl border border-line bg-surface px-4 py-3">{body}</div>
      )}
    </li>
  );
}
