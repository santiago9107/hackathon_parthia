"use client";

import { useEffect, useRef, useState } from "react";
import { usePatient } from "@/lib/context/PatientContext";
import { assistant, type AssistantReply } from "@/lib/assistant";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
}

const STARTERS = ["What medications am I taking?", "Why was something flagged?", "How has my mood been?", "What should I ask my doctor?"];

export function AssistantPanel({ embedded = false }: { embedded?: boolean }) {
  const { record, flags, now } = usePatient();
  // The parent remounts this panel (key={patientId}) when the demo patient
  // changes, so the opening message can be a plain lazy initialiser.
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 0,
      role: "assistant",
      text: `Hi ${record.patient.name.split(" ")[0]}. I can answer questions using only your own records — medications, safety flags, mood, nutrition, symptoms and labs. What would you like to know?`,
      reply: { text: "", sources: [], suggestions: STARTERS },
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: idRef.current++, role: "user", text: q }]);
    // Small artificial delay so the exchange reads naturally in a demo.
    await new Promise((r) => setTimeout(r, 350));
    const reply = await assistant.respond(q, { record, flags, now });
    setMessages((m) => [...m, { id: idRef.current++, role: "assistant", text: reply.text, reply }]);
    setBusy(false);
  }

  const lastSuggestions = [...messages].reverse().find((m) => m.role === "assistant")?.reply?.suggestions;

  return (
    <div className={`flex flex-col rounded-card border border-line bg-surface shadow-card ${embedded ? "h-[32rem]" : "h-[min(70dvh,44rem)]"}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-serif text-base font-semibold text-navy">Ask about your records</p>
          <p className="text-xs text-ink-muted">Answers come only from {record.patient.name.split(" ")[0]}&apos;s own data · provider: {assistant.name}</p>
        </div>
        <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-700">AI-generated</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-sm text-white">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div
                className={`max-w-[90%] rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-relaxed ${
                  m.reply?.urgent ? "border-attention/30 bg-attention-soft text-ink" : "border-line bg-cream text-ink"
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                  <span className="font-semibold uppercase tracking-wider text-gold-700">AI-generated</span>
                  {m.reply && m.reply.sources.length > 0 && <span>Sources: {m.reply.sources.join(", ")}</span>}
                </div>
              </div>
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

      {lastSuggestions && lastSuggestions.length > 0 && !busy && (
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2.5">
          {lastSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your medications, mood, food or labs…"
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
        Not medical advice. Scripted responses built from your records; in a later phase a language model will answer with the same
        records as its only source.
      </p>
    </div>
  );
}
