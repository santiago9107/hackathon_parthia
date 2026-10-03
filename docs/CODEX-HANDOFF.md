# Codex handoff: Parthia Health, Hackers & Healers NYC

You are taking over from Kiro at about 12:35 PM on Sat 3 Oct 2026. Read this whole file before
running anything. Two changes from the team since Kiro's plan:

1. **Margaret Lindqvist is now the hero patient**, not Harold Okafor. Harold stays in the patient
   switcher as a second case.
2. **Build the architecture's stages 3 and 4 today**: calculated measures, heart failure data,
   specialist agents with an orchestrator, and a safety reviewer. All deterministic, no backend, no
   language model.

Reference docs in `docs/`: `DATA-AI-ARCHITECTURE.md` and `architecture-diagram.png` (the team's
architecture), `ARCHITECTURE-IMPLEMENTATION-PLAN.md` (data shapes and rules for everything below,
plus the later phases), `KIRO-MORNING-TASKS.md` (patient-agent rules).

## Timeline (Eastern time)

There are two work streams. If you can run two Codex sessions, run Stream A and Stream B at the
same time in separate worktrees. If you have one session, do A1, A2, B1, A3, A4, B2 in that order
and use the cut lines.

| Time | Stream A (worktree `.worktrees/demo`) | Stream B (worktree `.worktrees/demo-photon`) |
|---|---|---|
| 12:35 to 12:45 | Section 3: verify the starting state | Create the worktree (section 3) |
| 12:45 to 1:05 | **A1** deploy config + Photon path check | **B1** Photon screening for Margaret (12:45 to 1:30) |
| 1:05 to 1:20 | **A2** Margaret as hero | B1 continued |
| 1:20 to 1:40 | **A3** stage 3 measures + heart failure data | **B2** `/architecture` page (1:30 to 1:55) |
| 1:40 to 1:58 | **A4** specialist agents, orchestrator, safety reviewer | B2 continued |
| **2:00** | **Feature freeze.** Merge B into A, run everything | |
| 2:00 to 2:10 | **C** merge, `/reset`, full test run | |
| 2:10 to 2:30 | **D** rehearsal under `vercel dev` | |
| 2:30 to 2:50 | **E** push, Vercel preview, production, smoke test | |
| 2:50 to 3:00 | **F** QR code | |
| 4:00 | Live demo (no slides) | |

**Stream C (visual polish, section 6b)** runs in a third session from 12:45 to 1:55 in its own
worktree `.worktrees/demo-polish`, branch `hackathon/demo-polish`, created like Stream B. If you only
have two sessions, Stream B does C1 and C2 right after B1 (1:30 to 1:50), B2 becomes a shorter page,
and C3 and C4 happen in the merge window (task C), which then runs to 2:20 and moves the deploy to
2:40.

**Cut lines.** At 1:40, if A3 is not committed and green, drop the heart failure rules and keep
only the measures. At 1:58, if A4 is not green, do not merge it; the five existing agents stay. At
1:30, if B1 has no live Margaret screen working, use the fallback in B1. A1, C, D and E can never be
dropped.

## 1. Where everything is

- Repo: `/Users/theomthakur/Documents/Projects/parthia-health`
- Stream A works in `.worktrees/demo`, branch `hackathon/demo`, starting at `2043373`.
- Stream B works in `.worktrees/demo-photon`, branch `hackathon/demo-photon`, created from the same
  commit.
- Do not edit any other worktree (`clinician-core`, `photon-screen`, `patient-agent`,
  `agents-roster`, `fhir-live`); they are already merged.
