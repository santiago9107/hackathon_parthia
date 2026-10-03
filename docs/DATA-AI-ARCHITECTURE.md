# Data and AI Architecture

From data capture to sharing with the healthcare provider. Written by the Parthia team (Santiago).
The matching diagram is `docs/architecture-diagram.png`.

This document describes the five stages of the Parthia Health platform: what happens at each stage,
how to build it, and what already exists in the prototype.

## 1. Capturing data

Information comes in from four sources and is converted into one standard format.

| Source | How it is captured | Status |
|---|---|---|
| Hospital records (Epic, etc.) | Patient connects their patient portal through SMART on FHIR; the app reads medications, conditions, labs and visits | Simulated in prototype; next step is Epic's public sandbox |
| Paper documents | Phone camera and text recognition, then the patient confirms each item | Built (on device) |
| Devices | Apple Health export, Bluetooth BP cuff; later smart scales and device company APIs | Built (export and BP cuff) |
| The patient | Forms for meals, mood, symptoms, PHQ-9, GAD-7 and medicines | Built |

Key rules: every item gets standard codes (RxNorm, LOINC, SNOMED), records its source, and waits for
patient confirmation before it is used in any analysis.

For heart failure, add daily weight from a smart scale. It is the most important home signal for
fluid retention.

## 2. Storing data

Confirmed data is saved in one record per patient, the Patient Passport.

- PostgreSQL as the main database (managed on Azure), storing original FHIR resources plus tables for
  medications, labs, vitals, entries, flags, consent and the audit log.
- Time-series table for daily device readings.
- Search index (pgvector) for clinical notes and documents.
- Separate knowledge base: licensed drug-interaction database, FDA drug labels, heart failure
  guideline, Beers criteria.
- Security: encryption, HIPAA compliance, a Business Associate Agreement with Microsoft, and patient
  controls to export or delete everything.

Status: the prototype stores data on the device. Moving to the cloud is the main next
infrastructure step.

### Priority 1: needed for the MVP

| Category | Data elements | Why it matters (guideline basis) | How captured | How often |
|---|---|---|---|---|
| Heart failure profile | Diagnosis, LVEF value and date, phenotype (HFrEF/HFpEF), NYHA class | Determines which medicines are indicated or harmful | EHR | When it changes |
| Comorbidities | CKD, diabetes, atrial fibrillation, hypertension, depression, cognitive impairment, COPD | Change drug choices and risks | EHR | When it changes |
| Medications | All prescriptions plus OTC and supplements; dose, frequency, start/change/stop dates, prescriber | Interactions, harmful drugs, duplicates; guideline therapy status | EHR, scans, patient | Every change |
| Adherence | Missed doses and reason (cost, side effects, forgot, bathroom trips with diuretics) | Non-adherence drives readmissions | Patient | Weekly |
| Key labs | Potassium, sodium, creatinine/eGFR, BNP or NT-proBNP | Required monitoring for RAAS inhibitors, MRAs, diuretics | EHR, lab report scan | Each new result |
| Daily weight | Weight | Earliest home sign of fluid retention | Smart scale or patient | Daily |
| Blood pressure and heart rate | Home readings | Low BP and slow heart rate limit medicines; dizziness and falls risk | BP cuff, watch | Daily or several times a week |
| Symptoms | Breathlessness, orthopnea (pillows), swelling, dizziness, fatigue; urgent ones: chest pain, fainting | Detect worsening and side effects | Patient (short checklist) | Daily, 30 seconds |
| Diet risks | High-sodium meals, potassium salt substitutes, alcohol, fluid intake if restricted, herbal supplements | Drug-food interactions specific to heart failure medicines | Patient (simple choices, not a food diary) | When relevant |
| Mood | PHQ-2, then PHQ-9 if positive | Depression lowers adherence and worsens outcomes | Patient | Monthly |
| Events | Hospitalizations, ER visits, falls | Readmission risk, outcome tracking | EHR, patient | When they happen |

### Priority 2: add after the MVP

- Labs depending on medicines: magnesium (diuretics), digoxin level, INR (warfarin), ferritin and
  transferrin saturation (iron deficiency), hemoglobin, HbA1c, TSH (amiodarone), urine albumin.
- KCCQ-12 (quality of life), every 1 to 3 months.
- Cognition screen, health literacy question, caregiver involvement.
- Social barriers: cost of medicines, transportation, food insecurity, living alone.
- Devices (ICD/CRT), vaccinations, sleep apnea.

## 3. Data analysis

Tested, deterministic code calculates the facts. No AI at this stage.

- Reconciliation: compare sources and detect conflicts (built).
- Calculated measures: weight change over 3 and 7 days, blood pressure and heart rate trends,
  potassium and kidney function trends, PHQ-9 change, missed doses.
- Safety rules: drug-drug, drug-disease, drug-food, kidney dosing and allergies (14 rules built; a
  licensed database comes next).
- Output of this stage: a list of facts and flags, each linked to the exact data behind it.

Why no AI here: these numbers must be correct every time and fully testable. That is what makes the
system trustworthy to clinicians.

## 4. AI agents analyze and recommend

Specialist agents read the facts from stage 3, connect them across disciplines, and explain them.

- Patient workflow: pharmacist, cardiology, nutrition and behavioral health agents, coordinated by an
  orchestrator.
- Safety reviewer checks every finding: it must cite real data, and it must not diagnose or give
  dosing instructions.
- Two outputs: for the patient, plain-language explanations and questions to ask their doctor or
  pharmacist; for the clinician, a concise technical summary with the evidence, which the clinician
  uses to decide.

Wording: call these findings and questions rather than recommendations, at least for patients.
"Recommendation" implies the app is advising treatment, which raises regulatory and safety concerns.
For clinicians, "decision support" is the accurate term.

Later: the population workflow (epidemiology, health economics, health services research,
implementation science) runs separately on de-identified data.

## 5. Sharing with the healthcare provider

The patient chooses what to share, and the clinician receives it in a form they can use. Options from
simplest to most integrated:

| Option | How it works | Difficulty |
|---|---|---|
| Printed or PDF summary | Patient selects sections and brings or sends it | Built |
| FHIR file export | Standard file another system can import | Built |
| Secure link | Time-limited link to a read-only clinician view; the patient can revoke it | Moderate; needs the backend |
| App inside the EHR | Clinician opens a Parthia summary directly inside Epic (SMART on FHIR "EHR launch") | Harder; each health system must approve and install it |
| Writing into the record | Patient-generated data or summaries added to the patient's chart | Hardest; depends on each health system's agreement |
| CMS Aligned Networks | Exchange through the national framework from the CMS Health Tech Ecosystem | Future; aligns with the CMS pledge strategy |

Key rules: the patient consents to each share, chooses the sections (sensitive ones off by default,
already built), can revoke access, and every share is recorded in the activity log.

## Recommended order

1. Cloud storage (stage 2) and the secure clinician link (stage 5): these turn the prototype into
   something usable with real clinicians.
2. Calculated heart failure measures (stage 3) and the pharmacist agent with the safety reviewer
   (stage 4).
3. Epic sandbox connection (stage 1).
4. Remaining agents and the EHR-embedded clinician view.
