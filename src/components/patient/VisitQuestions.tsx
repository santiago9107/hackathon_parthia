import { Citations } from "@/components/patient/Citations";
import type { VisitQuestion } from "@/lib/patientAgent/visitQuestions";

/**
 * The questions the agent prepared for the visit, used by both surfaces: the
 * dashboard agent card and the printed share summary.
 *
 * The question line is what the agent wrote. The verbatim rule text sits under
 * it, so the patient can see exactly which safety rule the question came from.
 * Nothing here is sent anywhere: these are questions for the patient to ask.
 */
export function VisitQuestions({
  questions,
  className = "",
  showChip = true,
}: {
  questions: VisitQuestion[];
  className?: string;
  showChip?: boolean;
}) {
  if (questions.length === 0) return null;
  return (
    <div className={className}>
      {showChip && (
        <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-700">Rule-based</span>
      )}
      <ol className={`list-decimal space-y-3 pl-5 text-sm text-ink ${showChip ? "mt-3" : "mt-2"}`}>
        {questions.map((q) => (
          <li key={q.id}>
            <p className="font-medium text-ink">{q.text}</p>
            {q.segments
              .filter((s) => s.kind === "quoted")
              .map((s) => (
                <p key={s.text} className="mt-0.5 text-xs text-ink-muted">
                  {s.text}
                </p>
              ))}
            <Citations citations={q.citations} className="mt-1.5" />
          </li>
        ))}
      </ol>
    </div>
  );
}
