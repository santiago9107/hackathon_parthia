# Parthia clinician-agent MCP

This stdio server exposes the same deterministic reconciliation, evidence and policy tools used by `/clinician/`. It intentionally does not expose clinician decisions or prescription writing.

```bash
npm run mcp
npm run mcp:smoke
```

The server exposes 10 tools: `list_patients`, `reconcile_patient`, `add_patient_reported_medication`, `confirm_patient_answer`, `get_evidence`, `get_provenance`, `ask_agent`, `request_medication_change`, `screen_with_photon`, and `run_evaluation`.
