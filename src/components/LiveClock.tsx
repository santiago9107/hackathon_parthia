"use client";

import { useSyncExternalStore } from "react";

/**
 * The real date and time, ticking every second.
 *
 * This is for what people see. The analysis clock (REFERENCE_DATE) stays on
 * the demo date on purpose: the seeded records and every "last 14 days"
 * window are built around it, so moving the real clock into the safety rules
 * would age the sample entries out and the findings would disappear.
 *
 * Before the first client render the server snapshot is 0, so the server and
 * the browser agree on an empty placeholder and nothing mismatches.
 */
const subscribe = (onTick: () => void) => {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 1000);
const serverSnapshot = () => 0;

export function formatClock(date: Date, options: { seconds?: boolean; withDate?: boolean; timeZone?: string } = {}): string {
  const { seconds = true, withDate = true, timeZone } = options;
  const day = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: seconds ? "2-digit" : undefined, timeZone });
  return withDate ? `${day} · ${time}` : time;
}

export function LiveClock({ seconds = true, withDate = true, className = "" }: { seconds?: boolean; withDate?: boolean; className?: string }) {
  const tick = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (tick === 0) return <span className={className} aria-hidden>&nbsp;</span>;
  const now = new Date(tick * 1000);
  return <time dateTime={now.toISOString()} className={`tabular-nums ${className}`}>{formatClock(now, { seconds, withDate })}</time>;
}
