# Hackathon plan for Kiro: Parthia Health + the clinician agent

**Event:** Hackers & Healers NYC. **Live demo Saturday 3 Oct, 4:00 PM ET.** No slides, live demo only.
**Feature freeze 2:00 PM.** After that: fixes, deploy checks, two rehearsals.

**Main repo:** this one (Parthia Health, by Santiago Enriquez).
**Reference code to port from:** `../chartfuse` (built tonight by Om). Port ideas and logic into
Parthia's architecture; do not copy ChartFuse's app shell, styling or engine wholesale.

---

## 0. The story we are demoing

Parthia already gives the **patient** one Passport: every source, provenance on every item,
reconciliation, a transparent rule-based safety engine, and a share summary.

Tonight we add the **clinician side**: the patient shares their Passport, and an **agent** pulls
the other records the patient doesn't hold (hospital, urgent care, specialist, pharmacy fills),
reconciles everything with provenance, asks the patient about anything missing, runs the safety
rules with cited evidence, and routes each finding to a clinician. Only the clinician acts, and
prescribing goes through **Photon's** authorized provider workflow.

> "Each record looked safe by itself. Parthia found a source-backed medication risk that only
> appeared after reconciling them, and coordinated the response without changing care on its own."

Sponsor fit: **Photon Health** (main prize target). Visualize AI is out of scope.

---

## 1. Read before writing code (15 minutes)

1. `docs/PROJECT_HANDOFF.md`, especially §3 (stack) and §18 (Patient Passport).
2. `AGENTS.md`: **Next.js 16 has breaking changes.** Read `node_modules/next/dist/docs/` before
   touching framework APIs.
3. Existing modules you must reuse, not duplicate:
   - `src/lib/safetyEngine` (rules + `knowledge.ts`, `evaluatePatient`)
   - `src/lib/reconcile` (duplicate, dose/frequency conflict, missing-from-source, possibly-stopped)
   - `src/lib/fhir` (FHIR mapper with RxNorm/ICD-10/SNOMED/LOINC, simulated Epic import)
   - `src/lib/terminology/medications.ts` (drug dictionary: generic, brands, RxCUI, class)
   - `src/lib/passport` (IndexedDB store, `Sourced` provenance, merge, actions, Review flow)
   - `src/lib/assistant` (scripted, data-grounded, labelled "AI-generated")
   - `src/lib/export` (FHIR Bundle export: this is how the patient shares with the clinician)
4. Reference logic in `../chartfuse/lib`: `agent.ts` (coordinator + trace), `policy.ts` (tool
   allow/deny), `review.ts` (structured review request + neutral-language validation),
   `chat.ts` (tool-grounded answers), `adapters/photon.ts`, `fhirLive.ts`, `eval/`, and
   `components/AgentMission.tsx` (the visible agent panel).

## 2. Hard constraints of this repo

| Constraint | What it means for tonight |
| --- | --- |
| `output: "export"` (static site, no server) | **No Next.js API routes, no secrets in the browser.** The one exception is Task 4b: Photon screening runs in Vercel Functions in a root `api/` folder, outside the Next build. Everything runs in the browser. Public CORS-enabled APIs are fine: SMART Health IT FHIR (`https://r4.smarthealthit.org`) and RxNav (`https://rxnav.nlm.nih.gov/REST`) both allow browser calls (checked tonight). Photon M2M credentials and OpenRouter keys **cannot** be used client-side: Photon stays a labelled sandbox fixture + provider-workflow deep link; the LLM path stays off (deterministic templates). |
| React 19 lint rule `react-hooks/set-state-in-effect` | Browser-only state via `useSyncExternalStore` or lazy `useState` initialisers, as the rest of the app does. |
| Tailwind v4, tokens in `@theme` in `src/app/globals.css` | Use Parthia's tokens, fonts (Lora / Inter) and components. Keep Parthia's visual identity. |
| 185+ existing tests, lint, typecheck, static build | All must stay green: `npm run lint && npx tsc --noEmit && npm test && npm run build`. |
| Safety principles already in Parthia | Every flag is a question for a clinician, never an instruction. Four separate indicators, never one score. Synthetic data only; simulated sources say "Simulated". |

