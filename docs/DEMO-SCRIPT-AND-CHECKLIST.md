# Demo script, checklist and lessons (Hackers & Healers NYC, Sat 3 Oct 2026)

Live site: https://parthia-health.vercel.app

## Before you go on (off the clock)

1. Open `/reset/` and click **Reset and open Margaret**. It clears any leftover state and lands on `/start`.
2. Browser at 100 percent zoom, at least 1440 px wide, one tab, internet on (Photon is a live call).
3. If anything goes wrong mid-demo, `/reset/` gets you back to the start in one click.

## The four minutes

| Time | Where | Do | Say |
|---|---|---|---|
| 0:00 | `/start` | Point at the two cards. Click **Open the patient side**. | "Medication safety that starts with the patient. Ten rule-based agents explain and check. A clinician makes every decision. Nothing here starts, stops or changes a medicine." |
| 0:20 | Patient home | Point at the agent card ("9 findings to ask your doctor about", RULE-BASED). | "This is Margaret, 72, heart failure, nine medicines. Nova, her agent, explains in plain words." |
| 0:35 | Ask Nova | Click **Ask Nova** (bottom right), then **Why is this flagged?** | "Watch the agent team." |
| 0:45 | Agent huddle | Let it play 5 to 6 seconds, then **See the answer**. | "Reid gathered 19 records into 9 medicines. Dex checked 15 rules. Willem, Elsie and Aaron reviewed in parallel. The safety reviewer blocks anything uncited. Those are the real hand-offs." |
| 1:05 | Home | Close the panel. Click **Prepare for my visit** (Skip, then See the answer if the huddle opens). | "Five questions for her doctor. Questions, never instructions." |
| 1:20 | Care team card | Click **Prepare a summary to share**, then **Open as clinician**. | "Now her care team." |
| 1:30 | Clinician | Point at the journey bar: Reconcile, Review, **Screen with Photon** (gold), Decide. Click **Start reconciliation**. | "Eight stages: gather, validate, normalize, reconcile, check, clarify, explain, route." |
| 1:45 | Agent pause | When it asks about Benadryl, click **Currently taking it**. | "The agent stops where a person must decide. It will not guess." |
| 2:00 | Review queue | Click **Anticholinergic burden score of 8**. Point at the body: neurological and gut light up. Click the **Neurological** tab (6). Click **Show all**. | "Every finding is a question for a clinician, and the body shows where each risk acts." |
| 2:25 | Photon panel | Click **Screen with Photon** in the journey bar. Click **Connect sandbox patient**. Tramadol 50 mg is already selected, so click **Screen draft**. | "Her doctor is considering tramadol for pain. This is **Photon Health**, live, in their Neutron sandbox." |
| 2:45 | Photon result | Point at the two red MAJOR alerts. | "Tramadol with her sertraline: serotonin syndrome risk. Tramadol with her zolpidem: extra sedation. Parthia's own table has no tramadol rule. Photon's engine does. Fotini, our Photon agent, can only read. Photon's provider workflow opens only after a clinician approves." |
| 3:10 | `/agents` | Open from the menu. Point at the moving ring and Fotini's gold card. | "Ten agents, one shared policy. The only actions they can never take: stop, change a dose, swap, edit the list, prescribe." |
| 3:30 | `/architecture` | Open from the menu. Point at the gold Photon nodes, then the Sponsors card. | "Five stages. Gold is where Photon Health is live: the screening and the provider workflow. Dashed is next: Epic, cloud, a model, a secure link." |
| 3:50 | Close | Stay on the diagram. | "The patient owns the record. Agents explain. The clinician decides. Photon screens it live. Thank you." |

**Cut list if you are short on time:** skip the body filter (2:00), skip the `/architecture` stop and close on `/agents`.

## Photon Health, said out loud at five points

