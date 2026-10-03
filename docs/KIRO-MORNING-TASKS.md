# Kiro: Saturday morning tasks (demo 4:00 PM, feature freeze 2:00 PM)

Status checked at 9:00 AM on `.worktrees/clinician-core` (branch `hackathon/clinician-agent`):
the clinician flow works end to end, tsc/lint clean, 210/210 tests pass. Great work.
Everything below is verified by hand this morning. Do the tasks **in order**; commit after each
with tests green. Same ground rules as `docs/HACKATHON-KIRO-PLAN.md` (no autonomous prescribing,
rules decide, synthetic data only, no em dashes, never touch `main` or Azure).

---

## M1. Correctness fixes a judge would catch (30 to 45 min, do first)

1. **Run Parthia's full engine in the clinician agent.** Today the agent only applies its own two
   label rules. Call `evaluatePatient()` (all of `RULES`: drug-drug, drug-allergy, drug-nutrient,
   burden, mood, passport rules) on the reconciled current list + Passport entries, and map every
   `RiskFlag` to a finding (keep `suggestedNextStep` as the reviewer question).
   - **Harold must show a drug-allergy finding:** his allergy list says "Ibuprofen (NSAIDs)" and he
     confirms taking Advil 200 mg. Today nothing flags it.
   - **Harold must show warfarin + aspirin** (he reports aspirin 81 mg; Parthia's table has
     warfarin + antiplatelet as high).
   - **Deduplicate:** warfarin + ibuprofen stays ONE finding, carrying the FDA label passage, with
     Parthia's rule id attached as supporting evidence.
   - Add tests for all three.
2. **Fix the two broken evidence links** in `src/lib/clinician/agent.ts` (both checked this morning):
   - FDA URL `.../label/2024/017463s115lbl.pdf` returns **404**. Use the FDA Advil label:
     `https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/211733Orig1s007lbl.pdf`
     (loads, contains the stomach bleeding warning).
   - DailyMed `setid=4b9757f9-...` opens the DailyMed homepage, not a label. Use the ciprofloxacin
     label: `https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=b064286b-fedc-be68-e053-2995a90aae52&type=display`
     (loads, contains the prothrombin time / INR monitoring text).
   - Add a small test that every evidence URL is one of the verified URLs above.
3. **Centre the layout.** On wide screens the clinician workspace sits off-centre. Fix the page
   container so content is centred with equal side margins: one wrapper
   `mx-auto w-full max-w-[1440px] px-4 sm:px-6`, and make the inner grid fill it
   (`grid-cols-[260px_minmax(0,1fr)_380px]` with `justify-center`/`w-full`, no fixed min widths
   that push content). Check visually at 1280, 1440, 1920 and 2560 px wide and at 390 px mobile.
   Apply the same to `/clinician/eval/`, `/clinician/presentation/`, `/clinician/system-design/`.

## M2. Photon drug-drug and drug-allergy screening, LIVE (≈1 h, Photon prize)

Verified against the Neutron sandbox this morning with the M2M credentials in `.env.local`
(copy `/Users/theomthakur/Documents/Projects/parthia-health/.env.local` into your worktree).

**Auth.** `POST https://auth.neutron.health/oauth/token`
`{client_id, client_secret, audience: "https://api.neutron.health", grant_type: "client_credentials"}`
→ `access_token` (24 h). Cache it server-side.

**Two endpoints, two header styles:**
| API | URL | Header |
|---|---|---|
| Main | `https://api.neutron.health/graphql` | `Authorization: Bearer <token>` |
| Clinical | `https://clinical-api.neutron.health/graphql` | `x-photon-auth-token: <token>` and `x-photon-auth-token-type: auth0` |

**Calls (exact names from introspection):**
1. **Treatment ids** (clinical API): `treatments(filter: { term: "warfarin" }) { id name }`
   → e.g. "Warfarin Sodium Oral Tablet 5 MG" = `med_01KZEXS5037PM8ND32W632Q9Q4`. Look up ids for
   the demo drugs (warfarin 5 mg, ibuprofen 200 mg, aspirin 81 mg, ciprofloxacin 500 mg,
   amoxicillin 500 mg, atorvastatin 40 mg, metoprolol) once, and store them in
   `src/lib/clinician/photonTreatments.json` with the lookup date.
2. **Allergen ids** (clinical API): `allergens(filter: { name: "penicillin" }) { id name }`
   (filter fields: `name`, `rxNormId`, `mediSpanId`; there is no `rxcui` field). Store Harold's
   allergen ids (ibuprofen/NSAID, penicillin) the same way.
