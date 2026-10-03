# Parthia Health — prototype

Patient-owned, holistic medication safety for people living with several chronic
conditions and five or more medicines. This repository is the **demo-quality
prototype** built for partner pitches and as an exhibit. The main personas are
synthetic, and the optional public SMART Health IT import reads synthetic
Synthea records from a real FHIR R4 server. There is no production EHR
connection, real authentication, or trained model.

What *is* real: the safety engine. Every flag you see is produced by readable,
rule-based logic in `src/lib/safetyEngine` — no black-box score.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → ./out
npx serve out      # serve the export locally (service worker needs http://localhost or https)
```

Node 20+ is required. Icons are pre-generated; regenerate with
`node scripts/generate-icons.mjs` if you change the mark.

## What's in the demo

| Screen | Route | Notes |
| --- | --- | --- |
| Dashboard | `/` | Four **separate** indicators (Medication Safety, Physical & Labs, Mental Health, Nutrition) — deliberately not one combined score |
| Medication Safety | `/medications/` | Current list, flags inline per medicine, all flags grouped by category, and a "How the safety check works" panel listing every rule |
| Trends | `/trends/` | Mood line + meals-logged bars + symptom markers, with medication changes drawn on the same timeline |
| Share with doctor | `/share/` | Printable one-page visit summary (`Print / Save as PDF`) |
| Assistant | `/assistant/` | Scripted, data-grounded chat; every reply labelled **AI-generated** |
| Clinician agent | `/clinician/` | Gathers five sources, validates, normalizes, reconciles, pauses for patient clarification, attaches label evidence, routes decisions to people, and never changes care |
| Prototype evaluation | `/clinician/eval/` | 12 expected/prohibited-finding cases; explicitly not clinical validation |
| Install | `/install/` | Platform-aware install flow + reminder settings |

**Patient switcher** (top right) flips between three synthetic personas:

- **Harold Okafor, 68** — AFib on warfarin + atorvastatin, 7 medicines. Leafy-green intake swings week to week, grapefruit some mornings, aspirin recently added → drug-nutrient and drug-drug flags, INR above range.
- **Margaret Lindqvist, 72** — heart failure + depression, 9 medicines incl. sertraline and zolpidem, plus oxybutynin and OTC diphenhydramine → high anticholinergic burden; mood declining since a sertraline dose change → drug-mood flag.
- **Rosa Delgado, 65** — newly diagnosed type 2 diabetes, 5 medicines, patchy nutrition logging → low-risk profile, nutrition "worth watching".

## Architecture

```
src/
  app/                 Next.js App Router pages (all client-rendered, static export)
  components/          UI (shell, cards, chart, assistant panel, install guide…)
  lib/
    types.ts           Domain model (FHIR analogues noted in comments)
    mockData/          SYNTHETIC patients + seeded daily entries   ← replace with FHIR/EHR client
    safetyEngine/      Rule-based scanner — knowledge tables + rules + evaluate()
    status/            The four domain indicators
    assistant/         Scripted responder behind an AssistantProvider interface  ← swap for a model
    context/           PatientContext (current record, flags, indicators)
    pwa/               Platform detection, install hook, push/reminder helpers
public/
  manifest.json, sw.js, icons/, staticwebapp.config.json
