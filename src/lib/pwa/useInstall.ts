"use client";

import { useCallback, useSyncExternalStore } from "react";
import { detectPlatform, isStandalone, type Platform } from "./platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallSnapshot {
  platform: Platform;
  isInstalled: boolean;
  /** Chrome/Edge/Android: a native prompt is available. */
  canPrompt: boolean;
  /** True once we're reading real browser state (false during SSR/hydration). */
  ready: boolean;
}

export interface InstallState extends InstallSnapshot {
  /** iOS Safari: no prompt exists; we must show the manual walkthrough. */
  needsManualGuide: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

/* ---- Module-level store ---------------------------------------------------
 * The install prompt event can fire very early, before any component mounts,
 * so we capture it at module load and expose everything through a tiny
 * external store that React reads with useSyncExternalStore.
 */
const SERVER_SNAPSHOT: InstallSnapshot = { platform: "unknown", isInstalled: false, canPrompt: false, ready: false };
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let snapshot: InstallSnapshot | null = null;
const listeners = new Set<() => void>();

function compute(): InstallSnapshot {
  return { platform: detectPlatform(), isInstalled: isStandalone(), canPrompt: Boolean(deferredPrompt), ready: true };
}

function emit() {
  snapshot = compute();
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", emit);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): InstallSnapshot {
  if (!snapshot) snapshot = compute();
  return snapshot;
}

function getServerSnapshot(): InstallSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Unified install state across platforms:
 *  - Android / desktop Chromium fire `beforeinstallprompt`; we capture it and
 *    replay it from our own button.
 *  - iOS never fires it; if we're on iOS and not in standalone mode we point
 *    the user to the Share → Add to Home Screen walkthrough instead.
 */
export function useInstall(): InstallState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      emit();
    }
    return outcome;
  }, []);

  return {
    ...snap,
    needsManualGuide: snap.platform === "ios" && !snap.isInstalled,
    promptInstall,
  };
}
