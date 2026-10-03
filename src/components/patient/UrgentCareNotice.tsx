import { SelfHarmSupport } from "@/components/log/Questionnaire";
import { SELF_HARM_SUPPORT } from "@/lib/screening";
import type { UrgentKind } from "@/lib/patientAgent/types";

/**
 * The one urgent-symptom surface. Self-harm wording renders the existing
 * SelfHarmSupport component (the PHQ-9 item 9 pattern) unchanged. A physical
 * emergency uses the same card shape with 911 first, reusing
 * SELF_HARM_SUPPORT.actions[1]. No second mechanism exists.
 */
export function UrgentCareNotice({ kind, id }: { kind: UrgentKind; id?: string }) {
  if (kind === "self-harm") return <SelfHarmSupport id={id} />;
  const emergency = SELF_HARM_SUPPORT.actions[1];
  return (
    <div id={id} role="alert" className="rounded-card border-2 border-attention/40 bg-attention-soft p-4 text-sm text-ink">
      <p className="font-serif text-lg font-semibold text-navy">Call 911 or go to the ER</p>
      <p className="mt-1 leading-relaxed">
        What you described needs urgent care, not an app. Please call 911 or go to the nearest emergency department now.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        <li>
          <a href={emergency.href} className="flex min-h-12 flex-col justify-center rounded-xl bg-attention px-4 py-2 font-semibold text-white">
            Call 911
            <span className="text-xs font-normal text-white/90">{emergency.detail}</span>
          </a>
        </li>
        <li>
          <a href={SELF_HARM_SUPPORT.actions[0].href} className="flex min-h-12 flex-col justify-center rounded-xl bg-surface px-4 py-2 font-semibold text-attention ring-1 ring-attention/40">
            Call or text 988
            <span className="text-xs font-normal text-ink-soft">Suicide and Crisis Lifeline, free and confidential, 24/7</span>
          </a>
        </li>
      </ul>
      <p className="mt-3 leading-relaxed">
        Once you are safe, your Passport will still be here and you can log what happened.
      </p>
    </div>
  );
}
