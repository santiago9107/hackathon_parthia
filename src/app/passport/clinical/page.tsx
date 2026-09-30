"use client";

import { Card, Disclaimer } from "@/components/PageHeader";
import { Sparkline } from "@/components/charts/Sparkline";
import { SourceBadge } from "@/components/passport/SourceBadge";
import { EmptyState, SectionTitle, TextLink, fmtDate } from "@/components/passport/PassportChrome";
import { usePatient } from "@/lib/context/PatientContext";
import { labHistory, labKey, latestLabs } from "@/lib/passport/selectors";
import { DeviceTrends } from "@/components/passport/DeviceTrends";

const STATUS_TONE = { normal: "text-ink", borderline: "text-[#7a5812]", abnormal: "text-attention" } as const;

function rangeText(r: { low?: number; high?: number }, unit: string) {
  const u = unit ? ` ${unit}` : "";
  if (r.low !== undefined && r.high !== undefined) return `${r.low}–${r.high}${u}`;
  if (r.high !== undefined) return `under ${r.high}${u}`;
  if (r.low !== undefined) return `above ${r.low}${u}`;
  return "—";
}

export default function ClinicalPage() {
  const { record, now } = usePatient();
  const { patient } = record;
  const latest = latestLabs(patient.labs);
  const vitals = [...patient.vitals].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  // Individual measurements for the table; daily wearable summaries are shown as trends below.
  const readings = vitals.filter((v) => v.systolic !== undefined || v.weightKg !== undefined || (v.heartRate !== undefined && !v.id.startsWith("ah-day-")));
  const bp = vitals.filter((v) => v.systolic);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle>Conditions</SectionTitle>
        <ul className="divide-y divide-line">
          {patient.conditions.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink">{c.name}</span>
                <span className="block text-xs text-ink-muted">
                  {[c.code && `ICD-10 ${c.code}`, c.snomedCode && `SNOMED ${c.snomedCode}`, c.diagnosedOn && `diagnosed ${fmtDate(c.diagnosedOn)}`, c.clinicalStatus].filter(Boolean).join(" · ")}
                </span>
              </span>
              <SourceBadge source={c.source} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionTitle>Lab results</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-ink-muted">The most recent result for each test, with its trend. Shaded band = typical range.</p>
        <ul className="divide-y divide-line">
          {latest.map((l) => {
            const hist = labHistory(patient.labs, l.loincCode ?? l.name);
            const label = `${l.name} trend: ${hist.map((h) => `${h.value} on ${fmtDate(h.date)}`).join(", ")}`;
            return (
              <li key={labKey(l)} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[1fr_auto_auto]">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {l.name} <span className={`ml-1 font-semibold ${STATUS_TONE[l.status]}`}>{l.value}{l.unit ? ` ${l.unit}` : ""}</span>
                    {l.status !== "normal" && <span className={`ml-1.5 text-xs font-semibold ${STATUS_TONE[l.status]}`}>({l.status})</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {fmtDate(l.date)} · typical {rangeText(l.referenceRange, l.unit)}{l.loincCode ? ` · LOINC ${l.loincCode}` : ""} · {hist.length} result{hist.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="row-span-2 sm:row-span-1"><Sparkline values={hist.map((h) => ({ x: h.date, y: h.value }))} range={l.referenceRange} label={label} /></div>
                <div className="sm:justify-self-end"><SourceBadge source={l.source} compact /></div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionTitle action={<TextLink href="/log/vitals/">Log a reading</TextLink>}>Vitals</SectionTitle>
        {bp.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-cream/60 p-3 text-sm">
            <span className="text-ink-soft">Systolic blood pressure</span>
            <Sparkline
              width={220}
              values={[...bp].reverse().map((v) => ({ x: v.timestamp, y: v.systolic! }))}
              range={{ low: 90, high: 130 }}
              label={`Systolic blood pressure: ${[...bp].reverse().map((v) => v.systolic).join(", ")}`}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Vital sign readings, newest first</caption>
            <thead className="text-xs uppercase tracking-wider text-ink-muted">
              <tr><th scope="col" className="py-2 font-semibold">When</th><th scope="col" className="font-semibold">Blood pressure</th><th scope="col" className="font-semibold">Heart rate</th><th scope="col" className="font-semibold">Weight</th><th scope="col" className="font-semibold">Where</th><th scope="col" className="font-semibold">Source</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {readings.slice(0, 20).map((v) => (
                <tr key={v.id}>
                  <td className="py-2 text-ink-soft">{fmtDate(v.timestamp, { month: "short", day: "numeric" })}</td>
                  <td className="font-medium text-ink">{v.systolic ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                  <td>{v.heartRate ?? v.restingHeartRate ?? "—"}{v.restingHeartRate ? " (resting)" : ""}</td>
                  <td>{v.weightKg ? `${v.weightKg} kg` : "—"}</td>
                  <td className="capitalize text-ink-muted">{v.bpSetting?.replace("-", " ") ?? "—"}</td>
                  <td><SourceBadge source={v.source} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle action={<TextLink href="/passport/add/">Import</TextLink>}>Devices and activity (last 30 days)</SectionTitle>
        <DeviceTrends vitals={patient.vitals} now={now} days={30} />
      </Card>

      <Card className="p-5">
        <SectionTitle action={<TextLink href="/passport/appointments/">Appointments</TextLink>}>Visit summaries</SectionTitle>
        <ul className="space-y-3">
          {[...record.encounters].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
            <li key={e.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{e.specialty} — {e.clinician}</p>
                  <p className="text-xs text-ink-muted">{fmtDate(e.date)}{e.organization ? ` · ${e.organization}` : ""} · {e.reason}</p>
                </div>
                <SourceBadge source={e.source} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{e.summary}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Procedures</SectionTitle>
          {record.procedures.length === 0 ? <EmptyState>None recorded.</EmptyState> : (
            <ul className="divide-y divide-line">
              {record.procedures.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                  <span><span className="font-medium text-ink">{p.name}</span><span className="block text-xs text-ink-muted">{fmtDate(p.date)}{p.performer ? ` · ${p.performer}` : ""}</span>{p.outcome && <span className="block text-xs text-ink-soft">{p.outcome}</span>}</span>
                  <SourceBadge source={p.source} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>Social history</SectionTitle>
          {record.socialHistory.length === 0 ? <EmptyState>None recorded.</EmptyState> : (
            <ul className="divide-y divide-line">
              {[...record.socialHistory].sort((a, b) => b.date.localeCompare(a.date)).map((h) => (
                <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                  <span><span className="font-medium capitalize text-ink">{h.category.replace("-", " ")}</span><span className="block text-ink-soft">{h.value}</span><span className="block text-xs text-ink-muted">{fmtDate(h.date)}</span></span>
                  <SourceBadge source={h.source} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>Immunizations</SectionTitle>
          <ul className="divide-y divide-line">
            {[...record.immunizations].sort((a, b) => b.date.localeCompare(a.date)).map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-medium text-ink">{i.vaccine}</span><span className="block text-xs text-ink-muted">{fmtDate(i.date)}{i.doseNote ? ` · ${i.doseNote}` : ""}{i.cvxCode ? ` · CVX ${i.cvxCode}` : ""}</span></span>
                <SourceBadge source={i.source} compact />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
