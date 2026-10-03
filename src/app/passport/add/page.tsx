"use client";

import Link from "next/link";
import { Card, Disclaimer } from "@/components/PageHeader";
import { SourceIcon } from "@/components/passport/SourceBadge";
import { LocalOnlyNotice } from "@/components/passport/PassportChrome";
import { SOURCE_CATALOG } from "@/lib/passport/catalog";

/** "Add to my Passport": choose where to bring information in from. */
export default function AddToPassportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-navy">Add to my Passport</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Bring your health information together from wherever it lives. Imported items wait for your review — nothing is used in any
          analysis until you confirm it.
        </p>
        <LocalOnlyNotice className="mt-2" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {SOURCE_CATALOG.map((o) => (
          <li key={o.id}>
            <Link href={o.href} className="block h-full">
              <Card className="h-full p-5 transition hover:border-brand-300">
                <span className="flex items-center gap-2 font-serif text-lg font-semibold text-navy">
                  <SourceIcon kind={o.kind} className="h-5 w-5 text-brand-700" /> {o.name}
                </span>
                <p className="mt-1 text-sm text-ink-soft">{o.description}</p>
                <p className={`mt-3 text-xs font-semibold ${o.status === "simulated" ? "text-[#7a5812]" : "text-brand-700"}`}>{o.statusNote}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <Disclaimer />
    </div>
  );
}
