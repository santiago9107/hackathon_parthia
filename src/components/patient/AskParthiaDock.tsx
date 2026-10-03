"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AskParthiaPanel } from "@/components/patient/AskParthiaPanel";

/**
 * The docked "Ask Parthia" button, mounted once in the app shell.
 *
 * Open state is plain useState in this client component, which the shell does
 * not unmount across routes, so the panel survives navigation. The one effect
 * here only registers a keydown listener; the state change happens inside that
 * listener, which is an event, never during the effect, so
 * react-hooks/set-state-in-effect is not engaged and no rule is disabled.
 *
 * Focus moves to the panel heading in the click handler: flushSync commits the
 * open state before the ref is read, so the heading exists to receive focus
 * without an effect. Closing returns focus to this button.
 */

const PANEL_ID = "ask-parthia-panel";

export function AskParthiaDock() {
  const [open, setOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    flushSync(() => setOpen(true));
    headingRef.current?.focus();
  }

  return (
    <>
      {open && <AskParthiaPanel id={PANEL_ID} headingRef={headingRef} onClose={close} />}

      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        className="print-hidden fixed bottom-20 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-brand-800 safe-bottom md:bottom-6"
      >
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 stroke-current">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        {open ? "Hide Parthia" : "Ask Parthia"}
      </button>
    </>
  );
}