## 3. Working agreements

- Branch: `hackathon/clinician-agent`. Small commits. Never push to `main` or touch the Azure
  production deploy or its secrets; that is Santiago's.
- Dev server: `npm run dev` on its own port (`-p 3333`). Other agents may run ChartFuse on 3311.
- No em dashes in user-facing text. Plain words.
- Never claim live Epic/Oracle access, HIPAA compliance or clinical validation.
- Credit: README + About page: "Clinician agent built at Hackers & Healers NYC on Parthia Health."
- **Disclosure:** Parthia predates the event (commits from Sep 11 and Sep 30). Say so in the README
  and in the demo; tonight's clinician agent is the hackathon work.

---

## 4. Tasks in priority order

### Task 1: Clinician data model + extra sources (≈1 h)

1. Add a clinician-side **case**: `src/lib/clinician/types.ts`
   - `ClinicianCase { patientId; sources: CaseSource[]; resolutions; handoffs; trace }`
   - `CaseSource { id: "passport" | "hospital" | "urgent" | "specialist" | "photon"; label; format: "fhir" | "photon-adapter" | "passport-share"; available: boolean; lastUpdated; simulated: boolean }`
2. **Sources the clinician sees:**
   - `passport`: the patient's shared Passport, via the existing FHIR export (`src/lib/export`),
     mapped back with the existing mapper. Patient-reported items keep `kind: patient-entered`.
   - `hospital`, `urgent`, `specialist`: synthetic FHIR bundles in `src/lib/fhir/bundles/clinician/`
     (write **Harold Okafor's** three bundles, the hero patient, using
     `../chartfuse/data/fixtures/*.fhir.json` as the template; see §8.3 for what each must contain). Label "Simulated".
   - `photon`: port `../chartfuse/lib/adapters/photon.ts` (GraphQL-shaped fixture → canonical
     records). Fulfillment states (`ROUTING…READY, FILLING, SHIPPED, DELIVERED, PICKED_UP, COMPLETED,
     CANCELED, ERROR`) are **fulfillment, never evidence the patient takes it**. Label "Sandbox".
3. Extend `src/lib/terminology/medications.ts` with `ciprofloxacin` (RxCUI 2551, verified against
   RxNav on 2 Oct). Do not add unverified codes; unknown names stay unmapped.
4. Add a `validate` step that quarantines malformed FHIR resources (missing status/medication)
   instead of merging them (port the idea from `../chartfuse/lib/adapters/fhir.ts`).

### Task 2: Cross-source reconciliation for the clinician (≈1 h)

Reuse `src/lib/reconcile`. Extend it, don't fork it:
- Keep prescribed (`MedicationRequest`), fulfillment (Photon) and patient-reported
  (`MedicationStatement`) separate; fulfillment never makes a medicine "current".
- Add the cases ChartFuse covers that Parthia's patient-side recon does not:
  **active in one source, stopped in another** (status conflict across clinical sources),
  **strength missing → incomplete, never merged or called a mismatch**,
  **source unavailable after one retry → case cannot be marked complete**,
  **stale source** (older than 180 days) as a data-quality warning only.
- Every reconciled item keeps all its source records (provenance shown in the UI).

### Task 3: Label-cited evidence in the safety engine (≈30 min)

- Add an optional `evidence` field to entries in `knowledge.ts`:
  `{ sourceName, url, passage, passageIsVerbatim, retrievedOn }`.
- Fill it for the two rules ChartFuse verified tonight (exact wording in
  `../chartfuse/data/rules/rules.v1.json` and `evidence-sources.json`):
  - warfarin + ibuprofen: FDA Advil Drug Facts stomach-bleeding warning.
  - warfarin + ciprofloxacin: DailyMed ciprofloxacin label, INR monitoring. Add this pair to
    `DRUG_DRUG_PAIRS` (moderate, monitoring review) since Parthia doesn't have it.
- Everything else stays "illustrative knowledge table" and is labelled as such in the UI.

### Task 4: The clinician agent (≈2 h, the core of the demo)

