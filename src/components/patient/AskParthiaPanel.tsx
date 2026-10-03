"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AgentHuddle } from "@/components/agents/AgentHuddle";
import { Citations } from "@/components/patient/Citations";
import { UrgentCareNotice } from "@/components/patient/UrgentCareNotice";
import { usePatient } from "@/lib/context/PatientContext";
import { buildHuddle, huddleEnabled } from "@/lib/agents/huddle";
import { orchestrate } from "@/lib/agents/orchestrator";
import { usePatientAgent } from "@/lib/patientAgent/usePatientAgent";
import type { PatientReply } from "@/lib/patientAgent/types";

/**
 * The "Ask Parthia" side panel.
 *
 * Same message list, "Rule-based" chip, suggestion chips and input form as
 * src/components/AssistantPanel.tsx, but the answer comes from
 * `answerPatient` through `usePatientAgent()`, so it is the same rule engine
 * and the same policy refusals the rest of the patient agent uses.
 *
 * The capability line and the starter chips are read from the live page
 * context on every render, so they follow the route the patient is on while
 * the panel stays open. Every answer keeps the "Rule-based" label, cites
 * what it read with <Citations />, and an urgent symptom renders the 911 or
 * 988 notice above the answer, before anything else.
 */

interface Message {
  id: number;
  role: "user" | "assistant";
  text?: string;
  reply?: PatientReply;
}

const GREETING =
  "Ask me about anything on this page. I answer from your own Passport and from Parthia's safety rules, and from nothing else.";

export function AskParthiaPanel({
  id,
  headingRef,
  onClose,
}: {
  id: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
}) {
  const { record, now } = usePatient();
  const { context, ask } = usePatientAgent();
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [huddle, setHuddle] = useState<ReturnType<typeof buildHuddle> | null>(null);
  const idRef = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: idRef.current++, role: "user", text: q }]);
    // Small artificial delay so the exchange reads naturally in a demo.
    await new Promise((r) => setTimeout(r, 350));
    const reply = await ask(q);
    setMessages((m) => [...m, { id: idRef.current++, role: "assistant", reply }]);
    if (!reply.urgent && huddleEnabled()) {
      setHuddle(buildHuddle(orchestrate(record, now), reply));
      setHuddleOpen(true);
    }
    setBusy(false);
  }

  return (
    <>
    <AgentHuddle open={huddleOpen} onClose={() => setHuddleOpen(false)} huddle={huddle ?? undefined} urgent={undefined} triggerRef={inputRef} />
    <div
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-heading`}
      className="print-hidden fixed inset-x-2 bottom-[5.5rem] top-20 z-40 flex flex-col rounded-card border border-line bg-surface shadow-card safe-bottom sm:inset-x-auto sm:right-4 sm:w-[26rem] md:bottom-24 md:top-24"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className="font-serif text-base font-semibold text-navy outline-none">
            Ask Parthia
          </h2>
          <p className="text-xs font-medium text-ink-soft">On this page: {context.label}</p>
          <p className="mt-1 text-xs leading-snug text-ink-muted">{context.capability}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-700">Rule-based</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ask Parthia"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition hover:bg-brand-50 hover:text-brand-800"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 stroke-current">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-sm text-white">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="space-y-2">
              {/* An urgent symptom is the whole answer: the notice carries the
                  911 and 988 wording, so the segments, which are that same
                  fixed copy, are not repeated underneath it. */}
              {m.reply?.urgent ? (
                <>
                  <UrgentCareNotice kind={m.reply.urgent} />
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                    <span className="font-semibold uppercase tracking-wider text-gold-700">Rule-based</span>
                    <Citations citations={m.reply.citations} />
                  </div>
                </>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
                    {m.text && <p>{m.text}</p>}
                    {m.reply?.segments.map((s, i) => (
                      <p key={i} className={i > 0 ? "mt-1.5" : undefined}>
                        {s.text}
                      </p>
                    ))}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                      <span className="font-semibold uppercase tracking-wider text-gold-700">Rule-based</span>
                    </div>
                    {m.reply && m.reply.citations.length > 0 && <Citations citations={m.reply.citations} className="mt-2" />}
                  </div>
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-line bg-cream px-4 py-3 text-sm text-ink-muted">Checking your records…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!busy && (
        <div className="border-t border-line px-4 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {context.examples.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this page…"
          aria-label="Your question"
          className="flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-sm outline-none ring-brand-300 placeholder:text-ink-muted focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <p className="border-t border-line px-4 py-2 text-[11px] leading-snug text-ink-muted">
        Answered from your records by Parthia&apos;s rules, no model. Not medical advice.
      </p>
    </div>
    </>
  );
}
