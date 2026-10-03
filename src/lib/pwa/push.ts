import { supportsNotifications, supportsPush, supportsServiceWorker } from "./platform";

/**
 * Web Push + reminder scheduling.
 *
 * Real Web Push needs a server that stores subscriptions and sends messages
 * through the browser's push service. This phase has no backend, so:
 *
 *  - The permission + subscription flow is implemented for real (it will
 *    produce a genuine PushSubscription when NEXT_PUBLIC_VAPID_PUBLIC_KEY is
 *    set). The subscription is kept in localStorage instead of being POSTed
 *    to a server — that POST is the one thing to add later.
 *  - Reminders are delivered locally by the service worker
 *    (`registration.showNotification`) on a timer, which is enough to demo
 *    the medication-reminder and check-in-nudge experience end to end.
 */

const SW_PATH = "/sw.js";
const SETTINGS_KEY = "parthia.reminders";
const SUBSCRIPTION_KEY = "parthia.pushSubscription";

export interface ReminderSettings {
  enabled: boolean;
  medicationTime: string; // "HH:MM"
  checkInTime: string; // "HH:MM"
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  medicationTime: "08:00",
  checkInTime: "20:30",
};

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...JSON.parse(raw) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsServiceWorker()) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    return reg;
  } catch (err) {
    console.warn("[pwa] service worker registration failed", err);
    return null;
  }
}

export type PermissionState = NotificationPermission | "unsupported";

export function getNotificationPermission(): PermissionState {
  if (!supportsNotifications()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface EnableResult {
  permission: PermissionState;
  subscribed: boolean;
  mode: "web-push" | "local-only" | "denied" | "unsupported";
}

/**
 * Ask for notification permission and, if a VAPID key is configured, create
 * a real push subscription. Must be called from a user gesture (button tap).
 */
export async function enableNotifications(): Promise<EnableResult> {
  if (!supportsNotifications()) return { permission: "unsupported", subscribed: false, mode: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { permission, subscribed: false, mode: "denied" };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const reg = await registerServiceWorker();
  if (reg && supportsPush() && vapidKey) {
    try {
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));
      // TODO(phase 2): POST `sub.toJSON()` to the reminder service.
      window.localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub.toJSON()));
      return { permission, subscribed: true, mode: "web-push" };
    } catch (err) {
      console.warn("[pwa] push subscribe failed, falling back to local reminders", err);
    }
  }
  return { permission, subscribed: false, mode: "local-only" };
}

export function hasStoredSubscription(): boolean {
  try {
    return Boolean(window.localStorage.getItem(SUBSCRIPTION_KEY));
  } catch {
    return false;
  }
}

/** Show a notification now via the service worker (falls back to the page API). */
export async function showLocalNotification(title: string, options: NotificationOptions & { url?: string } = {}) {
  if (getNotificationPermission() !== "granted") return false;
  const reg = supportsServiceWorker() ? await navigator.serviceWorker.getRegistration() : null;
  const opts: NotificationOptions = {
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    ...options,
    data: { url: options.url ?? "/" },
  };
  if (reg) {
    await reg.showNotification(title, opts);
  } else {
    new Notification(title, opts);
  }
  return true;
}

/** Ask the service worker to fire a notification after `delayMs`. */
export async function scheduleNotification(delayMs: number, title: string, body: string, url = "/") {
  const reg = supportsServiceWorker() ? await navigator.serviceWorker.ready : null;
  if (reg?.active) {
    reg.active.postMessage({ type: "SCHEDULE_NOTIFICATION", delayMs, title, body, url });
    return true;
  }
  window.setTimeout(() => showLocalNotification(title, { body, url }), delayMs);
  return true;
}

/** Milliseconds until the next occurrence of "HH:MM" local time. */
export function msUntil(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.getTime() - Date.now();
}

/**
 * Schedule today's/tomorrow's reminders with the service worker. Local timers
 * only survive while the SW is alive, which is fine for a demo; a real
 * deployment sends these from the server through Web Push.
 */
export async function scheduleDailyReminders(settings: ReminderSettings, patientFirstName: string) {
  if (!settings.enabled) return;
  await scheduleNotification(
    msUntil(settings.medicationTime),
    "Time for your morning medicines",
    `${patientFirstName}, tap to see today's list and mark them taken.`,
    "/medications/",
  );
  await scheduleNotification(
    msUntil(settings.checkInTime),
    "Evening check-in",
    "How was your mood today? A 10-second check-in keeps your trends useful.",
    "/trends/",
  );
}
