"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

/**
 * Sharing now lives inside the Patient Passport. This page stays so older
 * links and installed apps (which cached /share/) still land somewhere useful.
 */
export default function ShareMovedPage() {
  return (
    <div>
      <PageHeader eyebrow="Share with your doctor" title="Sharing moved to your Passport" subtitle="Choose what to share and print a summary from Passport → Share." />
      <Link href="/passport/share/" className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
        Go to Passport → Share
      </Link>
    </div>
  );
}
