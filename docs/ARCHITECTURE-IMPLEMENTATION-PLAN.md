# Architecture implementation plan

How to build the five-stage architecture in `docs/DATA-AI-ARCHITECTURE.md` (diagram:
`docs/architecture-diagram.png`) on top of the code that exists today on `hackathon/demo`.

Read `docs/CODEX-HANDOFF.md` first. **That file wins on anything about today.** Update at 12:35:
the team moved Margaret Lindqvist to hero patient and pulled the deterministic parts of stages 3 and
4 into today (handoff tasks A3 and A4: measures, heart failure data, one cited heart failure rule,
specialist agents, orchestrator, safety reviewer). Use the data shapes and rules in this file for
those tasks.

What still waits for after the hackathon, and why:
- **Phase 1 (cloud storage, secure link, activity log in the cloud):** needs a database, patient
  accounts and the hosting decision. Not safe to stand up in 90 minutes, and not on the demo path.
- **Phase 2.4 (language model provider):** no model key, by team decision; also needs a BAA before
  any real patient data.
- **The rest of Phase 2.3 (more heart failure rules):** each needs a citation someone has opened and
  quoted. One rule today, the rest after.
- **Phase 3 (Epic public sandbox):** needs an app registration at fhir.epic.com, which is not
  instant.
- **Phase 4 (EHR launch, write-back, CMS networks):** needs health system partners.

Every phase lists files, data shapes, tests and acceptance criteria.

---

## 0. Where the code stands (verified 3 Oct, 12:30 PM)

| Architecture item | In the code today | Where |
|---|---|---|
| Patient forms (meds, symptoms, mood, PHQ-9, GAD-7, vitals, meals) | Built | `src/app/log/*` |
| Document OCR on device | Built (Tesseract.js) | `src/lib/ocr` |
| Apple Health export, Bluetooth BP cuff | Built | `src/lib/appleHealth`, `src/lib/devices` |
| Live public FHIR R4 sandbox import + RxNav mapping | Built | `src/lib/fhir`, add-to-Passport sources |
| Synthea import (Heather Song) | Built | `/passport/add/synthea` |
| Standard codes, provenance, confirm-before-use | Built | `src/lib/types.ts` (`Sourced`), `src/lib/terminology` |
| Passport storage | On device only (IndexedDB) | `src/lib/passport` |
| Reconciliation | Built | `src/lib/reconcile` |
| Safety rules | 14 deterministic rules | `src/lib/safetyEngine` (`RULES`, `evaluatePatient`) |
| Calculated measures (weight change, trends, PHQ-9 change, missed doses) | **Not built** as functions. `VitalSign` already has `weightKg`, `systolic`, `heartRate`; `LabResult` exists | `src/lib/types.ts` |
| Heart failure profile (LVEF, NYHA, phenotype) | **Not modelled.** Margaret's persona has HFpEF in conditions only | `src/lib/mockData/patients.ts` |
| Agents | Five deterministic agents, one tool policy, every finding to a human | `src/lib/clinician`, `src/lib/patientAgent`, `/agents` |
| Language model | **None.** Swap point exists: `AssistantProvider` interface | `src/lib/assistant/index.ts` |
| Safety reviewer | Partial: tool policy (`clinician/policy.ts`) + directive-wording check (`patientAgent/neutral.ts` `validateNeutral`) | |
| Drug interaction API | Live Photon Neutron screening | `api/photon/*`, `PhotonScreenPanel` |
| PDF/print summary, sensitive sections off, FHIR export | Built | `/passport/share`, `src/lib/export` |
| Secure revocable link, EHR launch, write-back, CMS networks | **Not built** | |
| PostgreSQL, time series, pgvector, cloud audit log, licensed knowledge base, HIPAA/BAA | **Not built** | |

---

# Part A: today, before 2:00 PM

These slot into `CODEX-HANDOFF.md`. Order: handoff Task A (rehearsal) first, always.

### A1. `/architecture` page (this is handoff Task B, 1:15 to 1:55)