- Push only `hackathon/demo`, to the remote named `hackathon`
  (`github.com/santiago9107/hackathon_parthia`). **Never push to `main` on any remote. Never push to
  `origin`** (Santiago's original repo).
- **Use Node 22**: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH` in every shell. Node 18 is the
  default and Vitest fails under it.
- Ports: 3000 belongs to Om (leave it), 3360 is `vercel dev`, use 3337+ for anything else.

## 2. The app and the new demo story

Parthia Health is a patient-owned medication-safety app. **The patient is the main character; the
clinician view is the last 60 seconds.**

Stack: Next.js 16 static export (`output: "export"`, `trailingSlash: true`), React 19, Tailwind v4
tokens in `src/app/globals.css`, Vitest, on-device IndexedDB Passport. Server code only in root
`api/` as Vercel Functions (`api/photon/token.ts`, `sync-patient.ts`, `screen.ts`). `next dev` does
not serve `api/`; `vercel dev` and Vercel do.

Already on `hackathon/demo`: 14-rule safety engine (`src/lib/safetyEngine`), reconciliation,
clinician agent with one tool policy (`src/lib/clinician/agent.ts`, `policy.ts`), live Photon
screening panel in the clinician view, patient agent (dashboard card, recheck after logging,
"Prepare for my visit", global Ask Parthia panel, `src/lib/patientAgent`), `/agents` roster
(`src/lib/agents/roster.ts`), Heather Song's reminders and Synthea import.

**Margaret Lindqvist** (`p-margaret`), 72: heart failure with preserved ejection fraction, type 2
diabetes, depression, 9 medicines including sertraline, zolpidem, glipizide, carvedilol and
furosemide. The current engine already gives her, verified at 12:20:
- high: anticholinergic burden score of 8
- high: depression screening score went up after the sertraline change
- moderate: confirm Benadryl 25 mg (patient-reported, waiting for confirmation)
- moderate: 2 medicines that act on the brain
- moderate: drowsiness can add up: sertraline + diphenhydramine, sertraline + zolpidem
- moderate: kidney function falling while on medicines that depend on it
- moderate: mood dropped since sertraline was adjusted
- moderate (clinician) / low (patient): a beta-blocker can hide low blood sugar (glipizide +
  carvedilol)

**New 3-minute demo path:**
1. Home: Margaret's agent card, "new things to ask your doctor about".
2. She logs **Benadryl 25 mg for sleep** (`/log/medication`). The inline recheck shows the
   anticholinergic burden and the drowsiness combinations in plain words, with a falls note for her
   age, as questions for her doctor.
3. Ask Parthia: "Why is this flagged?" The answer cites the rule and her records.
4. Trends: her weight is up over 3 days (heart failure signal, from A3).
5. "Prepare for my visit", then the share page, then "Open as clinician".
6. Clinician view: the specialist review (A4). Pharmacist, cardiology, nutrition and behavioral
   health findings, the orchestrator linking sertraline across two specialists, and the safety
   reviewer's pass/block count. Then **live Photon screening of a draft for Margaret** (B1).
7. `/agents` and `/architecture`.

## 3. Verify the starting state

```bash
cd /Users/theomthakur/Documents/Projects/parthia-health/.worktrees/demo
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
git status --short   # expect only the new docs/ files from this handoff
git log --oneline -1 # expect 2043373
npx tsc --noEmit && npm run lint && npx vitest run   # expect 358 tests passing
```

Commit the docs (`docs/CODEX-HANDOFF.md`, `docs/DATA-AI-ARCHITECTURE.md`,
`docs/ARCHITECTURE-IMPLEMENTATION-PLAN.md`, `docs/architecture-diagram.png`) as the first commit. If
the test count is not 358, stop and tell Om.

Stream B, after that commit:
```bash
cd /Users/theomthakur/Documents/Projects/parthia-health
git worktree add -b hackathon/demo-photon .worktrees/demo-photon hackathon/demo
cd .worktrees/demo-photon && cp -c -R ../demo/node_modules ./node_modules
cp ../../.env.local .env.local && chmod 600 .env.local
```
Stream C, the same way:
```bash
cd /Users/theomthakur/Documents/Projects/parthia-health
git worktree add -b hackathon/demo-polish .worktrees/demo-polish hackathon/demo
cd .worktrees/demo-polish && cp -c -R ../demo/node_modules ./node_modules
```
(Copy `node_modules`; a symlink breaks Turbopack.)

## 4. Secrets: never broken

- Secrets live only in git-ignored `.env.local` and in Vercel's settings. In each worktree:
  `cp ../../.env.local .env.local && chmod 600 .env.local`. Never print values, never commit them,
  never put them in a file, log or commit message.
- Names: `PHOTON_CLIENT_ID`, `PHOTON_CLIENT_SECRET`, `PHOTON_AUTH_URL`, `PHOTON_AUDIENCE`,
  `PHOTON_GRAPHQL_URL`, `PHOTON_USER_TOKEN` (server only), `NEXT_PUBLIC_PHOTON_SPA_CLIENT_ID`,
  `NEXT_PUBLIC_PHOTON_PROVIDER_URL` (public ids). Never put `NEXT_PUBLIC_` on a secret.
- `PHOTON_USER_TOKEN` is only for the read-only `prescriptionScreen` call, never a mutation. It
  expires around 10:45 PM tonight.
- No OpenAI or OpenRouter key exists and none will be added. No meal photo AI.

## 5. Stream A tasks

### A1 (12:45 to 1:05): deploy config and Photon path. Cannot be dropped.
1. Root `vercel.json`: `{ "framework": null, "buildCommand": "npm run build", "outputDirectory": "out" }`
2. `package.json`: `"engines": { "node": "22.x" }`
3. `npx vercel link --yes --project parthia-health` (CLI is logged in as theomthakur-2378). If the
   name is taken, use `parthia-health-demo` and tell Om.
4. `npx vercel dev --listen 3360` in the background. Confirm the clinician Photon panel's call to
   `/api/photon/screen` returns 200 with live results, not a 308 redirect (`trailingSlash: true`
   caused a 308 under `next dev`). If it redirects, make the client call the exact served path. Stop
   `vercel dev` when done.
5. Commit.

### A2 (1:05 to 1:20): Margaret as hero
1. Make `p-margaret` the default patient (find the initial value in
   `src/lib/context/PatientContext.tsx` and anywhere else that defaults to Harold). Harold stays in
   the switcher.
2. In `src/lib/clinician/cases.ts`, give Margaret the full multi-source case Harold has today
   (`sources(p.id === "p-harold")` gates the extra sources; include Margaret). Keep her existing
   extras (sertraline stopped/filled, Benadryl unconfirmed). Add one cross-source difference that
   is true to her record (for example a furosemide dose that differs between the hospital and the
   cardiology record) so reconciliation has something to show.
3. `/agents` (`src/app/agents/page.tsx`) computes its numbers from Harold's run. Switch it to
   Margaret's run and her name. Update the Nova `why` line in `src/lib/agents/roster.ts`
   ("the moment Margaret logs a medicine..."). Do not change the other tributes.
4. Add clinician eval cases for Margaret in `src/lib/clinician/eval.ts`: Benadryl unconfirmed
   waits; Benadryl confirmed raises the drowsiness and anticholinergic findings; Benadryl denied
   removes them.
5. Update the demo script in `docs/KIRO-MORNING-TASKS.md` to the path in section 2.
6. Tests green, commit.

### A3 (1:20 to 1:40): stage 3 measures and heart failure data
Follow `ARCHITECTURE-IMPLEMENTATION-PLAN.md` Part A3 for the `Measure` shape and math, plus these
additions:
1. `src/lib/measures/index.ts`: `computeMeasures(record, now)`: weight change over 3 and 7 days,
   BP and heart-rate trend over 14 days, potassium and eGFR trend, PHQ-9 change, missed doses.
   Missing data returns `insufficient-data`, never 0. Every value carries `basis` record ids.
2. Heart failure profile for Margaret: add an optional `heartFailure?: { phenotype: "HFrEF" |
   "HFmrEF" | "HFpEF"; lvef?: { value: number; date: string }; nyhaClass?: 1 | 2 | 3 | 4 }` to
   `PatientRecord` (optional, so nothing else breaks). Margaret: HFpEF, LVEF 58% (synthetic), NYHA II.
3. Seed data for Margaret (synthetic, in `src/lib/mockData`): daily weights for 30 days with a gain
   of about 1.5 kg over the last 3 days, home BP and heart rate, two potassium and two eGFR results
   showing the existing falling kidney trend, PHQ-9 totals consistent with her existing mood
   finding.
4. Show a read-only "Measures" card on `/trends` and in the clinician view for the active patient:
   label, value, window, "based on N readings". No thresholds, colors or advice.
5. **One heart failure rule only, and only with a citation you have opened**: "weight up quickly
   with heart failure". Use a published heart failure self-care threshold from the American Heart
   Association or the 2022 AHA/ACC/HFSA heart failure guideline. Quote the passage and URL in the
   rule's evidence like the existing rules do. The finding is a question ("Your weight went up
   1.5 kg in 3 days. Ask your care team whether this needs a call today."), never an instruction.
   If you cannot open and quote a real source in 5 minutes, skip the rule and keep the measures.
6. Tests: each measure with enough and too little data, `basis` correctness, the rule fires for
   Margaret and not for a patient without heart failure. Commit.

### A4 (1:40 to 1:58): specialist agents, orchestrator, safety reviewer
Deterministic. No model. This is stage 4 of the diagram running on stage 3 facts.

1. `src/lib/agents/specialists.ts`. Four specialists, each a pure function
   `(facts: Fact[]) => SpecialistOutput`:
   - **Pharmacist**: drug-drug, anticholinergic burden, sedative combinations, kidney dosing,
     duplicates, Photon results when present.
   - **Cardiology**: heart failure measures and rule, BP/HR trends, beta-blocker findings.
   - **Nutrition**: drug-nutrient rules, diet risks, potassium.
   - **Behavioral health**: PHQ-9/GAD-7, mood, psychotropic changes.
   A `Fact` is a flag or measure with its id, rule id, ingredients and basis ids. Route by a
   rule-id-to-discipline table (one table, in one place, tested). A fact can go to two specialists.
   Each output item: `{ id, specialist, patientText, clinicianText, factIds }`, written from
   templates using only values present in the facts.
2. `src/lib/agents/orchestrator.ts`: routes facts to specialists, collects outputs, and **links
   items across specialists that share an ingredient** (for Margaret, sertraline appears in
   behavioral health and pharmacist: produce one linked item "Sertraline: mood worse since the
   change, and drowsiness with Benadryl and zolpidem"). It records a message log
   (`from`, `to`, `factIds`, `summary`) like the existing agent trace, so the clinician can see the
   agents handing work to each other.
3. `src/lib/agents/safetyReviewer.ts`: every item must cite fact ids that exist in the input; text
   must pass `validateNeutral` (`src/lib/patientAgent/neutral.ts`); no "recommend", no diagnosis
   wording ("you have"), no numbers that are not in the cited facts. Failing items are blocked with
   a reason. Return `{ passed, blocked }`.
4. UI: a "Specialist review" section in the clinician view for the active patient: one column per
   specialist, the linked cross-specialist items on top, the message log collapsible, and
   "Safety reviewer: N passed, M blocked". Patient side unchanged in this step.
5. Roster: add the specialists, orchestrator and safety reviewer to `src/lib/agents/roster.ts` and
   `/agents`. Keep the five sponsor tributes on their current agents. Give the three new
   specialists non-sponsor names with a "named for" line from medical history: cardiology
   "Willem" (Willem Einthoven, the ECG), nutrition "Elsie" (Elsie Widdowson, nutrition science),
   behavioral health "Aaron" (Aaron Beck, cognitive therapy). The pharmacist role extends Dex; the
   orchestrator extends Reid; the safety reviewer extends Iris. Update `roster.test.ts` (tributes
   stay unique; total agent count changes). Each card must say "rule-based, no language model".
6. Tests: routing table coverage, Margaret's linked sertraline item, the reviewer blocks a fixture
   set of bad outputs (invented fact id, dosing advice, diagnosis, invented number) and passes good
   ones. Commit.

## 6. Stream B tasks

### B1 (12:45 to 1:30): Photon screening for Margaret
Existing pieces: `src/lib/clinician/photonTreatments.json` (catalog, demo patient, drafts),
`photonCatalog.ts`, `api/photon/*`, the live check script, recorded responses in
`fixtures/photon/`. Harold's sandbox patient is `pat_01M412P6SKKHQH8TXN43N4BV4Q`.

1. Look up Neutron sandbox treatment ids for Margaret's active medicines with
   `treatments(filter: { term })` on `https://clinical-api.neutron.health/graphql`, and allergen ids
   for her medication allergies (`allergens(filter: { name })`).
2. Sync a sandbox patient `externalId: "parthia-margaret-lindqvist"` with her medication history
   and allergies through the existing idempotent `sync-patient` path (M2M token, main API
   `https://api.neutron.health/graphql`, Bearer auth).
3. Screen 3 candidate drafts with `prescriptionScreen` (user token, read-only). Try tramadol
   (serotonergic with sertraline), ibuprofen, and one more that Photon flags against her list. Keep
   the 3 with the clearest alerts. Record raw responses to `fixtures/photon/raw/` and screen
   fixtures like the existing ones, with timestamps and no tokens.
4. Make the catalog per patient: a `demoPatients` map keyed by Parthia patient id, each with its own
   drafts. The panel shows the drafts for the active patient. Harold's set keeps working.
5. MAJOR alerts look different from moderate (this exists for Harold; keep it).
6. Tests for the catalog lookup per patient and the recorded fallback for Margaret. Commit.

**Fallback at 1:30:** if the live Margaret screen does not work, the panel keeps Harold's working
set and is labelled "Photon screening, Harold Okafor (sandbox demo patient)". Tell Om so the
presenter can say it.

### B2 (1:30 to 1:55): `/architecture` page
Build `/architecture` as an HTML page walking the five stages from
`docs/DATA-AI-ARCHITECTURE.md`, two columns per stage: **"Running in this demo"** and **"Next"**.
Use `PageHeader` and `Card` from `src/components/PageHeader.tsx` like `src/app/about/page.tsx`.
(Superseded: the page now draws its own SVG system diagram from `src/lib/architecture/stages.ts`; no PNG.) Originally: copy the diagram and link it at the bottom as
"Full diagram". Credit the architecture to the Parthia team. Add an "Architecture" link next to
"About" in `src/components/AppShell.tsx` (desktop nav; keep `max-w-[1440px]` on header and main).

| Stage | Running in this demo | Next |
|---|---|---|
| 1 Capture | Patient forms, on-device OCR, Apple Health export, Bluetooth BP cuff, live public FHIR R4 sandbox with live RxNav mapping, Synthea import (Heather Song), simulated Epic sign-in | Epic public sandbox, smart scale |
| 2 Store | Patient Passport on the device (IndexedDB); export or delete everything | PostgreSQL on Azure, time series, pgvector, licensed interaction database. HIPAA program and BAA: say "planned", never "HIPAA-compliant" |
| 3 Analyze | Reconciliation, 14+ deterministic rules, calculated measures (weight change, BP/HR, potassium, eGFR, PHQ-9), every flag linked to its data, no AI | Licensed knowledge base, more heart failure rules |
| 4 Agents | Patient companion, records, pharmacist, cardiology, nutrition and behavioral health specialists, orchestrator, safety reviewer: all rule-based, one tool policy, every finding to a human. Live Photon prescription screening fills the "drug-drug interaction API" box | Model-written explanations held to the same safety reviewer |
| 5 Share | PDF summary with chosen sections, FHIR export, clinician view, Photon workflow only after clinician approval | Revocable secure link, SMART EHR launch, write-back, CMS Aligned Networks |

**Read the code before you write a "Running" claim.** If A3 or A4 did not land, move those items to
"Next". The rule count must come from `RULES.length`, not a hard-coded number. Leave out: AI meal
tagger, "ChatGPT/OpenAI", PostgreSQL as current, "HIPAA-compliant". Patient-facing copy says
"findings" and "questions", never "recommendations" (run `git grep -n -i recommend -- src`). Commit.

## 6b. Stream C tasks: visual polish (12:45 to 1:55)

Goal: the whole app looks like one product. No emojis or glyph characters used as icons, real
icons and logos, consistent alignment, and faces for every agent. **Stream C must not edit files
that Streams A and B own**: `src/lib/agents/*`, `src/app/agents/page.tsx`, `src/lib/clinician/*`,
`src/components/clinician/*`, `src/lib/measures/*`, `src/app/trends/page.tsx`,
`src/lib/context/*`, `src/lib/mockData/*`, `src/components/AppShell.tsx`, the Photon files. Edits
to those files wait for task C after the freeze.

### C1 (20 min): replace emoji and glyph icons with real icons
1. Find them: `git grep -n -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{2705}\x{274C}]" -- src ':!*.json'`
   Known today: `src/components/log/FormKit.tsx` (✓ in chips and the saved title, ✕ on remove),
   `src/components/passport/Reconciliation.tsx` (✓), `src/app/passport/emergency/page.tsx` (✚),
   `src/app/passport/add/scan/page.tsx`, `apple-health/page.tsx`, `device/page.tsx` (status
   lines), `src/app/agents/page.tsx` (✕, owned by Stream A: fix it in task C).
2. Replace each with an inline SVG icon in the app's existing style: add names to
   `src/components/AppIcon.tsx` (`check`, `close`, `cross-medical`, `alert`, `info`) drawn like
   the existing nav icons in `AppShell.tsx` (24 by 24 viewBox, 1.75 stroke, round caps,
   `currentColor`). Do not add an icon library. Decorative icons get `aria-hidden`; icon-only
   buttons get an `aria-label`.
3. Also check copy strings in `src/lib` for emoji (patient agent replies, notices) and replace with
   words or an icon in the component.
4. Test: one test that greps the `src` tree for the emoji ranges above (excluding JSON fixtures)
   and fails if any are found.

### C2 (25 min): faces for every agent, and sponsor logos
1. New file `src/components/agents/AgentFace.tsx`: one small SVG face per agent id, drawn in one
   shared style so they read as one team at 24 px and 48 px (pattern to follow:
   `/Users/theomthakur/Documents/Projects/raingentic-team10/components/identity/AgentFaces.tsx`,
   one shared head shape with a distinct crest, hair or accessory per agent; draw new ones, do not
   copy that project's faces). Friendly and clinical, not cartoonish. Use each agent's existing
   `color` from `roster.ts` as the accent.
   Ids: `patient` (Nova), `records` (Reid), `safety` (Dex), `photon` (Fotini), `liaison` (Iris), and
   the A4 specialists `cardiology` (Willem), `nutrition` (Elsie), `behavioral` (Aaron),
   `orchestrator`, `reviewer`. Export `AgentFace({ id, size })` with a neutral fallback for unknown
   ids. Add a test that every roster id has a face.
2. Sponsor logos for the "for <sponsor>" badges on `/agents`: DxAngels, Redesign Health, Photon
   Health, TechNovaTime, Visualize AI. Use each sponsor's own logo file from their official website
   (SVG preferred), unmodified, in `public/sponsors/<name>.svg|png`, with alt text. Spend at most 10
   minutes; any logo you cannot find stays a text badge. Export a `SponsorLogo({ name })` component
   from `src/components/agents/SponsorLogo.tsx`. Wiring both into `/agents` happens in task C.
3. Parthia's own logo: make sure the Parthia mark (`src/components/Wordmark.tsx` / `AppIcon`) is
   used in the header, the favicon, the install icons and the share page header, and not a
   placeholder anywhere.

### C3 (25 min): alignment pass on pages Stream C owns
Check at 390, 768, 1280 and 1440 px wide, with screenshots, on: `/log/*`, `/passport/*`,
`/medications/`, `/assistant/`, `/about/`, `/install/`, `/share/`.
- One page container per page: the same max width and side padding as the home page. No page
  narrower or wider for no reason.
- Headings, cards and buttons left-align to the same edge. Card grids have equal gaps and equal
  card heights in a row. Buttons in a row are the same height (at least 44 px tall for touch).
- No sideways scroll at 390 px. No text below 12 px on patient pages.
- Fix with the existing tokens and components (`PageHeader`, `Card`). No new colors.

### C5 (25 min): fix the 3D anatomy panel and move its credit
Exception to the ownership rule: Stream C owns `src/components/clinician/ClinicalBodyAtlas3D.tsx`
(only that clinician file). Problems seen on screen at 1440 px wide:
- The body is not centred in the panel. It sits to the right and is cut off at the right edge.
- "Drag to orbit · scroll to zoom · select a highlighted system" floats in the middle of the
  panel, over the body, and is clipped at the edges.
- The header says "BodyParts3D anatomy".

Fix:
1. **Centre the model from its real bounds.** After the meshes load, compute a `THREE.Box3` over
   the whole model, move the model so the box centre sits at the origin, set `controls.target` to
   the origin, and place the camera straight in front (x = 0) at the distance that fits the box
   height in the vertical field of view for the current aspect ratio, with about 10 percent
   margin. Remove the hard-coded `camera.position.set(1.15, 1.02, 3.35)` and
   `controls.target.set(0, 0.86, 0)`. Recompute the fit on resize. Auto-rotation must turn the body
   around its own vertical axis, so it stays centred while it turns.
2. **Resize properly.** Use a `ResizeObserver` on the host element: on every size change, call
   `renderer.setSize(w, h)`, set `camera.aspect = w / h`, `camera.updateProjectionMatrix()`, refit.
   The canvas must always fill the panel exactly. The text floating mid-panel comes from the canvas
   being sized once at mount while the panel grows taller.
3. **Hint text.** Move "Drag to orbit · scroll to zoom" into the panel's bottom bar (the existing
   `border-t` footer), left-aligned, `text-[11px]`, one line, truncating rather than overflowing.
   Nothing overlays the model.
4. **Credit.** Replace the header label "BodyParts3D anatomy" with "Anatomy". Change the canvas
   `aria-label` to "Interactive adult reference anatomy. Drag to orbit and scroll to zoom." In the
   footer, add a small "Anatomy credits" link to `/about#credits`.
5. **Credits section on `/about`** (Stream C owns this page): add `id="credits"` with the
   attribution from `public/anatomy/ATTRIBUTION.md`, quoted exactly (source, author, licence CC
   BY-SA 2.1 Japan, link). The licence requires attribution, so it must stay reachable from the
   atlas; this keeps it one tap away without naming it on the panel. Add the other credits there
   too: SMART Health IT sandbox, Synthea, RxNav (NLM), Photon Health sandbox, and Heather Song and
   Santiago Enriquez for their work.
6. Check at 1280, 1440 and 1920 px: the body is centred horizontally and vertically, fully
   visible, nothing overlaps it, during rotation and after a drag. Screenshot each.
7. In task C (Stream A, after the merge): update Iris's `why` line in `src/lib/agents/roster.ts`
   to "...A tribute name only: the 3D atlas uses an open anatomy model credited on the About page,
   not the Visualize SDK." Run `git grep -n -i bodyparts -- src` and confirm the only mentions left
   are the About credits.

### C4 (in task C, after the freeze): clinician view sweep
The clinician view uses 7 to 10 px text in 59 places (`ClinicianWorkspace.tsx`) and 9 in
`ClinicalBodyAtlas3D.tsx`. After A4 and B1 are merged, raise every `text-[7px]`, `text-[8px]` and
`text-[9px]` to `text-[11px]` and `text-[10px]` to `text-xs`, then check the three-column layout at
1280, 1440 and 1920 px still fits and stays centred at `max-w-[1440px]`. Screenshot before and
after.

## 6c. Task H: the agent huddle (patient side)

When the patient's agent works on something, a centred pop-up shows the agents working together:
the patient's agent in the middle, the specialists around it, each saying what it is doing, and a
step-by-step flow along the bottom that ends with the answer. **It must replay the real
orchestrator message log, never scripted text.**

Run it in a fourth session (`.worktrees/demo-huddle`, branch `hackathon/demo-huddle`, created like
Stream B) from 12:45 to 1:55, building only new files. Wiring happens in task C. With fewer
sessions, it replaces C3 in Stream C.

### H1. Data contract (new file `src/lib/agents/huddle.ts`, pure, tested)
```ts
export type HuddleAgentId = "patient" | "records" | "safety" | "cardiology" | "nutrition"
  | "behavioral" | "reviewer" | "photon";
export interface HuddleMessage { seq: number; from: HuddleAgentId; to: HuddleAgentId;
  summary: string; factIds: string[]; status: "ok" | "blocked" | "info" }
export interface HuddleStep { id: "question" | "records" | "rules" | "specialists" | "linked"
  | "review" | "answer"; label: string; detail?: string }   // detail like "9 facts", "1 blocked"
export interface Huddle { messages: HuddleMessage[]; steps: HuddleStep[]; answer: string;
  citations: { label: string; url?: string }[] }
export function buildHuddle(input: OrchestratorResult, reply: PatientReply): Huddle;
```
- Stream A's A4 orchestrator records `{ from, to, factIds, summary }`. Map that log into
  `HuddleMessage`s one to one. Until A4 lands, build against a fixture in
  `src/lib/agents/huddle.fixture.ts` that has the same shape and uses Margaret's real current
  findings (section 2). After the merge, `buildHuddle` reads the real log; the fixture stays for
  tests only.
- Steps, always in this order, ending with the answer: Question received, Records gathered, Safety
  rules checked, Specialists reviewing, Linked across specialists, Safety review (N passed, M
  blocked), Answer ready.
- `usePlayback(huddle, { stepMs = 700, reducedMotion })`: a small state machine returning the
  current message index, active agent, the per-agent status (idle, working, done, blocked) and the
  current step. Pure logic in a function so it can be unit-tested without timers.

### H2. Component (new file `src/components/agents/AgentHuddle.tsx`)
- A modal dialog centred on screen, `max-w-[960px]`, over a dimmed, blurred backdrop.
- **Centre:** the patient's agent, Nova, large (`AgentFace` from C2, 72 px; fall back to the
  initial circle if C2 has not merged), with its name and "Your Parthia agent".
- **Around it:** the other agents on an arc or ring (Reid, Dex as pharmacist, Willem, Elsie, Aaron,
  Iris as safety reviewer), each a small card with face, name, role, a status dot, and a one-line
  speech bubble showing the summary of its latest message. Fotini (Photon) appears only when a
  Photon result is part of the facts.
- **Connectors:** an SVG line from the centre to each agent. When a message plays, a dot travels
  along the line from sender to receiver, and both cards highlight. Blocked messages show in the
  attention color with the reason.
- **Bottom:** a horizontal step flow (the seven steps above) with a tick, the step label and its
  detail as each completes. The last step, "Answer ready", reveals the answer text with its
  citations and a "See the answer" button that closes the pop-up and scrolls to the reply in Ask
  Parthia.
- **Mobile (below 768 px):** Nova on top, the other agents as a vertical list with their bubbles,
  the steps as a vertical list. No sideways scroll.
- Small label under the title: "Rule-based agents, no language model."
- Total run time 5 to 9 seconds. "Skip" (top right) jumps to the final state. Esc and the close
  button close it.
- Styling: the existing tokens and components only, no new colors, no new libraries (CSS
  transitions and SVG only). No emojis.

### H3. Safety and accessibility (required)
- **Urgent symptoms never wait for an animation.** If the patient agent detects urgent symptoms
  (`src/lib/patientAgent/urgent.ts`), do not open the huddle; show the 911 / 988 notice
  immediately, as today.
- The answer shown at the end is the same text the patient agent returns, already passed through
  the safety reviewer. The huddle never adds wording of its own beyond the step labels.
- It never says or implies which medicine to take. It explains and prepares questions for the
  clinician, like the rest of the patient agent.
- `role="dialog"`, `aria-modal="true"`, a labelled title, focus moves into the dialog and returns to
  the trigger on close, focus trapped while open.
- A visually hidden `aria-live="polite"` list announces each message as text.
- `prefers-reduced-motion`: no travelling dots or transitions; render the final state at once.

### H4. Wiring (in task C, after the freeze, by Stream A)
Open the huddle when the patient (a) sends a question in the Ask Parthia panel
(`src/components/patient/AskParthiaPanel.tsx`), (b) taps "Prepare for my visit", or (c) taps a new
"Watch your agents work" link under the dashboard agent card. Do not open it automatically after
every log; the inline recheck stays as it is. Add a setting to turn it off
(`localStorage`, wrapped in try/catch).

### H5. Tests
- `buildHuddle` maps the orchestrator log in order, and the steps always end with "answer".
- Playback: statuses advance correctly; skip jumps to the end; reduced motion renders the end.
- Urgent input never opens the huddle.
- The component renders Nova in the centre and one card per agent in the log, and closing returns
  focus to the trigger.

## 7. After the freeze

### C (2:00 to 2:10): merge and reset
1. In `.worktrees/demo`: `git merge hackathon/demo-photon`, then `git merge hackathon/demo-polish`.
   Resolve conflicts keeping both sides. Then wire `AgentFace` and `SponsorLogo` into `/agents`
   (replace the letter circle and the text badge), replace the ✕ glyph on `/agents`, and do C4.
2. `/reset` page: calls the existing `resetDemoData()` (`src/lib/passport/actions.ts`), selects
   Margaret, goes to `/`.
3. `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`. All green or fix.

### D (2:10 to 2:30): rehearsal under `vercel dev`. Cannot be dropped.
`npx vercel dev --listen 3360`, then walk:
- Every page loads: `/`, `/passport/`, `/log/medication/`, `/passport/share/`, `/trends/`,
  `/clinician/`, `/agents/`, `/architecture/`, `/about/`, `/passport/add/synthea/`, `/reset/`.
- The full demo path in section 2, as Margaret.
- Live Photon on Margaret's drafts (or the labelled Harold fallback). Panel says live or recorded.
- "Open as clinician" lands on Margaret, and the dashboard card's finding is in the clinician list.
- Specialist review shows the linked sertraline item and the reviewer counts.
- Explanations work with no AI key and say "rule-based".
- 390 px wide: no sideways scroll on `/`, `/agents/`, `/clinician/`, `/architecture/`.
Fix only what fails. Commit.

### E (2:30 to 2:50): push and deploy. Cannot be dropped.
1. `git push hackathon hackathon/demo`
2. Add each environment variable to Vercel for production and preview without printing it, for
   example `grep '^NAME=' .env.local | cut -d= -f2- | npx vercel env add NAME production`.
3. `npx vercel deploy` (preview). Repeat the Photon check on the preview URL. This is where the 308
   question gets its real answer.
4. `npx vercel deploy --prod`. Smoke test production at phone width. Send Om the URL.

### F (2:50 to 3:00): QR code
(Dropped by decision: the QR code was removed from /agents and /about, so skip this task.) Originally: `npx qrcode -o public/try-it-qr.png <production url>`. It was to show on
`/agents` and `/about` under "Try it on your phone". Redeploy. Judges vote for People's Choice by QR.

## 8. Ground rules

- No em dashes anywhere (copy, comments, commits). No `Co-Authored-By` or AI attribution in commits.
- Commit after each task with tests green. Never force-push. Never rewrite `hackathon/demo` history.
- Synthetic data only. No agent starts, stops, skips or changes a medicine or dose. Every finding is
  a question for a clinician. Urgent symptoms show 911 / 988 first.
- Every value on screen links to the records behind it. Missing data is shown as missing.
- Do not touch Azure files or GitHub workflow secrets.
- Report failures with the output. Never report a check as passing unless you ran it.

## 9. People

Om Thakur owns this handoff. Santiago Enriquez wrote the original Parthia Health and the
architecture. Heather Song wrote the reminders and Synthea import.
