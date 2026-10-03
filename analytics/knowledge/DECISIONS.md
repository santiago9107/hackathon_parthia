# Clinical decisions log

Decisions made by the clinical lead (Santiago Enriquez, PharmD) on **2026-10-03**, before the Excel KB is
updated. Each one is encoded in [`overrides.json`](overrides.json) under the same ID, and the code cites
the ID in every finding it affects (`decision_ids`). **When the Excel is updated, mirror the change there,
re-run the export, and remove the override if the KB text then carries the structured value.**

| ID | Topic | Decision | Excel update needed |
| --- | --- | --- | --- |
| DEC-01 | R02/R03 phenotype scope | R02 and R03 apply to **all** HF phenotypes when an MRA is active (hyperkalemia and renal risk do not depend on EF). TC02 is correct. | Rules R02, R03: "Applies to phenotype" → All HF. Test cases TC02: clear the note. |
| DEC-02 | HF phenotype (D003) | 2022 AHA/ACC/HFSA: LVEF ≤40 HFrEF; 41–49 HFmrEF; ≥50 HFpEF; prior ≤40 and now >40 HFimpEF. R04: HFrEF and HFimpEF → High; HFmrEF → Moderate; HFpEF → not flagged. | Data dictionary D003: add the cut-offs. Rules R04: add the per-phenotype severity. |
| DEC-03 | Validity after MRA/RAAS change | For D007/D009, results drawn before the latest MRA/ACEi/ARB/ARNI start or dose change no longer count; without a post-change result, the element is missing (a result is expected within 14 days). | Data dictionary D007, D009: spell out the rule. |
| DEC-04 | Weight gain (R08/T05) | 1-day gain ≥ 0.9 kg (2 lb); 7-day gain ≥ 2.3 kg (5 lb), measured from the lowest value in the previous 7 days; both inclusive. Care-plan dry weight/limits override. | Thresholds T05 and Rules R08: replace "~1 kg" with 0.9 kg and state the 7-day baseline. |
| DEC-05 | R07 escalation | High when an MRA is active AND (potassium ≥ 5.0, or a rise ≥ 0.5 mEq/L vs the previous result within 90 days). | Rules R07: replace "higher severity if MRA or K rising" with this. |
| DEC-06 | Urgent labs | Potassium ≥ 6.0 or < 3.0, sodium < 125, INR > 4.5 → `urgent[]`. eGFR drop ≥ 30% stays High (R13). | Thresholds T03: move "drop ≥ 30%" out of the URGENT column. Consider a new urgent-lab rule row. |
| DEC-07 | R21 "with symptoms" | SBP < 80 or HR < 40 / > 120 is urgent with dizziness, fainting, chest pain, severe breathlessness or confusion within 24 h of the reading. Fainting, chest pain, severe breathlessness at rest and confusion are urgent alone. | Rules R21; Thresholds T06, T07, T09. |
| DEC-08 | Undefined thresholds | R09: 2 low readings within 7 days. R16: ≥ 3 readings at ≥ 140/90 among the last 7 days (minimum 4 readings). R20: ≥ 2 missed doses of any HF medicine in 7 days. R15: not evaluable. | Rules R09, R16, R20 "Threshold values". |
| DEC-09 | R02 clinician note | "Guideline addresses MRA continuation when potassium stays above the threshold; review MRA therapy." Scan stays strict on all generated text. | Rules R02 "Note for the clinician". |
| DEC-10 | Risk-score tables | Structure and input checks only; ACB, Charlson, LACE and MAGGIC tables to be supplied from the publications. | Add a risk-score sheet when ready. |
| DEC-11 | Unit conversions | lb → kg × 0.45359237; potassium and sodium mmol/L = mEq/L; creatinine µmol/L ÷ 88.4 → mg/dL. | Data dictionary "Unit": list the conversions. |
| DEC-12 | Domain mapping | KB 1, 4, 6, 7 → Medication safety; 2 → Heart-kidney labs; 3 → Fluid/congestion; 5 → BP/HR; 8 → Nutrition; 9 → Mental health (R19) / Adherence (R20); 10 → `urgent[]`. | Optional: add a "Module domain" column to Rules. |
| DEC-13 | Care-plan targets | Tagged with the element they override (D011, D012, D009, D010, D019, D013) and source "care plan". | — |
| DEC-14 | Priority defaults | Modifiability and evidence strength default to 0.5 until the clinical panel sets values. | Add "Modifiability" to Rules when defined. |

### Second round (2026-10-03, after the phase 1–3 review)

| ID | Topic | Decision | Excel update needed |
| --- | --- | --- | --- |
| DEC-15 | "x/y" BP thresholds use OR | Urgent BP: systolic ≥ 180 **or** diastolic ≥ 120. R16: a reading is high when systolic ≥ 140 **or** diastolic ≥ 90 (care-plan BP goal overrides). R16 switched on. | Thresholds T06; Rules R16, R21: write "systolic or diastolic". |
| DEC-16 | Urgent message wording | R21 and R22 patient messages approved as written in `config/messages.json`. R13 clinician note rewording approved. | Rules R21, R22 "Question for the patient": replace the description with the message text. R13 note. |
| DEC-17 | Urgent pathway in every mode | R21, R22 and urgent labs run in **every** knowledge mode, even while Draft, and are marked "Draft – pending clinical approval" (`approval_status`) in the output. | — (approve R21, R22, T06–T09, T01, T02, T11 to clear the label) |
| DEC-18 | Unconfirmed red flags | Patient-entered data (symptoms, PHQ-9, logs) counts as confirmed on entry; confirmation applies to imported data. Any unconfirmed, pending or conflicting item that would be urgent triggers the urgent message **and** stays in needs_review (`data_status`, `possible_red_flag`). Safety over strictness. | Dictionary guide rule 2: add the exception. |
| DEC-19 | Urgent-lab message wording | Urgent-lab patient message approved: "One of your recent lab results needs prompt attention. Please contact your care team today. If you feel very unwell, have chest pain, fainting, or severe trouble breathing, call 911." (`config/messages.json`). | Consider an urgent-lab rule row with this message. |