Follow handoff Task B exactly. It is the honest "running today vs next" view of this whole plan,
and it is the single most useful thing for judges who ask "what is real?".

### A2. Wording pass (10 min, inside A1)

The doc's rule: patients see **"findings"** and **"questions"**, never "recommendations". Clinicians
see **"decision support"**.

```bash
git grep -n -i -E "recommend" -- src ':!*.test.*'
```

Change patient-facing copy only. Do not rename identifiers or rule ids. Add one test that renders
the dashboard agent card and the Ask Parthia reply for Harold and asserts neither contains
`/recommend/i`.

### A3. Stage 3 calculated measures, OPTIONAL (35 min hard box)

**Only start this if handoff Task A finished by 1:00 PM.** If it did not, skip to Task B. It is
pure functions plus one read-only display, so it cannot break existing flows, but it competes with
the architecture page for time, and the page matters more.

New module `src/lib/measures/index.ts`, pure, no React, no I/O:

```ts
export interface Measure {
  id: "weight-change-3d" | "weight-change-7d" | "bp-trend-14d" | "hr-trend-14d"
    | "potassium-trend" | "egfr-trend" | "phq9-change" | "missed-doses-7d";
  label: string;            // plain language, e.g. "Weight change over 3 days"
  value: number | null;     // null when there is not enough data
  unit: string;             // "kg", "mmHg", "bpm", "mmol/L", "mL/min/1.73m2", "points", "doses"
  window: { from: string; to: string };
  basis: string[];          // ids of the exact VitalSign / LabResult / entry records used
  status: "ok" | "insufficient-data";
}
export function computeMeasures(record: PatientRecord, now: Date): Measure[];
```

Rules for the math:
- Weight change: latest reading minus the earliest reading inside the window. Need at least two
  readings at least 2 days apart in the window, else `insufficient-data`. Never interpolate.
- BP/HR trend: mean of the last 7 days minus mean of the 7 days before. Need 3+ readings in each
  half, else `insufficient-data`.
- Potassium / eGFR: last two results with dates, difference and direction.
- PHQ-9 change: latest total minus previous total.
- Missed doses: count from medication events / reminders data if present, else `insufficient-data`.
- Missing data produces `insufficient-data`, never 0.

Display: one read-only "Measures" card on `/trends` listing each measure with its value, window and
a "based on N readings" line. No colors that imply judgement, no thresholds, no advice. Thresholds
come in Part B with guideline citations.

Tests (`src/lib/measures/measures.test.ts`): each measure with enough data, each with too little
data, a window boundary case, and `basis` contains exactly the records used. Run the full suite.

**Do nothing else from Part B today.** No new types on `PatientRecord`, no backend, no model.

---

# Part B: after the hackathon

Each phase ends with a working, tested, deployable state. Estimates assume one developer with a
coding agent.

## Team decisions needed before Phase 1 (do not guess these)

| Decision | Options | Why it matters |
|---|---|---|
| D1. Source of truth | (a) Cloud database is the record, device is a cache. (b) Local-first: device is the record, cloud holds an encrypted copy with the key held by the patient | The doc says (a). The current About page promises (b). They need different schemas, auth and sharing. |
| D2. Hosting | Azure (Static Web Apps + Functions + Azure Database for PostgreSQL), matching the doc and the original CI. Or Vercel + a managed Postgres | The doc names Azure and a Microsoft BAA. The hackathon build runs on Vercel. |
| D3. Identity | Microsoft Entra External ID, Auth0, or similar | Needed for patient accounts and clinician link audit. |
| D4. Language model vendor | One that will sign a BAA for PHI (for example Azure OpenAI under the Microsoft BAA) | No PHI may go to a model without a BAA. |
| D5. Licensed drug knowledge | First Databank, Medi-Span (Wolters Kluwer), or keep Photon screening as the interaction source | Replaces the illustrative tables. Cost and licence terms. |

Until D1 to D4 are decided, Phase 1 can still build the schema and the share-link flow against a
local Postgres with synthetic data only.

## Phase 1: cloud storage and the secure clinician link (doc priority 1, about 2 weeks)