1. Clinician journey bar: the gold "PHOTON HEALTH" step.
2. The gold panel banner: "Live integration, Photon Neutron sandbox".
3. The two MAJOR alerts that come back from Photon.
4. `/agents`: Fotini's gold card, "Live integration".
5. `/architecture`: gold Photon nodes and "Sponsors in this build".

## If something goes wrong

- Photon slow or offline: the panel falls back to a clearly labelled recorded response. Say so: "This is the recorded response from earlier today."
- Huddle too long: click **Skip**.
- Lost: `/reset/`.

## Questions you will get

- Is it using an LLM? No. Deterministic rules with cited evidence, by design, because clinicians need results that are correct and testable every time. A model would only explain what the rules found, behind the same safety reviewer.
- Real patients? Synthetic. Every API call is live, every patient is synthetic.
- How would you scale it? Next on the diagram: cloud storage, a secure revocable clinician link, Epic through SMART on FHIR, and model-written explanations held to the safety reviewer.
- Where is the data stored? On the patient's device. The cloud is the next step.

## Checklist

### Built and verified

- Patient side: on-device Passport, medicine and symptom logging, 15 safety rules, agent card, Ask Nova (rule-based), agent huddle with real hand-offs, Prepare for my visit, share and export, reminders and Synthea import (Heather Song).
- Clinician side: eight-stage reconciliation agent with a human pause, 9 findings, specialist agents, orchestrator, safety reviewer, body-system map, journey bar, live Photon screening for Margaret and Harold, labelled recorded fallback, policy that refuses stop, change, swap, edit and prescribe.
- Platform: hosted on Vercel, Photon functions fixed and tested live, secrets only in environment variables, drug allow-list on the screening endpoint, 390 tests, type check and lint clean.
- Pages: master page `/start`, `/agents` (compact, animated, friendly), `/architecture` (system diagram and sponsors card), `/analytics` (Santiago's engine running live), `/about` (full width, accurate hosting), presentation with the investor joke.

### Planned and changed on purpose

- Meal photo AI: dropped (no OpenAI key; not on the demo path).
- OpenRouter: dropped. Epic: simulated, drawn as "Next".
- Visualize AI: Iris is named for them; the SDK is not integrated.
- Assistant page: hidden. Ask Nova is the one place to ask.
- QR code: removed.

### Remaining

- [ ] Promote the final preview to production (command in the chat).
- [ ] Merge Heather's `main` history, push to `main`, delete the old remote `hackathon/demo` branch (it still has Sep 11 and Sep 30 commits).
- [ ] Rotate the Photon credentials and the user token after the hackathon (they were handled in chat).
- [ ] Write the LinkedIn post (prize category) and tag Photon Health, DxAngels, Redesign Health.
- [ ] README disclosure line: built on Parthia Health by Santiago Enriquez, with Heather Song's reminders and Synthea import.
- [ ] Santiago re-adds his analytics CI job (his workflow edit did not apply to our file).
- [ ] After the demo: connect the Passport to the analytics module, Epic sandbox, cloud storage and secure link, model-written explanations.

## Lessons from the earlier hackathon (WoundScope, 28 Jun 2026)

We built about 85 percent of the winning system's substance and lost on framing, not engineering. Apply:

1. **One clean, numbered diagram is the pitch.** Open `/architecture` early, not last.
2. **Business logic as versioned data, not hardcoded.** Say it: Santiago's analytics knowledge base is an Excel file exported to versioned JSON with a decision log and a CI check.
3. **Name the stages aloud.** Gather, validate, normalize, reconcile, check, clarify, explain, route.
4. **Show the "not today" lane.** The dashed boxes are it. It pre-answers "how would you scale it?"
5. **Name the patterns:** human in the loop, idempotent sync, source of truth, audit trace, graceful fallback (recorded Photon), shared policy.
6. **Spend the first 20 seconds on the problem and one hero path.** Do not tour features.
7. **The point of a hackathon is the room.** After the demo, talk to Photon Health, Redesign Health and DxAngels people, get contacts, and follow up Monday morning.