`src/lib/clinician/agent.ts`: a deterministic coordinator, pure function of (case, now), resumable.
Port the structure of `../chartfuse/lib/agent.ts`, but call Parthia's modules:

1. **Gather**: fetch each source (one retry on failure; mark unavailable).
2. **Validate**: quarantine malformed records.
3. **Normalize**: Parthia's dictionary; unknown names stay unmapped, never guessed.
4. **Reconcile**: Task 2.
5. **Check**: `evaluatePatient()` on the reconciled current list + Passport entries.
6. **Clarify**: if a medicine is patient-reported and missing from every clinical source,
   **pause** and ask the patient "Are you currently taking X?"; rules for it wait. Resume on answer.
7. **Explain**: attach evidence and source records to every finding; build a structured review
   request with route and priority from the rules (port `../chartfuse/lib/review.ts`;
   deterministic templates only, no LLM in the static build).
8. **Route**: hand each finding to pharmacist or clinician and **wait**. The agent never attempts a
   medication change on its own.

Policy (`src/lib/clinician/policy.ts`, port `../chartfuse/lib/policy.ts`): allowed = gather,
validate, normalize, reconcile, check, ask, explain, route, open-provider-workflow (only after a
recorded clinician approval), export. Denied, always: update list, stop, change dose, substitute,
write prescription. The demo shows a **user-initiated** "Stop ibuprofen" being refused.

Every step appends a trace entry `{ stage, tool, status: ok|retry|failed|waiting|blocked|info, summary }`.

### Task 4b: Photon drug-drug and drug-allergy screening (≈1.5 h, HIGH priority: Photon prize)