Goal: a clinician can open a time-limited, read-only, revocable link to exactly the sections a
patient chose, and every share and view is logged.

### 1.1 Backend skeleton
- New `server/` package (TypeScript) deployed as functions on the chosen host (D2). Keep root
  `api/` for the Photon functions or move them in; one function style only.
- Postgres with migrations (for example `node-pg-migrate` or Drizzle). Synthetic data only until the
  BAA is in place.
- Config through environment variables only. Secrets never in the repo or the browser bundle.

### 1.2 Schema (first migration)

```
patient            (id uuid pk, created_at, deleted_at)
fhir_resource      (id uuid pk, patient_id fk, resource_type text, fhir_id text,
                    resource jsonb, source text, source_received_at timestamptz,
                    confirmed_at timestamptz null, version int, unique(patient_id, resource_type, fhir_id, version))
observation_ts     (patient_id fk, loinc text, effective_at timestamptz, value numeric, unit text,
                    source text, resource_id fk)  -- daily device readings; index (patient_id, loinc, effective_at)
flag               (id uuid pk, patient_id fk, rule_id text, severity text, evidence jsonb,
                    basis_resource_ids uuid[], computed_at, engine_version text)
consent            (id uuid pk, patient_id fk, scope text, sections text[], granted_at, revoked_at null)
share_link         (id uuid pk, patient_id fk, token_hash bytea unique, sections text[],
                    created_at, expires_at, revoked_at null, created_by text)
audit_event        (id bigserial pk, patient_id fk, actor text, action text, target text,
                    at timestamptz, ip_hash bytea null, detail jsonb)  -- append only
```

- Store original FHIR resources verbatim in `fhir_resource.resource`. Derived tables are rebuilt
  from them, never edited by hand.
- `audit_event` is append-only (no UPDATE/DELETE grants for the app role).
- Unconfirmed items are stored but excluded from analysis (`confirmed_at is null`), the same rule as
  today.

### 1.3 Sync from the device
- Reuse the Passport store interface in `src/lib/passport` and add a sync adapter behind it, so UI
  code does not change. Push confirmed items and receive server ids.
- Conflict rule: server keeps every version; the newest confirmed version wins for display; the
  reconciliation engine still shows disagreements between sources.

### 1.4 Secure share link
- Patient picks sections on `/passport/share` (exists), then "Create secure link" with an expiry
  (default 7 days, maximum 30).
- Server creates 32 random bytes, stores only the SHA-256 hash, returns the token once.
- Link format `https://<host>/clinician/shared/?t=<token>`. The app is a static export, so this is
  one static page that reads the token client-side and calls `GET /api/share/:token`. Do not use a
  dynamic route.
- The API checks hash, expiry and revocation, returns only the chosen sections, and writes an
  `audit_event` for every view.
- Patient sees all their links with status and view count, and can revoke instantly.
- Rate-limit the endpoint. Return the same error for unknown, expired and revoked tokens.

### 1.5 Activity log in the app
- `/passport/activity`: every share created, viewed and revoked, every import, every export, from
  `audit_event`.

### Tests and acceptance
- Unit: token hashing, expiry, revocation, section filtering (a section not chosen never appears).
- Integration against a test database: create, view, revoke, view again (fails), audit rows exist.
- Security: no secret or token in client bundles (`grep` the build output in CI), CORS limited to
  the app origin.
- Acceptance: on a phone, Harold creates a link with Medications and Allergies only; a second
  browser opens it and sees only those; Harold revokes; the link stops working within one request;
  the activity log shows all three events.

## Phase 2: heart failure measures, pharmacist agent, safety reviewer (doc priority 2, about 2 to 3 weeks)

### 2.1 Data model additions (Priority 1 table)

Add to `src/lib/types.ts`, each annotated with its FHIR analogue like the existing types:

