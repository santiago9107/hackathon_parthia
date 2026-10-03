# Photon Neutron sandbox captures

One JSON file per demo draft, each a response really returned by
`prescriptionScreen` on `https://clinical-api.neutron.health/graphql` for the
synthetic demo patient, with the timestamp of the capture. No credentials and
no tokens are stored here.

| File | Draft | What the sandbox returned |
|---|---|---|
| `ciprofloxacin-500-mg-screen.json` | Ciprofloxacin 500 mg | DRUG, MODERATE, warfarin anticoagulant effect |
| `amoxicillin-500-mg-screen.json` | Amoxicillin 500 mg | ALLERGEN, MODERATE, penicillin G, plus a DRUG alert with warfarin |
| `ibuprofen-200-mg-screen.json` | Ibuprofen 200 mg | DRUG with warfarin, aspirin and metoprolol, plus ALLERGEN for the ibuprofen allergy |

These are the offline fallback shown as "Recorded sandbox response" when the
live call cannot run. `src/lib/clinician/photonRecorded.ts` is the generated
module the UI imports; it holds the same captures.

Re-capture after changing the catalog or the demo patient:

    npx tsx --env-file=.env.local scripts/photon-live-check.mts

The script also runs sync-patient twice to prove it stays idempotent.

Note on credentials: `prescriptionScreen` resolves a user, and the machine to
machine client has none, so the live screen needs a user access token in
`PHOTON_USER_TOKEN` (server side only). Without it the call fails with
`Could not get user for request` and the panel falls back to these captures.
Patient sync, treatment lookups and allergen lookups work with the machine to
machine credentials alone.

User access tokens expire. `PHOTON_USER_TOKEN` must be added to the Vercel
environment variables at ship time and refreshed when it lapses. An expired
token is not an error page: the panel falls back to these captures under the
"Recorded sandbox response" label and shows the reason.
