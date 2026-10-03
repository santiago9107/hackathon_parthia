import type { ReactNode } from "react";

export type AppIconName =
  | "mood" | "mood-low" | "mood-neutral" | "mood-good" | "mood-high"
  | "symptom" | "meal" | "breakfast" | "lunch" | "dinner" | "snack"
  | "vitals" | "medication" | "calendar" | "warning" | "document"
  | "nutrition" | "emergency" | "physical" | "mental" | "book"
  | "camera" | "plus" | "edit" | "check" | "close" | "cross-medical" | "alert" | "info";

export function AppIcon({ name, className = "h-5 w-5" }: { name: AppIconName; className?: string }) {
  const paths: Record<AppIconName, ReactNode> = {
    mood: <><circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.3 2 4 2s3-.5 4-2M9 9h.01M15 9h.01"/></>,
    "mood-low": <><circle cx="12" cy="12" r="9"/><path d="M8.5 16c1-1.3 2.1-2 3.5-2s2.5.7 3.5 2M9 9h.01M15 9h.01"/></>,
    "mood-neutral": <><circle cx="12" cy="12" r="9"/><path d="M8.5 15h7M9 9h.01M15 9h.01"/></>,
    "mood-good": <><circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9h.01M15 9h.01"/></>,
    "mood-high": <><circle cx="12" cy="12" r="9"/><path d="M8 13.5c1.1 1.8 2.4 2.7 4 2.7s2.9-.9 4-2.7M8.5 9h1M14.5 9h1"/></>,
    symptom: <><path d="M9.5 4.5 19.5 14.5a3.5 3.5 0 0 1-5 5L4.5 9.5a3.5 3.5 0 0 1 5-5Z"/><path d="m8 13 5-5M9.5 9.5l5 5"/></>,
    meal: <><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 1 4 4 4 7h-4"/></>,
    breakfast: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></>,
    lunch: <><path d="M4 12h16M6 12a6 6 0 0 1 12 0M8 16h8M9 19h6"/><path d="M12 6V4"/></>,
    dinner: <><path d="M4 13h16M6 13a6 6 0 0 1 12 0M8 17h8M10 4c0 1 1 1.5 1 2.5S10 8 10 9M14 4c0 1 1 1.5 1 2.5S14 8 14 9"/></>,
    snack: <><path d="M12 6c2-3 5-2 6 0 2 4-1 13-6 15-5-2-8-11-6-15 1-2 4-3 6 0Z"/><path d="M12 6c0-2 1-3 3-4"/></>,
    vitals: <path d="M3 12h4l2-5 4 10 2-5h6"/>,
    medication: <><path d="M8.5 4.5a4 4 0 0 1 5.7 0l5.3 5.3a4 4 0 0 1-5.7 5.7L8.5 10.2a4 4 0 0 1 0-5.7Z"/><path d="m10.5 12.2 5.7-5.7"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></>,
    warning: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
    document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    nutrition: <><path d="M12 21C6 17 5 10 11 5c4-3 8-2 10-2 0 5-1 11-6 14-1 .7-2 1-3 1"/><path d="M4 20c4-6 8-9 14-14"/></>,
    emergency: <><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></>,
    physical: <><path d="M8 4v6a4 4 0 0 0 8 0V4M6 4h4M14 4h4M12 14v3a4 4 0 0 0 8 0v-1"/><circle cx="20" cy="14" r="2"/></>,
    mental: <><path d="M9 3a4 4 0 0 0-4 4v1a4 4 0 0 0 0 8v1a4 4 0 0 0 7 2 4 4 0 0 0 7-2v-1a4 4 0 0 0 0-8V7a4 4 0 0 0-7-2 4 4 0 0 0-3-2Z"/><path d="M12 5v14M8 9h4M12 14h4"/></>,
    book: <><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/></>,
    camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    edit: <><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    "cross-medical": <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}
