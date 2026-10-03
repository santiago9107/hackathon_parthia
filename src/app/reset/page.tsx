"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader } from "@/components/PageHeader";
import { usePatient } from "@/lib/context/PatientContext";
import { resetDemoData } from "@/lib/passport/actions";

export default function ResetPage() {
  const router = useRouter();
  const { setPatientId } = usePatient();
  const [working, setWorking] = useState(false);
  async function reset() {
    setWorking(true);
    await resetDemoData();
    setPatientId("p-margaret");
    router.push("/start/");
  }
  return <div><PageHeader eyebrow="Demo controls" title="Reset the demonstration" subtitle="Remove local entries and return to Margaret's seeded record." /><Card className="max-w-xl p-6"><p className="text-sm leading-6 text-ink-soft">This clears device-local changes only. Seeded demonstration records remain available.</p><button type="button" onClick={() => void reset()} disabled={working} className="mt-5 min-h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{working ? "Resetting" : "Reset and open Margaret"}</button></Card></div>;
}
