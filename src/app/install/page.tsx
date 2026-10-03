"use client";

import Link from "next/link";
import { useInstall } from "@/lib/pwa/useInstall";
import { PageHeader, Card, Disclaimer } from "@/components/PageHeader";
import { IOSInstallGuide } from "@/components/IOSInstallGuide";
import dynamic from "next/dynamic";

const NotificationSettings = dynamic(() => import("@/components/NotificationSettings").then((m) => m.NotificationSettings), { ssr: false });
import { LeafMark } from "@/components/Wordmark";

export default function InstallPage() {
  const { ready, platform, isInstalled, canPrompt, promptInstall } = useInstall();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Install"
        title="Parthia Health on your phone"
        subtitle="Installed, it opens full-screen from your Home Screen, works offline, and can remind you about medicines and check-ins."
      />

      {!ready ? null : isInstalled ? (
        <Card className="flex items-center gap-4 p-5">
          <LeafMark className="h-12 w-12" />
          <div>
            <p className="font-semibold text-ink">Installed and ready</p>
            <p className="text-sm text-ink-muted">You&apos;re running Parthia Health as an app. Turn on reminders below.</p>
          </div>
        </Card>
      ) : platform === "ios" ? (
        <div>
          <Card className="mb-4 flex items-center gap-4 border-brand-100 bg-brand-50 p-4">
            <LeafMark className="h-11 w-11 shrink-0" />
            <p className="text-sm text-brand-900">
              <span className="font-semibold">iPhone or iPad:</span> Safari doesn&apos;t show an install button, so it takes three taps. Here&apos;s exactly where they are.
            </p>
          </Card>
          <IOSInstallGuide />
          <p className="mt-3 text-xs text-ink-muted">Tip: this walkthrough only works from Safari. If you opened this link in another app, tap its “Open in Safari” option first.</p>
        </div>
      ) : canPrompt ? (
        <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
          <LeafMark className="h-12 w-12 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-ink">Add Parthia Health to your {platform === "android" ? "phone" : "computer"}</p>
            <p className="text-sm text-ink-muted">One tap — your browser will confirm.</p>
          </div>
          <button type="button" onClick={() => promptInstall()} className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            Install
          </button>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="font-semibold text-ink">Install from your browser menu</p>
          <p className="mt-1 text-sm text-ink-muted">
            {platform === "android"
              ? "In Chrome, open the ⋮ menu and choose “Add to Home screen” or “Install app”."
              : "In Chrome or Edge, look for the install icon at the right end of the address bar, or open the browser menu and choose “Install Parthia Health”."}
          </p>
        </Card>
      )}

      <div className="mt-6">
        <NotificationSettings />
      </div>

      <p className="mt-6 text-sm">
        <Link href="/" className="font-semibold text-brand-700 hover:text-brand-900">
          ← Back to dashboard
        </Link>
      </p>
      <Disclaimer />
    </div>
  );
}