3. **Create the sandbox patient WITH allergies and medication history** (main API; the clinical
   API's `createPatient` has no allergy field):
   `createPatient(externalId, name: {first, last}, dateOfBirth, sex: MALE, allergies: [{allergenId}],
   medicationHistory: [{medicationId, active: true}])` → returns the Photon patient id.
   Use `externalId: "parthia-harold-okafor"` and look it up first so it is created once
   (`updatePatient(id, allergies, medicationHistory)` to change it later).
4. **Screen** (clinical API):
   `prescriptionScreen(patientId: ID!, draftedPrescriptions: [DraftedPrescriptionInput!]!, diagnosisCodes)`
   where each drafted prescription is `{ treatment: { id: "<med_...>" } }` (other optional fields:
   `dispenseQuantity`, `daysSupply`, `instructions`, ...). Returns `alerts { type severity
   description involvedEntities {...} }` (query text in `docs/HACKATHON-KIRO-PLAN.md`, Task 4b).

**Wire it up** (Vercel Functions in root `api/`, keys only in Vercel env vars):
- `api/photon/sync-patient.ts` → steps 3 (idempotent).
- `api/photon/screen.ts` → step 4 for `{ treatmentIds[] }`.
- In the clinician view, **"Screen draft"** calls these and shows live alerts labelled
  "Photon screening (Neutron sandbox, live)". Keep the recorded fallback only when the call fails,
  labelled "Recorded sandbox response".
- **Demo checks:** drafting **ciprofloxacin** for Harold returns a DRUG alert with warfarin;
  drafting **amoxicillin** returns an ALLERGEN alert (penicillin); drafting **ibuprofen** returns
  DRUG (warfarin) and ALLERGEN (NSAID) alerts.
- **Record** one real response for each of the three into `fixtures/` with the timestamp.
- Note: `next dev` does not serve root `api/` functions. Test them with `vercel dev`, or with a
  small Node script that imports the handlers, before deploying.

## M3. Multi-agent orchestration: agents that talk to each other (≈1.5 h)

Today there is one coordinator. Turn its stages into a small team of **deterministic agents**
that communicate through a shared, append-only **message bus** (a blackboard), coordinated by an
**Orchestrator**. No LLM needed; every message is generated from real tool results.

**Agents** (`src/lib/agents/*.ts`, each with its own allowed tools via `policy.ts`):
| Agent | Owns | Allowed tools |
|---|---|---|
| Orchestrator | plan, hand-offs, completion | assign, wait, summarise |
| Records agent | gather + validate sources, retries | fetch_source, validate |
| Reconciliation agent | normalize + reconcile with provenance | normalize, reconcile |
| Safety agent | Parthia rules + label evidence | evaluate_rules, attach_evidence |
| Photon agent | sandbox patient sync + `prescriptionScreen` | photon_sync, photon_screen (read-only) |
| Patient liaison | questions to the patient, answers back | ask_patient |
| Clinician liaison | review requests, decisions, Photon handoff link | route_review, open_provider_workflow (after approval) |

**Bus** (`src/lib/agents/bus.ts`): `Message { id, at, from, to, kind: "task" | "result" |
"question" | "answer" | "handoff" | "blocked", body, refs: { recordIds?, findingIds? } }`.
Pure functions: `post`, `inbox(agent)`, `replay()`. Persist the bus with the case so a reload
resumes exactly (idempotent: re-running never posts a duplicate handoff).

**Flow:** Orchestrator → Records ("gather all sources") → Records → Reconciliation ("9 records,
1 quarantined") → Reconciliation → Safety ("reconciled list ready") → Safety → Patient liaison
("Advil is patient-reported only, confirm?") → patient answers → Safety reruns → Safety → Photon
agent ("screen ciprofloxacin draft") → Photon → Safety (alerts) → Safety → Clinician liaison
(findings + evidence) → waits for the human. A user "Stop ibuprofen" goes to the Orchestrator,
which asks policy and posts `blocked`.

**UI:** add an **"Agent team"** panel: each agent as a card (status: idle, working, waiting,
blocked, done) and a live message feed between them (from → to, kind, one-line body, links to
records and findings). Keep the existing 8-step plan; each step now names the agent that did it.
Tests: the full Harold flow produces the expected message sequence; no agent calls a tool outside
its allow-list; the bus replays to the same result.

## M4. Agents across the whole website (≈1 h)

Make the agents available on every page, aware of where the user is:
1. **Global agent panel** in `src/components/AppShell.tsx`: a docked "Ask Parthia" button that
   opens a side panel on every route, reusing the clinician chat engine with page context.
2. **Page context** passed to the agent: route + what is on screen.
   | Page | What the agent can do there |
   |---|---|
   | `/` dashboard | explain each of the four indicators and what drives them |
   | `/passport/*` | explain where any item came from (provenance), what is pending review |
   | `/passport/review/` | walk through each reconciliation issue and the options |
   | `/medications/`, `/safety` | explain every flag, its rule and evidence |
   | `/log/*` | after the patient logs a med/symptom/meal, the Safety agent rechecks and says what changed |
   | `/trends/` | describe trends around medication changes (no diagnosis) |
   | `/passport/share/` | build the clinician summary; "Open as clinician" hands off to `/clinician/` |
   | `/clinician/*` | the full agent team (M3) |
3. **Event triggers:** when the Passport changes (new item confirmed, import, reconciliation
   resolved), post a `task` to the bus so the Safety agent re-evaluates and the panel shows
   "1 new finding since your last visit". Patient-side wording stays plain and every action
   is a question for the clinician.
4. **Same policy everywhere:** the patient-side agent can explain, summarise and navigate; it can
   never change a medication or contact anyone on the patient's behalf.
5. Keep every reply labelled "AI-generated" as the existing assistant does.

## M5. Ship (from noon, not later)

1. Commit everything. `git fetch hackathon && git rebase hackathon/hackathon/base` (resolve
   conflicts; the base has only the plan doc on top of Parthia).
2. `git push hackathon hackathon/clinician-agent` (also push `hackathon/live-fhir-import` if
   not already merged into it).
3. Vercel: new project from `santiago9107/hackathon_parthia`, branch `hackathon/clinician-agent`,
   framework preset **Other**, build `npm run build`, output `out`, env vars `PHOTON_*` from
   `.env.local`. Add the Vercel URL to Photon's whitelisted URLs if Photon Elements are used.
4. On the Vercel URL: run Harold's full demo twice (pause → confirm → findings incl. allergy and
   aspirin → live Photon screen → "Stop ibuprofen" refused → Continue in Photon → export).
5. **Stop at 2:00 PM.** After that only fixes. If M3 or M4 are not done by 1:00 PM, leave them
   out; M1, M2 and M5 are what the demo needs.
