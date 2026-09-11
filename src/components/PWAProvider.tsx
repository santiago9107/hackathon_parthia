"use client";

import { useEffect, type ReactNode } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { loadReminderSettings, registerServiceWorker, scheduleDailyReminders } from "@/lib/pwa/push";

/**
 * Registers the service worker once on the client and (if the user has
 * enabled reminders) re-arms today's local reminders on every launch.
 */
export function PWAProvider({ children }: { children: ReactNode }) {
  const { record } = usePatient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reg = await registerServiceWorker();
      if (!reg || cancelled) return;
      const settings = loadReminderSettings();
      if (settings.enabled && Notification.permission === "granted") {
        await scheduleDailyReminders(settings, record.patient.name.split(" ")[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record.patient.name]);

  return <>{children}</>;
}