Mentor suggestion: use Photon's own interaction screening, not only our rules. Photon exposes
**`prescriptionScreen`** (docs: https://docs.photon.health/docs/using-ddi-and-dai). It screens
**drafted prescriptions** against the patient's synced allergies, synced medication history and
previous Photon prescriptions, and returns alerts with `type` (`DRUG` | `ALLERGEN`), `severity`
(`MAJOR` | `MODERATE`), `description` and `involvedEntities` (allergen, drafted prescription,
existing prescription). Sandbox endpoint: `https://clinical-api.neutron.health/graphql`.

Query, verbatim from Photon's docs:
```graphql
query Query($draftedPrescriptions: [DraftedPrescriptionInput!]!, $patientId: ID!) {
  prescriptionScreen(draftedPrescriptions: $draftedPrescriptions, patientId: $patientId) {
    alerts {
      description
      involvedEntities {
        ... on PrescriptionScreeningAlertInvolvedAllergen { id name }
        ... on PrescriptionScreeningAlertInvolvedDraftedPrescription { id name }
        ... on PrescriptionScreeningAlertInvolvedExistingPrescription { id name }
      }
      severity
      type
    }
  }
}
```
`DraftedPrescriptionInput` needs at least `treatmentId`.

**The secret problem.** This needs a Photon token; the Parthia app is a static export with no
server. Do NOT put the client secret in the browser. Solution on Vercel (hosting is decided):
- Deploy with Vercel framework preset **"Other"**: build command `npm run build`, output dir
  `out`. This keeps `output: "export"` intact.
- Add Vercel Functions in a root `api/` folder (outside `src/`, ignored by the Next build):
  - `api/photon/token.ts` (internal helper): client-credentials token from
    `https://auth.neutron.health/oauth/token`, audience `https://api.neutron.health`, cached in
    memory until expiry. Env vars in Vercel only: `PHOTON_CLIENT_ID`, `PHOTON_CLIENT_SECRET`.
  - `api/photon/sync.ts`: for the demo patient, create or look up the Photon sandbox patient,
    sync Harold's allergies, sync his medication history.
  - `api/photon/screen.ts`: `POST { patientId, treatmentIds[] }` → calls `prescriptionScreen`
    → returns the alerts unchanged.
  - Rate-limit to the demo use and validate inputs (allow-list of known treatment ids).
- **Verify against Photon's reference before coding** (https://reference.photon.health/): the exact
  mutation names and inputs for creating a patient, syncing allergies, syncing medication history,
  and searching the treatment catalog for `treatmentId`s; and whether an M2M token is accepted for
  `prescriptionScreen` (the docs example uses an auth0 user token header,
  `x-photon-auth-token` + `x-photon-auth-token-type: auth0`; M2M tokens can do everything except
  write prescriptions, so it should work, but confirm in the sandbox). Do not invent field names.
- Note from the docs: allergy screening only works if allergies were synced via the API.

**VERIFIED tonight (2 Oct, 22:40) with the team's sandbox credentials:**
- Credentials: M2M client id/secret are in Om's credential store and in the git-ignored
  `.env.local` at `/Users/theomthakur/Documents/Projects/parthia-health/.env.local`
  (`PHOTON_CLIENT_ID`, `PHOTON_CLIENT_SECRET`, `PHOTON_AUTH_URL`, `PHOTON_AUDIENCE`,
  `PHOTON_GRAPHQL_URL`). Copy it into your worktree; set the same vars in the Vercel project.
  Never commit them, never expose the secret to the browser.
- Token: `POST https://auth.neutron.health/oauth/token` with
  `{client_id, client_secret, audience: "https://api.neutron.health", grant_type: "client_credentials"}`
  → `access_token`, `expires_in: 86400`. Scopes: `read:patient write:patient read:prescription
  read:order write:order write:invite read:invite read:organization` (no prescription writing).
- **Clinical API** `https://clinical-api.neutron.health/graphql` accepts the M2M token with headers
  `x-photon-auth-token: <access_token>` and `x-photon-auth-token-type: auth0` (NOT `Authorization:
  Bearer`, which returns `EMPTY_AUTHORIZATION_HEADER`). Its Query type includes
  `prescriptionScreen`, `treatments`, `allergens`, `patients`, `patient`, `medicationFromNdc`.
- **Main API** `https://api.neutron.health/graphql` accepts `Authorization: Bearer <token>`; Query
  includes `patients`, `patient`, `prescriptions`, `orders`, `fill`, `pharmacies`, `medications`,
  `medicationConcepts`, `allergens`, `catalogs`. Use it for patient lookup/creation and orders.
- Still to check: mutation names for creating a patient and syncing allergies / medication
  history, and the `treatments` search argument for `treatmentId`s. Use GraphQL introspection
  (`__type(name: "Mutation")`) on each endpoint with the token.
- The SPA client id (`NEXT_PUBLIC_PHOTON_SPA_CLIENT_ID`) is public, whitelisted for
  `http://localhost:3000` only. Add the Vercel URL in Photon settings if Photon Elements are used.

**Where it shows up in the clinician view:**
- When the clinician picks **"Draft a prescription"** (e.g. ciprofloxacin for Harold's UTI, or
  re-screening his current list), call `/api/photon/screen` **before** the "Continue in Photon"
  handoff. Show Photon's alerts in their own panel: "Photon screening (Neutron sandbox)", each
  with type, severity, description and the involved medicines/allergens.
- Show them **next to** Parthia's rule findings, not merged: agreement (both flag warfarin +
  ciprofloxacin) is a strong demo moment; disagreements are shown as-is, never hidden.
- Add the agent tool `screen_with_photon` (allowed: read-only screening) to the policy and to the
  trace; it never submits a prescription. Add it to the MCP server too.
- Harold's allergy (e.g. penicillin): draft amoxicillin to show an `ALLERGEN` alert live.

**Fallback (must exist):** if keys are missing or the sandbox is down, the panel shows
"Photon screening unavailable" and the rest of the flow continues. Also record one real sandbox
response to `src/lib/clinician/fixtures/photon-screen.recorded.json` (with the date) and allow
the UI to show it labelled "Recorded sandbox response" if live calls fail during the demo.

**Acceptance:** with keys set on Vercel, drafting ciprofloxacin for Harold returns a live Photon
DRUG alert with warfarin, and drafting amoxicillin returns an ALLERGEN alert (if his penicillin
allergy was synced); without keys the app still works and says screening is unavailable; the
secret never appears in the browser bundle (`grep -r PHOTON_CLIENT_SECRET out/` finds nothing).

