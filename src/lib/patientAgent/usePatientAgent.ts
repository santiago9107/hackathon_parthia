"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { usePatient } from "../context/PatientContext";
import { getSeedRecord } from "../mockData";
import { answerPatient, type PatientAgentContext } from ".";
import { resolvePageContext } from "./pageContext";
import { evaluatePassportChange, type SafetyUpdate } from "./safetyWatch";
import type { PageContext, PatientReply } from "./types";

/**
 * Everything the patient agent needs, derived from `usePatient()`.
 *
 * `usePatient()` already re-runs the safety engine on every passport-store bump
 * through useSyncExternalStore, so all state here is plain useMemo over it. No
 * effects, no extra React context, so react-hooks/set-state-in-effect is never
 * engaged.
 *
 * The baseline is the seed Passport: the records the patient's care team
 * already has, before anything confirmed on this device.
 */
export interface PatientAgentState {
  update: SafetyUpdate;
  context: PageContext;
  ask: (question: string) => Promise<PatientReply>;
}

export function usePatientAgent(): PatientAgentState {
  const { patientId, record, now, local, issues } = usePatient();
  const pathname = usePathname();

  const baselineRecord = useMemo(() => getSeedRecord(patientId)!, [patientId]);
  const update = useMemo(
    () => evaluatePassportChange({ record, baselineRecord, now, issues, local }),
    [record, baselineRecord, now, issues, local],
  );
  const context = useMemo(() => resolvePageContext(pathname ?? "/", update), [pathname, update]);

  const ask = useCallback(
    (question: string) => {
      const ctx: PatientAgentContext = { record, update, page: context, now, issues };
      return answerPatient(question, ctx);
    },
    [record, update, context, now, issues],
  );

  return { update, context, ask };
}
