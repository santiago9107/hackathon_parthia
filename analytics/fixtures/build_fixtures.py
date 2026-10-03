#!/usr/bin/env python3
"""Build SYNTHETIC PatientSnapshot fixtures (no real patient data).

    python3 analytics/fixtures/build_fixtures.py

Deterministic: no randomness, no clock. Re-running produces identical files.
All personas are fictional. as_of for every fixture: 2026-10-03T12:00:00Z.
"""
from __future__ import annotations

import copy
import json
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
AS_OF = date(2026, 10, 3)


def prov(source="ehr", confirmed=True, label=None, reconciliation="reconciled", note=None):
    p = {"source": source, "confirmed": confirmed, "reconciliation": reconciliation}
    if label:
        p["source_label"] = label
    if note:
        p["note"] = note
    return p


def days(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def iso(d: date, hhmm="07:00"):
    return f"{d.isoformat()}T{hhmm}:00-04:00"


def med(id, name, ingredients, events, dose=None, freq=None, otc=False, source="ehr", label=None, confirmed=True, reconciliation="reconciled", note=None):
    m = {"id": id, "element_id": "D005", "provenance": prov(source, confirmed, label, reconciliation, note),
         "name": name, "ingredients": ingredients, "otc": otc, "events": events}
    if dose:
        m["dose"] = dose
    if freq:
        m["frequency"] = freq
    return m


def start(d, detail=None):
    e = {"type": "start", "date": d}
    if detail:
        e["detail"] = detail
    return e


def lab(id, analyte, value, unit, d, ref=None, source="ehr", confirmed=True, reconciliation="reconciled", note=None):
    element = {"lvef": "D002", "potassium": "D007", "sodium": "D008", "creatinine": "D009", "egfr": "D009",
               "bnp": "D010", "ntprobnp": "D010", "magnesium": "D018", "inr": "D019", "hba1c": "D020"}[analyte]
    l = {"id": id, "element_id": element, "provenance": prov(source, confirmed, None, reconciliation, note),
         "analyte": analyte, "value": value, "unit": unit, "date": d}
    if ref:
        l["reference_range"] = ref
    return l


def weight(pid, d, kg, unit="kg"):
    return {"id": f"{pid}-wt-{d.isoformat()}", "element_id": "D011", "provenance": prov("device", label="Bluetooth scale"),
            "kind": "weight", "datetime": iso(d, "07:00"), "value": kg, "unit": unit}


def bp(pid, d, s, dia, hhmm="08:00"):
    return {"id": f"{pid}-bp-{d.isoformat()}-{hhmm.replace(':', '')}", "element_id": "D012", "provenance": prov("device", label="Home BP cuff"),
            "kind": "blood_pressure", "datetime": iso(d, hhmm), "systolic": s, "diastolic": dia, "unit": "mmHg"}


def hr(pid, d, v, hhmm="08:00"):
    return {"id": f"{pid}-hr-{d.isoformat()}-{hhmm.replace(':', '')}", "element_id": "D013", "provenance": prov("device", label="Home BP cuff"),
            "kind": "heart_rate", "datetime": iso(d, hhmm), "value": v, "unit": "beats/min"}


def checkin(pid, d, reported, hhmm="07:30"):
    return {"id": f"{pid}-sx-{d.isoformat()}", "element_id": "D014", "provenance": prov("patient"),
            "datetime": iso(d, hhmm), "reported": reported}


def diet(pid, d, tags, n=1):
    return {"id": f"{pid}-diet-{d.isoformat()}-{n}", "element_id": "D015", "provenance": prov("patient", label="Meal log (AI-tagged, patient-confirmed)"),
            "date": d.isoformat(), "tags": tags}


def phq(pid, d, instrument, score, item9=None):
    m = {"id": f"{pid}-{instrument.lower()}-{d}", "element_id": "D016", "provenance": prov("patient"),
         "date": d, "instrument": instrument, "score": score}
    if item9 is not None:
        m["item9"] = item9
    return m


def adherence(pid, end, missed):
    return {"id": f"{pid}-adh-{end}", "element_id": "D006", "provenance": prov("patient", label="Weekly medicine check-in"),
            "period_end": end, "period_days": 7, "missed": missed}


def target(pid, t, element, set_on, unit, **kw):
    return {"id": f"{pid}-cp-{t}", "element_id": element, "provenance": prov("care_plan", label="Cardiology care plan"),
            "target": t, "unit": unit, "set_on": set_on, "set_by": "Treating cardiologist (synthetic)", **kw}


def condition(pid, key, name, element, code_system, code, onset):
    return {"id": f"{pid}-cond-{key}", "element_id": element, "provenance": prov("ehr"), "key": key, "name": name,
            "code_system": code_system, "code": code, "onset_date": onset, "active": True}


HF = lambda pid, onset: condition(pid, "heart_failure", "Heart failure", "D001", "SNOMED CT", "84114007", onset)


def snapshot(pid, name, age, sex, **parts):
    s = {"schema_version": "1", "patient_id": pid, "synthetic": True,
         "profile": {"display_name": name, "age": age, "sex": sex},
         "conditions": [], "medications": [], "labs": [], "vitals": [], "symptoms": [], "diet_logs": [],
         "mood": [], "adherence": [], "events": [], "care_plan": []}
    s.update(parts)
    return s


# ---- Margaret ------------------------------------------------------------------

def margaret():
    pid = "p-margaret"
    first = date(2026, 9, 10)
    wt = {date(2026, 9, 26): 71.1, date(2026, 9, 27): 71.2, date(2026, 9, 28): 71.0, date(2026, 9, 29): 71.4,
          date(2026, 9, 30): 72.0, date(2026, 10, 1): 72.6, date(2026, 10, 2): 73.1, date(2026, 10, 3): 73.5}
    base_wt = [70.9, 71.0, 71.2, 71.1, 70.8, 71.0, 71.1, 70.9, 71.0, 71.2, 71.1, 70.9, 71.0, 71.1, 71.0, 70.9]
    vitals = []
    for i, d in enumerate(days(first, AS_OF)):
        vitals.append(weight(pid, d, wt.get(d, base_wt[i % len(base_wt)])))
        late = d >= date(2026, 9, 30)
        vitals.append(bp(pid, d, (118 if late else 126) + (i % 3), (72 if late else 76) + (i % 2)))
        vitals.append(hr(pid, d, 68 + (i % 5)))
    sx = {date(2026, 10, 1): ["breathlessness"], date(2026, 10, 2): ["breathlessness", "swelling"],
          date(2026, 10, 3): ["breathlessness", "swelling", "fatigue"]}
    diet_tags = {date(2026, 9, 13): ["high_sodium_meal"], date(2026, 9, 20): ["high_sodium_meal"],
                 date(2026, 9, 28): ["potassium_salt_substitute"], date(2026, 9, 29): ["potassium_salt_substitute"],
                 date(2026, 9, 30): ["potassium_salt_substitute", "high_sodium_meal"],
                 date(2026, 10, 1): ["potassium_salt_substitute"], date(2026, 10, 2): ["potassium_salt_substitute"]}
    return snapshot(
        pid, "Margaret Lindqvist (synthetic)", 72, "female",
        conditions=[HF(pid, "2023-02-01"),
                    condition(pid, "hypertension", "Hypertension", "D004", "SNOMED CT", "38341003", "2015-01-01"),
                    condition(pid, "depression", "Depression", "D004", "SNOMED CT", "35489007", "2025-04-01")],
        medications=[
            med("m-spiro", "Spironolactone", ["spironolactone"], [start("2025-11-01")], "25 mg", "once daily"),
            med("m-lisinopril", "Lisinopril", ["lisinopril"], [start("2024-06-01")], "20 mg", "once daily"),
            med("m-furosemide", "Furosemide", ["furosemide"], [start("2025-01-15")], "40 mg", "once daily"),
            med("m-metoprolol", "Metoprolol succinate", ["metoprolol"], [start("2024-06-01")], "50 mg", "once daily"),
            med("m-sertraline", "Sertraline", ["sertraline"],
                [start("2025-05-01", "50 mg daily"), {"type": "change", "date": "2026-09-12", "detail": "dose changed 50 mg to 100 mg daily"}],
                "100 mg", "once daily"),
            med("m-diphenhydramine", "Diphenhydramine", ["diphenhydramine"], [start("2026-09-20")], "25 mg", "at night as needed",
                otc=True, source="scan", label="Pharmacy bag photo (OCR)", confirmed=False),
        ],
        labs=[
            lab(f"{pid}-lvef-2026-03-10", "lvef", 58, "%", "2026-03-10"),
            lab(f"{pid}-k-2026-09-15", "potassium", 4.8, "mEq/L", "2026-09-15", {"low": 3.5, "high": 5.0}),
            lab(f"{pid}-k-2026-09-30", "potassium", 5.6, "mEq/L", "2026-09-30", {"low": 3.5, "high": 5.0}),
            lab(f"{pid}-egfr-2026-09-15", "egfr", 52, "mL/min/1.73m²", "2026-09-15"),
            lab(f"{pid}-egfr-2026-09-30", "egfr", 49, "mL/min/1.73m²", "2026-09-30"),
            lab(f"{pid}-cr-2026-09-30", "creatinine", 1.12, "mg/dL", "2026-09-30", {"low": 0.5, "high": 1.0}),
            lab(f"{pid}-na-2026-09-30", "sodium", 137, "mEq/L", "2026-09-30", {"low": 135, "high": 145}),
            lab(f"{pid}-ntprobnp-2026-08-20", "ntprobnp", 890, "pg/mL", "2026-08-20"),
        ],
        vitals=vitals,
        symptoms=[checkin(pid, d, sx.get(d, [])) for d in days(first, AS_OF)],
        diet_logs=[diet(pid, d, diet_tags.get(d, [])) for d in days(first, AS_OF)],
        mood=[phq(pid, "2026-09-05", "PHQ-9", 7, 0), phq(pid, "2026-10-01", "PHQ-9", 16, 0)],
        adherence=[
            adherence(pid, "2026-09-19", []),
            adherence(pid, "2026-09-26", []),
            adherence(pid, "2026-10-03", [
                {"medication_id": "m-furosemide", "date": "2026-09-29", "reason": "diuretic_timing", "note": "bathroom trips"},
                {"medication_id": "m-furosemide", "date": "2026-10-01", "reason": "diuretic_timing", "note": "bathroom trips"},
                {"medication_id": "m-furosemide", "date": "2026-10-02", "reason": "diuretic_timing", "note": "bathroom trips"},
            ]),
        ],
        events=[{"id": f"{pid}-er-2026-10-02", "element_id": "D017", "provenance": prov("ehr", label="Hospital ED record (simulated)"),
                 "type": "er_visit", "start": "2026-10-02", "reason": "shortness of breath and ankle swelling; treated and discharged home"}],
        care_plan=[
            target(pid, "dry_weight", "D011", "2026-06-01", "kg", value=70.5),
            target(pid, "egfr_baseline", "D009", "2026-06-01", "mL/min/1.73m²", value=58),
            target(pid, "bp_goal", "D012", "2026-06-01", "mmHg", systolic=130, diastolic=80),
        ],
    )


# ---- Harold --------------------------------------------------------------------

def harold():
    pid = "p-harold"
    first = date(2026, 9, 19)
    vitals = []
    for i, d in enumerate(days(first, AS_OF)):
        vitals.append(weight(pid, d, [84.0, 84.2, 83.9, 84.1][i % 4]))
        vitals.append(bp(pid, d, 112 + (i % 4), 70 + (i % 3)))
        vitals.append(hr(pid, d, 61 + (i % 4)))
    return snapshot(
        pid, "Harold Okafor (synthetic)", 68, "male",
        conditions=[HF(pid, "2024-01-10"),
                    condition(pid, "atrial_fibrillation", "Atrial fibrillation", "D004", "SNOMED CT", "49436004", "2022-11-01"),
                    condition(pid, "hypertension", "Hypertension", "D004", "SNOMED CT", "38341003", "2012-01-01")],
        medications=[
            med("m-warfarin", "Warfarin", ["warfarin"], [start("2023-03-01")], "5 mg", "once daily"),
            med("m-aspirin", "Aspirin", ["aspirin"], [start("2026-09-01")], "81 mg", "once daily"),
            med("m-naproxen", "Naproxen", ["naproxen"], [start("2026-09-29", "urgent care, knee pain")], "500 mg", "twice daily",
                source="scan", label="Urgent care prescription (scanned)"),
            med("m-entresto", "Sacubitril/valsartan", ["sacubitril", "valsartan"], [start("2025-04-10")], "49/51 mg", "twice daily"),
            med("m-lisinopril", "Lisinopril", ["lisinopril"], [start("2024-01-15"), {"type": "stop", "date": "2025-04-08", "detail": "switched to sacubitril/valsartan"}], "10 mg", "once daily"),
            med("m-metoprolol", "Metoprolol succinate", ["metoprolol"], [start("2023-03-01")], "100 mg", "once daily"),
            med("m-furosemide", "Furosemide", ["furosemide"], [start("2024-01-15")], "20 mg", "once daily"),
            med("m-empagliflozin", "Empagliflozin", ["empagliflozin"], [start("2025-06-01")], "10 mg", "once daily"),
            med("m-atorvastatin", "Atorvastatin", ["atorvastatin"], [start("2022-11-01")], "40 mg", "once daily"),
        ],
        labs=[
            lab(f"{pid}-lvef-2026-02-14", "lvef", 35, "%", "2026-02-14"),
            lab(f"{pid}-k-2026-09-02", "potassium", 4.4, "mEq/L", "2026-09-02", {"low": 3.5, "high": 5.1}),
            lab(f"{pid}-na-2026-09-02", "sodium", 139, "mEq/L", "2026-09-02", {"low": 135, "high": 145}),
            lab(f"{pid}-egfr-2026-09-02", "egfr", 64, "mL/min/1.73m²", "2026-09-02"),
            lab(f"{pid}-inr-2026-09-28", "inr", 3.4, "ratio", "2026-09-28"),
        ],
        vitals=vitals,
        symptoms=[checkin(pid, d, []) for d in days(first, AS_OF)],
        diet_logs=[diet(pid, d, ["vitamin_k"] if d.day % 3 == 0 else []) for d in days(first, AS_OF)],
        mood=[phq(pid, "2026-09-20", "PHQ-9", 4, 0)],
        adherence=[adherence(pid, "2026-09-26", []), adherence(pid, "2026-10-03", [])],
        care_plan=[target(pid, "egfr_baseline", "D009", "2026-03-01", "mL/min/1.73m²", value=66),
                   target(pid, "inr_range", "D019", "2026-03-01", "ratio", low=2.0, high=3.0)],
    )


# ---- Rosa (low risk, sparse logging) -------------------------------------------

def rosa():
    pid = "p-rosa"
    return snapshot(
        pid, "Rosa Delgado (synthetic)", 65, "female",
        conditions=[HF(pid, "2025-11-20"),
                    condition(pid, "diabetes", "Type 2 diabetes", "D004", "SNOMED CT", "44054006", "2025-03-01")],
        medications=[
            med("m-metformin", "Metformin", ["metformin"], [start("2025-03-15")], "1000 mg", "twice daily"),
            med("m-empagliflozin", "Empagliflozin", ["empagliflozin"], [start("2025-12-01")], "10 mg", "once daily"),
            med("m-lisinopril", "Lisinopril", ["lisinopril"], [start("2023-05-01")], "10 mg", "once daily"),
        ],
        labs=[
            lab(f"{pid}-lvef-2025-11-20", "lvef", 55, "%", "2025-11-20"),
            lab(f"{pid}-k-2026-08-05", "potassium", 4.3, "mEq/L", "2026-08-05", {"low": 3.5, "high": 5.0}),
            lab(f"{pid}-na-2026-08-05", "sodium", 140, "mEq/L", "2026-08-05"),
            lab(f"{pid}-egfr-2026-08-05", "egfr", 72, "mL/min/1.73m²", "2026-08-05"),
            lab(f"{pid}-hba1c-2026-08-05", "hba1c", 7.1, "%", "2026-08-05"),
        ],
        vitals=[weight(pid, date(2026, 9, 25), 68.2), weight(pid, date(2026, 9, 28), 68.4),
                bp(pid, date(2026, 9, 28), 124, 78), hr(pid, date(2026, 9, 28), 70)],
        symptoms=[checkin(pid, date(2026, 9, 28), [])],
        diet_logs=[diet(pid, date(2026, 9, 15), [])],
        mood=[phq(pid, "2026-07-01", "PHQ-9", 3, 0)],
        adherence=[adherence(pid, "2026-09-19", [])],
    )


# ---- Edge cases -----------------------------------------------------------------

def edges(m, h, r):
    out = {}

    e = copy.deepcopy(m)
    e["patient_id"] = "edge-missing-labs"
    e["labs"] = [x for x in e["labs"] if x["analyte"] == "lvef"]
    out["edge-missing-labs"] = e

    e = copy.deepcopy(m)
    e["patient_id"] = "edge-stale-values"
    for x in e["labs"]:
        if x["analyte"] in ("potassium", "egfr", "sodium", "creatinine"):
            x["date"] = "2026-05-20"
            x["id"] = f'{x["id"]}-stale' 
    e["vitals"] = [v for v in e["vitals"] if not (v["kind"] == "weight" and v["datetime"] >= "2026-10-01")]
    out["edge-stale-values"] = e

    e = copy.deepcopy(h)
    e["patient_id"] = "edge-conflicting-sources"
    e["labs"].append(lab("p-harold-k-2026-10-01-a", "potassium", 6.3, "mEq/L", "2026-10-01", source="scan", reconciliation="conflict",
                         note="Scanned lab report says 6.3; EHR feed for the same draw says 4.6."))
    e["labs"].append(lab("p-harold-k-2026-10-01-b", "potassium", 4.6, "mEq/L", "2026-10-01", reconciliation="conflict",
                         note="EHR feed says 4.6; scanned report for the same draw says 6.3."))
    for x in e["medications"]:
        if x["id"] == "m-naproxen":
            x["provenance"] = prov("scan", True, "Urgent care prescription (scanned)", "pending", "Not yet matched to a pharmacy fill.")
    out["edge-conflicting-sources"] = e

    e = copy.deepcopy(m)
    e["patient_id"] = "edge-unit-conversions"
    for v in e["vitals"]:
        if v["kind"] == "weight":
            v["value"] = round(v["value"] / 0.45359237, 1)
            v["unit"] = "lb"
    for x in e["labs"]:
        if x["analyte"] == "potassium":
            x["unit"] = "mmol/L"
        if x["analyte"] == "creatinine":
            x["value"], x["unit"] = 99.0, "µmol/L"
            x["reference_range"] = {"low": 44.2, "high": 88.4}
    e["labs"].append(lab("edge-mg-1", "magnesium", 0.8, "mmol/L", "2026-09-30"))
    out["edge-unit-conversions"] = e

    e = copy.deepcopy(r)
    e["patient_id"] = "edge-phq9-item9"
    e["mood"].append(phq("edge", "2026-10-02", "PHQ-9", 11, 1))
    out["edge-phq9-item9"] = e

    e = copy.deepcopy(r)
    e["patient_id"] = "edge-red-flags"
    e["symptoms"].append(checkin("edge", date(2026, 10, 3), ["chest_pain", "dizziness"], "07:45"))
    e["vitals"] += [bp("edge", date(2026, 10, 3), 186, 96, "07:40"), hr("edge", date(2026, 10, 3), 128, "07:40")]
    out["edge-red-flags"] = e

    for lvef, tag in ((60, "hfpef"), (35, "hfref")):
        e = copy.deepcopy(r)
        e["patient_id"] = f"edge-diltiazem-{tag}"
        e["labs"] = [x for x in e["labs"] if x["analyte"] != "lvef"] + [lab(f"edge-lvef-{tag}", "lvef", lvef, "%", "2026-06-01")]
        e["conditions"].append(condition("edge", "atrial_fibrillation", "Atrial fibrillation", "D004", "SNOMED CT", "49436004", "2026-01-01"))
        e["medications"].append(med("m-diltiazem", "Diltiazem", ["diltiazem"], [start("2026-02-01")], "120 mg", "once daily"))
        out[f"edge-diltiazem-{tag}"] = e
    return out


def main():
    m, h, r = margaret(), harold(), rosa()
    fixtures = {"margaret": m, "harold": h, "rosa": r, **edges(m, h, r)}
    for name, snap in fixtures.items():
        (HERE / f"{name}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(fixtures)} synthetic fixtures (as_of 2026-10-03T12:00:00Z).")


if __name__ == "__main__":
    main()