### Task 5: Clinician workspace route `/clinician/` (≈2 h)

Parthia's look and feel. Sections, top to bottom:
1. **Patient header**: persona switcher (reuse `PatientSwitcher`), conditions, allergies, and
   "Shared from Parthia Passport on <date>" badge.
2. **Agent mission** (port the layout idea of `../chartfuse/components/AgentMission.tsx`):
   inputs with on/off toggles (simulate outage), a live "what I'm doing now" line, the 8-step plan
   lighting up, and **"decided by the agent" vs "left to a human"** counters.
3. **Reconciled list**: ingredient (RxCUI), as written, record type, source badge (reuse
   `SourceBadge`), date, state.
4. **Ask the agent**: chat with example chips; answers built from lookups with the tools shown
   (port `../chartfuse/lib/chat.ts`); medication-change requests refused by policy. Can reuse the
   `AssistantProvider` interface so the patient assistant and clinician agent share plumbing.
5. **Clinician review**: findings list → evidence panel (label passage first, then source
   records) → decision panel: acknowledge, mark for review, note, defer, decline handoff,
   **Continue in Photon** (opens the provider workflow URL in a new tab; nothing is submitted by
   the app). Handoffs are idempotent.
6. **Export**: reconciliation report (Markdown + print view) with sources, findings, evidence,
   decisions, Photon handoff status, open questions and the full audit trail. Reuse the existing
   print/PDF approach from `/passport/share/`.

Link it from the app shell ("Clinician view") and from `/passport/share/` ("Open as clinician").

### Task 6: Live public FHIR import (≈45 min)

Add "Public FHIR sandbox (live)" to `/passport/add/` next to the simulated Epic import:
- Browser-side fetch from `https://r4.smarthealthit.org` (CORS works): list patients with active
  `MedicationRequest`s, import Patient + MedicationRequest + Condition.
- Map medicines with the existing dictionary first; if unmapped, call RxNav
  (`/rxcui/{code}/related.json?tty=IN`, or `/approximateTerm.json` for text-only) and record
  "ingredient via RxNav (live)". **Do not send `Accept: application/fhir+json` to RxNav**: it
  returns 406. Combination products: take the first ingredient and label it a combination.
- Imports land in **Review** like every other source. Real server, synthetic (Synthea) patients;
  say exactly that in the UI.
- Reference: `../chartfuse/lib/fhirLive.ts`.

### Task 7: Prototype evaluation page `/clinician/eval/` (≈45 min)

Port the 12 cases from `../chartfuse/lib/eval/cases.ts` (5 expected findings, 4 non-triggers,
2 ambiguous/abstain, 1 unavailable source), adapted to Parthia's engine. Each case declares
expected **and** prohibited findings; any undeclared finding counts as unexpected. Show tiles +
table. Label: "Prototype evaluation against configured rules, not clinical validation."
Add the cases to vitest too.

### Task 8: MCP server (≈45 min)

Port `../chartfuse/mcp/server.mts` into `mcp/` here (a Node script outside the Next build, so the
static export is unaffected). Tools: `list_patients`, `reconcile_patient`,
`add_patient_reported_medication`, `confirm_patient_answer`, `get_evidence`, `get_provenance`,
`ask_agent`, `request_medication_change` (always refused), `run_evaluation`. **Do not** expose
recording clinician decisions or prescribing. Ship `.mcp.json` and a smoke script.

### Task 9: New logo (≈30 min, do after Task 5 so the clinician view gets it too)

Today the mark is a leaf (`LeafMark` in `src/components/Wordmark.tsx`, deep teal `#0E5C56`
tile, cream leaf, gold dot `#C9962B`). Replace it with a mark that says **many records fused
into one safe list**, which is the product now that the clinician agent exists.

- **Concept:** three record lines entering from the left and merging into one line that ends
  in a node (the reconciled list), with one small accent dot (a finding surfaced). Same idea as
  the interim ChartFuse mark in `../chartfuse/app/icon.svg`, redrawn in Parthia's palette:
  tile `#0E5C56`, lines `#F7F4EE`, accent dot `#C9962B`. Rounded tile, 64×64 viewBox,
  2.5 to 3 px strokes at 64 px, must stay legible at 16 px (test the favicon).
