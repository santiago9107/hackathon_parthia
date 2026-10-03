"use client";

import Link from "next/link";
import { usePatient } from "@/lib/context/PatientContext";
import { StatusCard } from "@/components/StatusCard";
import { RiskFlagCard } from "@/components/RiskFlagCard";
import { Card, Disclaimer } from "@/components/PageHeader";
import { AgentCard } from "@/components/patient/AgentCard";
import { InstallCTA } from "@/components/InstallCTA";
import { useInstall } from "@/lib/pwa/useInstall";
import { withinLastDays, mean } from "@/lib/safetyEngine/rules/types";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { fmtDateTime } from "@/components/passport/PassportChrome";
import { LiveClock } from "@/components/LiveClock";
import { pendingEntries } from "@/lib/passport/ops";
import { openIssues } from "@/lib/reconcile";
import { AppIcon } from "@/components/AppIcon";

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { record, flags, indicators, now, local, issues } = usePatient();
  const differences = openIssues(issues).length;
  const { ready, isInstalled } = useInstall();
  const { patient } = record;
  const first = patient.name.split(" ")[0];

  const week = {
    moods: withinLastDays(record.moods, 7, now),
    meals: withinLastDays(record.nutrition, 7, now),
    symptoms: withinLastDays(record.symptoms, 7, now),
  };
  const moodAvg = mean(week.moods.map((m) => m.score));
  const topFlags = flags.filter((f) => f.severity !== "low").slice(0, 3);
  const recentChanges = patient.medicationHistory.filter((e) => (now.getTime() - new Date(e.date).getTime()) / 86_400_000 <= 45);
  const pending = pendingEntries(local).length;
  const nowIso = now.toISOString().slice(0, 19);
  const nextAppt = record.appointments.filter((a) => a.status === "booked" && a.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            <LiveClock />
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            {greeting(new Date())}, {first}.
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            Here&apos;s how things look across your medicines, body, mood and meals — each on its own, because they don&apos;t add up to one number.
          </p>
        </div>
      </div>

      {ready && !isInstalled && (
        <div className="mb-6 flex flex-col gap-3 rounded-card border border-brand-100 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-brand-900">Keep Parthia on your phone</p>
            <p className="text-sm text-brand-800/80">Install it for medication reminders, check-in nudges and offline access to your records.</p>
          </div>
          <InstallCTA variant="banner" />
        </div>
      )}

      <AgentCard />

      <div className="grid items-stretch gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {indicators.map((ind) => (
          <StatusCard key={ind.domain} indicator={ind} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-serif text-2xl font-semibold text-navy">Worth raising with your doctor</h2>
            <Link href="/medications/" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
              All {flags.length} flags →
            </Link>
          </div>
          {topFlags.length === 0 ? (
            <Card className="p-5 text-sm text-ink-muted">
              Nothing pressing right now. {flags.length > 0 ? `${flags.length} low-priority note${flags.length === 1 ? "" : "s"} are listed under Medications.` : ""}
            </Card>
          ) : (
            <div className="space-y-3">
              {topFlags.map((f) => (
                <RiskFlagCard key={f.id} flag={f} compact />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5" accent="border-l-brand-500">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold text-navy">My Passport</h2>
              <Link href="/passport/" className="text-sm font-semibold text-brand-700 hover:text-brand-900">Open →</Link>
            </div>
            {pending > 0 && (
              <Link href="/passport/review/" className="mt-3 flex items-center justify-between rounded-lg bg-gold-50 px-3 py-2 text-sm font-semibold text-[#5c430d] ring-1 ring-gold-200 hover:bg-gold-100">
                {pending} item{pending === 1 ? "" : "s"} to review <span aria-hidden>→</span>
              </Link>
            )}
            {differences > 0 && (
              <Link href="/passport/review/" className="mt-2 flex items-center justify-between rounded-lg bg-gold-50 px-3 py-2 text-sm font-semibold text-[#5c430d] ring-1 ring-gold-200 hover:bg-gold-100">
                {differences} difference{differences === 1 ? "" : "s"} between your records <span aria-hidden>→</span>
              </Link>
            )}
            {nextAppt && (
              <p className="mt-3 text-sm text-ink-soft">
                <span className="text-ink-muted">Next: </span>
                <span className="font-semibold text-ink">{fmtDateTime(nextAppt.start)}</span> · {nextAppt.clinician}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { href: "/log/mood/", label: "Mood" },
                { href: "/log/meal/", label: "Meal" },
                { href: "/log/symptom/", label: "Symptom" },
                { href: "/log/vitals/", label: "BP" },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="inline-flex min-h-11 items-center rounded-full bg-surface px-3.5 text-sm font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50">
                  <AppIcon name="plus" className="mr-1 h-4 w-4" /> {a.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg font-semibold text-navy">This week</h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              <div className="flex items-center justify-between py-2">
                <dt className="text-ink-muted">Mood check-ins</dt>
                <dd className="font-semibold text-ink">
                  {week.moods.length} · avg {moodAvg !== null ? moodAvg.toFixed(1) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-ink-muted">Meals logged</dt>
                <dd className="font-semibold text-ink">{week.meals.length}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-ink-muted">Symptom entries</dt>
                <dd className="font-semibold text-ink">{week.symptoms.length}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-ink-muted">Active medicines</dt>
                <dd className="font-semibold text-ink">{patient.medications.length}</dd>
              </div>
            </dl>
            <Link href="/trends/" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900">
              View trends →
            </Link>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg font-semibold text-navy">Recent medication changes</h2>
            {recentChanges.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No changes in the last 45 days.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {recentChanges.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-semibold text-ink">
                      {e.medicationName}{" "}
                      <span className="font-normal text-ink-muted">· {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </p>
                    <p className="text-ink-muted">{e.detail}</p>
                    <div className="mt-1"><SourceBadge source={e.source} compact /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg font-semibold text-navy">Your care team</h2>
            <p className="mt-2 text-sm text-ink">{patient.primaryClinician}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/passport/share/" className="rounded-full bg-brand-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-800">
                Prepare a summary to share
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}