| Element | Type | FHIR | Code (verify each on loinc.org / SNOMED browser before use) |
|---|---|---|---|
| Heart failure profile | `HeartFailureProfile { phenotype: "HFrEF" \| "HFmrEF" \| "HFpEF"; lvef?: {value, date}; nyhaClass?: 1\|2\|3\|4 }` | Condition + Observation | LVEF LOINC 10230-1 |
| Daily weight | existing `VitalSign.weightKg` | Observation | LOINC 29463-7 |
| BP, heart rate | existing `VitalSign` | Observation | 85354-9 panel, 8480-6, 8462-4, 8867-4 |
| Potassium, sodium, creatinine, eGFR, BNP, NT-proBNP | existing `LabResult` with LOINC | Observation | 2823-3, 2951-2, 2160-0, eGFR (pick the CKD-EPI 2021 code), 30934-4, 33762-6 |
| HF symptom checklist | `HfSymptomCheck { date, breathless, pillows, swelling, dizzy, fatigue, chestPain, fainted }` | QuestionnaireResponse | |
| Adherence | `MissedDose { medicationId, date, reason: "cost" \| "side-effects" \| "forgot" \| "diuretic-timing" \| "other" }` | MedicationStatement / Observation | |
| Diet risks | `DietRisk { date, highSodium, saltSubstitute, alcohol, fluidOverLimit, herbal: string[] }` | Observation | |
| Mood | PHQ-2 then PHQ-9 if positive | QuestionnaireResponse | PHQ-2 55757-9, PHQ-9 44261-6 |
| Events | `ClinicalEvent { type: "hospitalization" \| "er-visit" \| "fall"; date }` | Encounter | |

New patient screens: `/log/hf-check` (30-second daily checklist; chest pain or fainting shows the
existing urgent 911 notice first and stops), `/log/missed-dose`, diet-risk quick choices on the
existing meal screen (simple choices, not a food diary).

Seed data: give Margaret (HFpEF, furosemide, carvedilol) 30 days of weights including one 3-day
gain, BP and HR readings, potassium and eGFR results, and HF checklist entries, so every new
measure and rule has a demo case.

### 2.2 Measures
Extend the Part A `src/lib/measures` module (or build it now if A3 was skipped) with the heart
failure set. Still deterministic, still `insufficient-data` on gaps, still `basis` ids on every value.

### 2.3 Heart-failure safety rules (new file `src/lib/safetyEngine/rules/heartFailure.ts`)

Each rule follows the existing `RuleDefinition` shape, raises a question for a clinician (never an
instruction), and cites a source passage. **Look up and quote the exact passage and URL for each
rule; do not write a rule whose citation you have not opened.** Candidate rules:

| Rule | Trigger | Source to cite |
|---|---|---|
| NSAID with heart failure | NSAID active + HF condition | 2022 AHA/ACC/HFSA heart failure guideline; AGS Beers Criteria 2023 |
| Non-dihydropyridine calcium channel blocker with HFrEF | diltiazem or verapamil + HFrEF | 2022 AHA/ACC/HFSA guideline; Beers 2023 |
| Thiazolidinedione with heart failure | pioglitazone or rosiglitazone + HF | 2022 guideline; FDA boxed warning on the label |
| Potassium salt substitute with potassium-raising drugs | diet risk `saltSubstitute` + ACE inhibitor, ARB, ARNI or MRA | Drug labels (hyperkalemia warnings) |
| Rising potassium on MRA / RAAS inhibitor | potassium trend up and above lab reference range + those drugs | Drug labels; guideline monitoring section |
| Rapid weight gain | weight change over the threshold in the patient's care plan (default from the HF self-care education the guideline cites) | 2022 guideline self-care section |
| Falling eGFR on renally cleared drugs | eGFR trend down + drugs needing renal adjustment | Drug labels |

Every rule gets tests: fires, does not fire, missing data does not fire and is reported as missing.
Add each new rule to the clinician eval cases (`src/lib/clinician/eval.ts`).

### 2.4 Model provider (only after decision D4)
- Implement a second `AssistantProvider` in `src/lib/assistant/` next to `scriptedProvider`. Model
  name and endpoint from environment variables. Calls go through a server function, never from the
  browser with a key.