```

### Hackers & Healers clinician agent

Parthia Health predates Hackers & Healers NYC. The clinician-agent workspace,
live public FHIR sandbox importer, Photon screening seam, MCP server and fused-record
brand mark were built for the event. The agent is deterministic and resumable:
it performs evidence gathering and reconciliation autonomously, then waits for
the patient or clinician wherever judgment or authorization is required.

Run the MCP integration with `npm run mcp`; verify all 10 tools end to end with
`npm run mcp:smoke`. Photon credentials remain server-side in Vercel environment
variables. When Photon is unavailable, the interface says so and uses a clearly
labelled recorded sandbox response for the demo.

### Safety engine

`evaluatePatient(record, { now })` runs every rule in `RULES` and returns
`RiskFlag[]` sorted by severity. Each flag carries `ruleId`, `evidence[]`, a
plain-language `explanation`, and a `suggestedNextStep` that is always framed
as a question for the clinician.

| Category | Rules |
| --- | --- |
| drug-nutrient | warfarin + variable/low vitamin K; statin + grapefruit (sensitivity per statin); ACE-i/ARB + high-potassium foods; metformin + alcohol |
| anticholinergic-burden | 10+ medicines; 2+ psychotropics; anticholinergic burden score ≥ 3 |
| drug-mood | mood decline (≥ 0.8 on 1–5, or clear downward trend) in the 2+ weeks after a medication change |
| drug-drug | curated pair table (warfarin + antiplatelet/NSAID, SSRI + sedatives, …), some gated on matching logged symptoms |

Knowledge tables (`knowledge.ts`) are small and illustrative; they are the seam
for a licensed interaction database.

### What gets replaced later

- `lib/mockData` → FHIR R4 client (Patient, MedicationStatement, Condition, Observation) plus our own store for patient-reported entries.
- `lib/assistant` → model-backed `AssistantProvider` using the same record as its only context.
- `lib/pwa/push.ts` → POST the `PushSubscription` to a reminder service that sends real Web Push (VAPID). The client flow is already complete; set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to exercise it.
- Patient switcher → removed; the signed-in patient sees only their own record.

## PWA

- `public/manifest.json` — name, teal theme colour, 192/512 icons (plus maskable variants), `display: standalone`, shortcuts.
- `public/sw.js` — hand-rolled service worker: precaches the app shell, network-first navigations with cache fallback, cache-first static assets, `push` and `notificationclick` handlers, and a `SCHEDULE_NOTIFICATION` message for local reminders. Mock data is inside the JS bundles, so the whole demo works offline after first load.
- **Android / Chromium** — `beforeinstallprompt` is captured at module load and replayed from the "Install Parthia Health" button; then the standard notification permission flow.
- **iOS / Safari** — no install prompt exists, so `/install/` shows a designed Share → Add to Home Screen → Add walkthrough. Notifications are gated until the app runs in standalone mode (iOS 16.4+ requirement).

## Deployment: Azure Static Web Apps

The site is a pure static export (`output: "export"` in `next.config.ts`); no
Azure Functions, no SSR, no hybrid features. The GitHub Actions workflow in
`.github/workflows/azure-static-web-apps.yml` builds on every push to `main`
and uploads `out/` with `Azure/static-web-apps-deploy@v1`.

### One-time provisioning

**Option A — Azure Portal**

1. Create resource → *Static Web App*.
2. Plan: **Free**. Deployment source: **GitHub**; authorise and pick this repo and the `main` branch.
3. Build presets: **Custom**. App location `out`, API location *(empty)*, Output location *(empty)*.
4. Create. Azure commits its own workflow file — delete it and keep the one in this repo (ours runs the build in Actions and uploads the finished `out/`).
5. In the resource → *Manage deployment token*, copy the token.
6. GitHub repo → Settings → Secrets and variables → Actions → new secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.

**Option B — Azure CLI**

```bash
az login
az group create --name rg-parthia-health --location eastus2
az staticwebapp create \
  --name parthia-health \
  --resource-group rg-parthia-health \
  --location eastus2 \
  --sku Free \
  --source https://github.com/<owner>/<repo> \
  --branch main \
  --app-location out \
  --output-location "" \
  --login-with-github
az staticwebapp secrets list --name parthia-health --resource-group rg-parthia-health --query properties.apiKey -o tsv
```

Put the printed token in the `AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret.
If the CLI also created a workflow file in `.github/workflows/`, delete it in favour of ours.

Push to `main` → the workflow builds, lints, typechecks and deploys. Pull
requests get a preview environment that is closed automatically when merged.

`public/staticwebapp.config.json` ships with the export and sets the 404 page,
`no-cache` for the service worker, and long-lived caching for `_next/static`.

## Disclaimer

Prototype with synthetic data. Not a medical device, not medical advice. Flags
are prompts for a conversation with a clinician, never instructions to change
treatment.