- **Files to change:**
  1. `src/components/Wordmark.tsx`: replace `LeafMark` with the new `Mark` (keep the export
     name or update every import; `grep -rn LeafMark src`).
  2. `scripts/generate-icons.mjs`: update the two SVG templates (normal + maskable with safe
     padding), then run `node scripts/generate-icons.mjs` to regenerate
     `public/icons/*` (icon-192/512, maskable-192/512, apple-touch-icon, favicon-48, badge-96).
  3. Check `public/manifest.json`, `src/app/layout.tsx` metadata icons and the service worker
     cache list (`public/sw.js`) still point at the regenerated files; bump the SW cache
     version so installed PWAs pick up the new icons.
  4. Wordmark text: "Parthia Health" (decided); the clinician view header reads
     "Parthia Health · Clinician view".
- **Acceptance:** new mark in the app header, About page, favicon, installed-PWA icon and the
  printed share/report header; looks right on light background at 16, 32, 64 and 512 px;
  lint/typecheck/tests/build green.

### Task 10 (stretch, only if 1 to 9 are green by noon): care-journey route `/visit/`

Spec in `../chartfuse/KIRO-PLAN.md` ("/visit, the care-journey route"). Same rules: simulated
Epic/Oracle/payer/scheduling/pharmacy connectors, red-flag symptoms stop the flow, the clinician
picks the prescription, the interaction check runs before the Photon handoff, bills are estimates.

---

## 5. Definition of done (every task)

- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all pass.
- The flow clicked through in a browser with no console errors, on desktop and at 390 px wide.
- New logic is pure, in `src/lib/clinician/`, with tests.

## 6. Demo flow to make work end to end (rehearse twice)

1. Patient side (`/passport/`): Harold adds an OTC medicine (ibuprofen); Parthia's patient view
   already flags what it can.
2. **Share** → **Open as clinician** (`/clinician/`).
3. **Launch agent**: sources light up one by one; the urgent-care toggle can be switched off to
   show retry + "cannot be marked complete".
4. The agent **pauses** to ask about the OTC medicine; confirm; it reruns.
5. Warfarin + ibuprofen appears with the FDA passage and every source record.
5b. Clinician drafts ciprofloxacin → **Photon screening** returns its own DRUG alert with
   warfarin, shown next to Parthia's rule finding (two independent checks agree).
6. In chat: "Why is warfarin flagged?", "Which sources disagree?", then **"Stop ibuprofen"** →
   refused by policy.
7. Clinician decides → **Continue in Photon** → provider workflow opens.
8. Export the reconciliation report. Show `/clinician/eval/` and the MCP server in Claude Code.

## 7. Out of scope

Real Epic/Oracle/payer integrations, real authentication, real patient data, autonomous
prescribing, dose calculation, server-side code in this repo, Visualize AI, changing the Azure
production deployment.

## 8. Team decisions (final)

1. **Product name: DECIDED, "Parthia Health".** No ChartFuse branding anywhere in this repo; the
   clinician side is "Parthia Health · Clinician view". Wordmark stays "Parthia Health".
2. **Hosting for judges: DECIDED, Vercel.** Deploy the `hackathon/clinician-agent` branch to a
   new Vercel project (framework preset Next.js; the static export in `out/` works as-is, keep
   `output: "export"`). Do not change the Azure production setup. Add the Vercel URL to the README
   and smoke-test the demo flow on it by 1:00 PM.
3. **Hero patient: DECIDED, Harold Okafor, 68.** He is the demo patient on both sides. Build the
   clinician-side records around him: hospital (warfarin, atorvastatin and his other meds),
   urgent care (ciprofloxacin for a UTI, triggering the INR-monitoring rule), specialist (one
   medicine marked stopped that the hospital still lists active, and a stale record), Photon fills,
   and an OTC ibuprofen he reports from his Passport that no clinical source has (the pause, then
   the warfarin + ibuprofen finding). Maria Santos may be ported as a secondary patient only if
   time allows.
