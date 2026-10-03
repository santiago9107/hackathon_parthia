"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { getRecord, listPatients, referenceNow } from "../mockData";
import { passportStore, type StoreStatus } from "../passport/store";
import type { LocalPassport } from "../passport/collections";
import { findIssues, type ReconIssue } from "../reconcile";
import { evaluatePatient } from "../safetyEngine";
import { computeIndicators } from "../status/indicators";
import type { DomainIndicator, Patient, PatientId, PatientRecord, RiskFlag } from "../types";

/**
 * Holds the "current patient" for the demo and everything derived from it.
 *
 * In production this becomes the signed-in patient's own record (there is no
 * switcher — the patient owns their data). The switcher exists purely so a
 * demo can walk through different risk profiles.
 */
interface PatientContextValue {
  patients: Patient[];
  patientId: PatientId;
  setPatientId: (id: PatientId) => void;
  record: PatientRecord;
  flags: RiskFlag[];
  indicators: DomainIndicator[];
  now: Date;
  /** Local Passport store status ("loading" until IndexedDB has been read). */
  passportStatus: StoreStatus;
  /** What this device stores for the current patient (entries, pending imports, activity log). */
  local: LocalPassport | undefined;
  /** Differences between sources (resolved and open). */
  issues: ReconIssue[];
}

/* ---- Selected-patient store (persisted in localStorage) ------------------ */
const STORAGE_KEY = "parthia.selectedPatient";
const DEFAULT_ID: PatientId = "p-margaret";
let current: PatientId | null = null;
const listeners = new Set<() => void>();

function readSelected(): PatientId {
  if (current !== null) return current;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    current = saved && listPatients().some((p) => p.id === saved) ? saved : DEFAULT_ID;
  } catch {
    current = DEFAULT_ID;
  }
  return current;
}

function setSelected(id: PatientId) {
  current = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const patients = useMemo(() => listPatients(), []);
  const patientId = useSyncExternalStore(subscribe, readSelected, () => DEFAULT_ID);
  // Re-derive everything whenever the local Passport changes (server snapshot: seed only).
  const passportVersion = useSyncExternalStore(passportStore.subscribe, passportStore.getVersion, () => 0);
  const passportStatus = useSyncExternalStore(passportStore.subscribe, passportStore.getStatus, () => "idle" as StoreStatus);

  const value = useMemo<PatientContextValue>(() => {
    void passportVersion; // dependency: the merged record changes with the store
    const now = referenceNow();
    const record = getRecord(patientId)!;
    const flags = evaluatePatient(record, { now });
    const local = passportStore.get(patientId);
    const issues = findIssues(record, local);
    const indicators = computeIndicators(record, flags, now, issues);
    return { patients, patientId, setPatientId: setSelected, record, flags, indicators, now, passportStatus, local, issues };
  }, [patients, patientId, passportVersion, passportStatus]);

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient(): PatientContextValue {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used inside <PatientProvider>");
  return ctx;
}
