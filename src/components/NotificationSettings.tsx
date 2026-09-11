"use client";

import { useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { isIOS, isStandalone, supportsNotifications, supportsPush } from "@/lib/pwa/platform";
import {
  enableNotifications,
  getNotificationPermission,
  hasStoredSubscription,
  loadReminderSettings,
  saveReminderSettings,
  scheduleDailyReminders,
  scheduleNotification,
  showLocalNotification,
  type PermissionState,
  type ReminderSettings,
} from "@/lib/pwa/push";
import { Card } from "./PageHeader";

/**
 * Rendered client-only (see install/page.tsx → next/dynamic with ssr:false),
 * so browser APIs can be read in the initial state without hydration issues.
 */
export function NotificationSettings() {
  const { record } = usePatient();
  const [permission, setPermission] = useState<PermissionState>(() => getNotificationPermission());
  const [settings, setSettings] = useState<ReminderSettings>(() => loadReminderSettings());
  const [mode, setMode] = useState<string | null>(() => (hasStoredSubscription() ? "web-push" : null));
  const [status, setStatus] = useState<string | null>(null);
  const gate: "ok" | "ios-not-installed" | "unsupported" =
    isIOS() && !isStandalone() ? "ios-not-installed" : !supportsNotifications() ? "unsupported" : "ok";

  function update(next: Partial<ReminderSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveReminderSettings(merged);
  }

  async function onEnable() {
    setStatus(null);
    const result = await enableNotifications();
    setPermission(result.permission);
    setMode(result.mode);
    if (result.permission === "granted") {
      update({ enabled: true });
      await scheduleDailyReminders({ ...settings, enabled: true }, record.patient.name.split(" ")[0]);
      setStatus(
        result.mode === "web-push"
          ? "Notifications on. A push subscription was created (stored locally until the reminder service exists)."
          : "Notifications on. Reminders are scheduled on this device while the app is installed.",
      );
    } else if (result.permission === "denied") {
      setStatus("Notifications are blocked for this site. You can re-enable them in your browser or phone settings.");
    }
  }

  async function onTest() {
    const ok = await showLocalNotification("Time for your morning medicines", {
      body: `${record.patient.name.split(" ")[0]}, tap to see today's list — ${record.patient.medications.length} medicines.`,
      url: "/medications/",
    });
    setStatus(ok ? "Sent a test reminder." : "Notifications aren't enabled yet.");
  }

  async function onTestDelayed() {
    await scheduleNotification(10_000, "Evening check-in", "How was your mood today? A 10-second check-in keeps your trends useful.", "/trends/");
    setStatus("A check-in nudge will arrive in about 10 seconds — you can close the app to see it.");
  }

  return (
    <Card className="p-5">
      <h2 className="font-serif text-xl font-semibold text-navy">Reminders & nudges</h2>
      <p className="mt-1 text-sm text-ink-muted">
        A medication reminder each morning and a short mood check-in each evening. Delivered as notifications, even when the app is closed.
      </p>

      {gate === "ios-not-installed" && (
        <div className="mt-4 rounded-xl border border-gold-200 bg-gold-50 p-3.5 text-sm text-ink">
          <p className="font-semibold text-gold-700">Install first on iPhone</p>
          <p className="mt-1">
            iOS only allows notifications from apps added to the Home Screen. Follow the steps above, open Parthia from your Home Screen,
            and come back here to turn reminders on.
          </p>
        </div>
      )}
      {gate === "unsupported" && (
        <div className="mt-4 rounded-xl border border-line bg-cream p-3.5 text-sm text-ink-muted">This browser doesn&apos;t support notifications.</div>
      )}

      {gate === "ok" && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {permission !== "granted" ? (
              <button
                type="button"
                onClick={onEnable}
                disabled={permission === "denied"}
                className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-40"
              >
                Turn on reminders
              </button>
            ) : (
              <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                <input type="checkbox" checked={settings.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                Reminders {settings.enabled ? "on" : "off"}
              </label>
            )}
            <span className="text-xs text-ink-muted">
              Permission: <strong>{permission}</strong>
              {mode && ` · delivery: ${mode}`}
              {!supportsPush() && " · Web Push not available here"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">Medication reminder</span>
              <input type="time" value={settings.medicationTime} onChange={(e) => update({ medicationTime: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-cream px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">Mood check-in nudge</span>
              <input type="time" value={settings.checkInTime} onChange={(e) => update({ checkInTime: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-cream px-3 py-2" />
            </label>
          </div>

          {permission === "granted" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onTest} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-brand-300">
                Send a test reminder now
              </button>
              <button type="button" onClick={onTestDelayed} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-brand-300">
                Test a nudge in 10 seconds
              </button>
            </div>
          )}
        </>
      )}

      {status && <p className="mt-3 text-sm text-brand-800">{status}</p>}
    </Card>
  );
}
