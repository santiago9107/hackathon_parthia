"use client";

import { useState } from "react";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceIcon } from "@/components/passport/SourceBadge";
import { EmptyState, LocalOnlyNotice, fmtDateTime } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import type { ActivityEntry } from "@/lib/types";

const ACTION_LABELS: Record<ActivityEntry["action"], string> = {
  import: "Imported",
  add: "Added",
  edit: "Edited",
  confirm: "Confirmed",
  discard: "Discarded",
  export: "Exported",
  share: "Shared",
  restore: "Restored",
  lock: "Locked",
  unlock: "Unlocked",
  reset: "Reset",
};

export default function ActivityPage() {
  const { local } = usePatient();
  const [filter, setFilter] = useState<ActivityEntry["action"] | "all">("all");
  const all = local?.activity ?? [];
  const actions = [...new Set(all.map((a) => a.action))];
  const shown = filter === "all" ? all : all.filter((a) => a.action === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-navy">Activity log</h2>
          <p className="mt-1 text-sm text-ink-soft">Every import, edit, confirmation, export and share, with when it happened and where it came from.</p>
          <LocalOnlyNotice className="mt-2" />
        </div>
        {actions.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink">
              <option value="all">Everything ({all.length})</option>
              {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
          </label>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState>No activity yet on this device. The sample data that ships with the demo isn&apos;t listed here.</EmptyState>
      ) : (
        <Card className="p-2 sm:p-4">
          <ol className="divide-y divide-line">
            {shown.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-2 py-3 text-sm">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  {a.sourceKind ? <SourceIcon kind={a.sourceKind} className="h-3.5 w-3.5" /> : <span aria-hidden>•</span>}
                </span>
                <div className="min-w-0">
                  <p className="text-ink"><span className="font-semibold">{ACTION_LABELS[a.action]}</span> — {a.summary}</p>
                  <p className="text-xs text-ink-muted">{fmtDateTime(a.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}
