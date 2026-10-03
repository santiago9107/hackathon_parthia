# Open ambiguities for the clinical lead

Everything here is either **excluded** from the analysis or **applied provisionally** (stated per item).
Nothing here is a guessed clinical value: "applied" items are literal readings of the KB text or
safety-conservative choices, flagged so you can confirm or correct them. IDs are cited in
`overrides.json`, `config/*.json`, audit output and tests.

## Excluded from the analysis until you decide

| ID | Item | Question |
| --- | --- | --- |
| — | R15 | BNP/NT-proBNP rise % undefined (DEC-08). `not_evaluable`. |
| AMB-21 | KB gaps: thresholds without a rule (after the demo) | T02 alert high (sodium > 145), T04 BNP, T10 magnesium, T11 INR alert band (< 2 / > 3), T12 HbA1c have no rule row, so they appear in the timeline but never produce findings. INR "or any bleeding" urgent is not checked because bleeding is not on the D014 checklist (add it?). T05 urgent "rapid gain with severe breathlessness" is not a separate check; severe breathlessness at rest is already urgent on its own (DEC-07). |

## Resolved on 2026-10-03

AMB-01 and AMB-02 (BP "x/y" thresholds) -> DEC-15. AMB-09 (R13 wording) and R21/R22 message wording -> DEC-16.
Clinical-mode urgent pathway -> DEC-17. AMB-18 (unconfirmed red flags) -> DEC-18.

## Applied provisionally (please confirm)

| ID | Item | What the code does now | Why |
| --- | --- | --- | --- |
| AMB-03 | R20 "All HF medicines" | Beta-blockers, ACEi, ARB, ARNI, MRA, SGLT2i, loop and thiazide diuretics, digoxin, ivabradine (`drug_groups.composites.hf_medicine`). | KB gives no list. |
| AMB-04 | Threshold priority (2) "lab's reported range" | The lab's range replaces the *usual reference range* (normal/abnormal), never a rule's alert value. E.g. a lab upper limit of 5.0 does **not** move R02's 5.5 alert. | T01 puts "use the lab's own range" in the reference-range column only. |
| AMB-05 | Urgent BP/HR recency | A BP/HR reading triggers the urgent pathway only if taken within the last **24 h** (`config/analysis.json`). | A 6-day-old reading is "valid" (D012/D013 = 7 days) but is not an emergency now. |
| AMB-06 | Domain of urgent items | self-harm → Mental health; red-flag symptom → Fluid/congestion; urgent vital → BP/HR; urgent lab → Heart-kidney labs (`config/domains.json`). | Needed for domain colours. |
| AMB-07 | Low severity → domain status | Low → "watch" (brief defines only Urgent/High/Moderate). | Only R16 is Low; with R16 now on (DEC-15), a domain with only R16 shows "watch". |
| AMB-08 | Urgent-lab message wording | `config/messages.json` "urgent_lab" (R21/R22 wording approved, DEC-16). | Please approve or rewrite. |
| AMB-10 | R22 which PHQ-9 | Any PHQ-9 within the D016 window (30 days) with item 9 > 0 triggers, not only the latest. | Safety-conservative. |
| AMB-11 | DEC-03 edge cases | A result dated the **same day** as the change counts as pre-change (order within the day is unknown). During the first 14 days the element is reported missing with reason `post_change_monitoring_due`; after day 14 `…_overdue`. | |
| AMB-12 | D002 vs D003 validity | D003 is calculated from the latest LVEF of any age (D003 "until LVEF changes"); a D002 older than 12 months is reported missing only by rules that need it. | KB windows conflict. |
| AMB-13 | R17 / R18 | Evaluated on the most recent valid resting HR (KB condition), although the patient question says "often". | Literal reading of the condition. |
| AMB-14 | R19 rise | Compared with the immediately previous PHQ-9, any age. | KB has no window. |
| AMB-15 | R09 dizziness timing | Dizziness must be in a valid D014 check-in (within 1 day of as_of). | Dictionary rule 3. |
| AMB-16 | R08 daily weight | Morning weight = first reading of the day; the 1-day gain needs a weight on the previous calendar day. | D011 "Morning weight, daily". |
| AMB-17 | knowledge_mode "clinical" | Gates R01–R20, their thresholds, cards and the draft tables in `overrides.json`; data-dictionary rows ("In review") are not gated, but their status is reported. The urgent pathway is never gated (DEC-17). | |
| AMB-19 | Domain trends | Windows and stable tolerances in `config/domains.json` are engineering placeholders (marked DRAFT). | For the clinical panel. |
| AMB-20 | Draft tables (review after the demo) | `rule_elements` (element IDs for R01–R10), `drug_groups.draft_added` (extra drug names), `composites.hf_medicine` (R20 list, AMB-03), and domain trend windows/tolerances (AMB-19) are engineering drafts accepted for now. | Pharmacist to verify; add element IDs to the Excel "Data needed" column. |

## Draft – verify inventory (from the KB)

All 22 rules, 12 thresholds and 6 cards are **Draft – verify**; the 17 MVP data elements are **In review**;
D018–D020 are **Draft – verify**. Every output item carries the review status of each row it used
(`knowledge[]`), and `audit.knowledge_rows_used` lists them all.