- Input to the model: only the stage 3 output for this patient (facts, flags, measures, each with
  ids) plus the question. Never raw notes in Phase 2.
- Output contract (JSON, validated with a schema): `{ findings: [{ text, factIds: string[] }],
  questions: [{ text, factIds: string[] }] }`. Any item with no `factIds`, or with an id not in the
  input, is dropped.
- If the model fails, times out or returns invalid output, fall back to `scriptedProvider` and
  label the answer "rule-based".

### 2.5 Pharmacist agent
- `src/lib/agents/pharmacist.ts`: reads flags and measures, groups them by medication, and asks the
  provider for a plain-language explanation for the patient and a technical summary for the
  clinician. Reuses the Photon screening result when a draft prescription exists.
- Add it to `src/lib/agents/roster.ts` (it extends Dex and Fotini's work; keep the roster honest
  about which parts are model-backed).

### 2.6 Safety reviewer (the gate every agent output passes through)
`src/lib/agents/safetyReviewer.ts`, deterministic first:
1. Every finding and question cites at least one fact id that exists in the input.
2. `validateNeutral` (exists) rejects directive language: start, stop, skip, increase, decrease,
   double, switch, "you should take".
3. New checks: no diagnosis language ("you have", "this means you have"), no doses or numbers that
   are not present in the cited facts, no "recommend" in patient output.
4. Output passes, or is replaced by the scripted answer with the reason logged.
Optional later: a second model as a critic, but the deterministic checks stay and run first.

Tests: a fixture set of 30+ bad outputs (invented fact ids, dosing advice, diagnoses, invented
numbers) that must all be rejected, and good outputs that must pass. Run it in CI.

### Acceptance
- Margaret's 3-day weight gain shows as a measure, raises a rule finding with a guideline citation,
  appears as a patient question, and appears in the clinician summary with the readings behind it.
- With the model switched off, everything still works and says "rule-based".
- Safety reviewer fixture suite passes 100 percent.

## Phase 3: Epic public sandbox (doc priority 3, about 1 week)

- Register a patient-facing app at fhir.epic.com (non-production). Public client, SMART standalone
  launch, authorization code with PKCE, scopes for patient read of Patient, MedicationRequest,
  Condition, Observation, AllergyIntolerance, Encounter.
- Reuse the existing FHIR mapper and review step (the live SMART Health IT import already proves
  it). Add an Epic source alongside it on the add-to-Passport screen, replacing "simulated Epic".
- Use Epic's published sandbox test patients only. Record the sandbox name on every imported item.
- Tests: mapper fixtures from real sandbox responses (recorded, no tokens), token never stored
  outside memory or the server.
- Acceptance: a sandbox patient signs in, records import into review, the patient confirms, the
  safety engine runs on them.

## Phase 4: remaining agents and the in-EHR view (doc priority 4)

- Cardiology, nutrition and behavioral health agents, each built like the pharmacist agent: reads
  stage 3 facts, writes through the provider, passes the safety reviewer.
- Orchestrator: deterministic routing first (which agents a fact concerns), with a message log the
  clinician can replay, like the existing agent trace.
- SMART EHR launch: a clinician opens the Parthia summary inside Epic (launch context, `launch`
  scope). Requires each health system to approve; plan the app listing early.
- Later and dependent on partners: write-back to the chart, CMS Aligned Networks, the population
  workflow on de-identified data.

## Cross-cutting rules for every phase

- Deterministic code computes facts (stage 3). Models only explain facts they are given (stage 4).
- Every finding is a question for a clinician and goes to a human. No agent starts, stops or
  changes a medicine or a dose, ever. Urgent symptoms show 911 / 988 first.
- Every value on screen links to the records behind it.
- Synthetic data only until the BAA (D4) and hosting (D2) are signed off.
- Secrets in environment variables only; nothing secret in the browser bundle.
- No em dashes in copy, comments or commits. No AI attribution in commits.
- Keep the `/architecture` page current: move items from "Next" to "Running" only when the
  acceptance criteria above pass.
