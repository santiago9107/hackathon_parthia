/**
 * Platform detection for the PWA install / notification flows.
 * All functions are safe to call during SSR (they return conservative defaults).
 */

export type Platform = "ios" | "android" | "desktop" | "unknown";

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

export function isIOS(): boolean {
  if (!isBrowser()) return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

export function isAndroid(): boolean {
  return isBrowser() && /Android/i.test(navigator.userAgent);
}

export function detectPlatform(): Platform {
  if (!isBrowser()) return "unknown";
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "desktop";
}

/** True when running as an installed app (home screen / desktop shortcut). */
export function isStandalone(): boolean {
  if (!isBrowser()) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export function supportsServiceWorker(): boolean {
  return isBrowser() && "serviceWorker" in navigator;
}

/**
 * Web Push support. On iOS this is only true when the app has been added to
 * the Home Screen (iOS 16.4+), which is why the install onboarding matters.
 */
export function supportsPush(): boolean {
  return isBrowser() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function supportsNotifications(): boolean {
  return isBrowser() && "Notification" in window;
}
