import type { OrchestratorResult } from "./huddle";
export const MARGARET_HUDDLE_FIXTURE: OrchestratorResult = {
  facts: [{ id: "flag-anticholinergic-burden" }, { id: "flag-sertraline-mood-change" }, { id: "flag-benadryl-unconfirmed" }, { id: "flag-sedative-sertraline-benadryl" }, { id: "flag-kidney-trend" }, { id: "measure-weight-change-3d" }],
  review: { passed: 6, blocked: 1 },
  messages: [
    { seq: 1, from: "patient", to: "records", factIds: [], summary: "I am gathering Margaret's medication and daily-entry records.", status: "info" },
    { seq: 2, from: "records", to: "safety", factIds: ["flag-benadryl-unconfirmed", "flag-kidney-trend"], summary: "I found the unconfirmed Benadryl entry and the kidney trend.", status: "ok" },
    { seq: 3, from: "safety", to: "cardiology", factIds: ["measure-weight-change-3d"], summary: "I checked the configured safety rules and passed the weight change for review.", status: "ok" },
    { seq: 4, from: "safety", to: "nutrition", factIds: ["flag-anticholinergic-burden"], summary: "I am sending the anticholinergic burden to the specialist reviewers.", status: "ok" },
    { seq: 5, from: "cardiology", to: "behavioral", factIds: ["flag-sertraline-mood-change"], summary: "I linked the medication record with the mood change for a second review.", status: "ok" },
    { seq: 6, from: "behavioral", to: "reviewer", factIds: ["flag-sertraline-mood-change", "flag-sedative-sertraline-benadryl"], summary: "I am sending the linked sertraline findings to the safety reviewer.", status: "ok" },
    { seq: 7, from: "reviewer", to: "patient", factIds: ["flag-anticholinergic-burden", "flag-benadryl-unconfirmed"], summary: "I blocked one unsupported action and approved the source-backed questions.", status: "blocked" },
  ],
};
