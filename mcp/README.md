# Parthia clinician-agent MCP

This stdio server exposes the same deterministic reconciliation, evidence and policy tools used by `/clinician/`. It intentionally does not expose clinician decisions or prescription writing.

```bash
npm run mcp
npm run mcp:smoke
```

The server exposes 14 tools:

- Core agent: `list_patients`, `reconcile_patient`, `add_patient_reported_medication`, `confirm_patient_answer`, `get_evidence`, `get_provenance`, `ask_agent`, `request_medication_change`, and `run_evaluation`.
- Live adapters: `list_public_fhir_patients`, `fetch_public_fhir_patient`, `lookup_rxnorm`, `screen_with_photon`, and `ask_openrouter`.

SMART Health IT and RxNorm use public APIs. Photon and OpenRouter are credential-gated and return an explicit unavailable or deterministic-fallback mode when their environment variables are not present. No MCP tool can approve a clinical decision or submit a prescription.
