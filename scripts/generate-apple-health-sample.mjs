#!/usr/bin/env node
/**
 * Generates a SYNTHETIC Apple Health export (export.zip) for Harold — the same
 * structure the Health app produces (apple_health_export/export.xml inside a
 * zip), small enough to ship as a sample. No real person.
 *
 * 60 days ending 2026-09-11: hourly heart rate, daily resting heart rate
 * (dipping into the high 40s on a few recent days — he takes metoprolol),
 * steps from both iPhone and Watch (overlapping, as in real exports), sleep
 * stages, weekly weight, and home blood-pressure readings wrapped in a
 * <Correlation> like the Health app does. Plus a few record types Parthia
 * ignores, to exercise the filter.
 *
 * Usage: node scripts/generate-apple-health-sample.mjs → public/samples/apple-health-export-sample.zip
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples", "apple-health-export-sample.zip");
const END = new Date("2026-09-11T12:00:00");
const DAYS = 60;
let seed = 1958;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00 -0400`;
const at = (base, h, m = 0) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
const addMin = (d, m) => new Date(d.getTime() + m * 60000);

const PHONE = 'sourceName="Harold’s iPhone" sourceVersion="19.6" device="&lt;&lt;HKDevice: iPhone&gt;&gt;"';
const WATCH = 'sourceName="Harold’s Apple Watch" sourceVersion="11.6" device="&lt;&lt;HKDevice: Watch&gt;&gt;"';
const CUFF = 'sourceName="OMRON connect" sourceVersion="7.2"';
const SCALE = 'sourceName="Health" sourceVersion="19.6"';
const rec = (type, src, unit, start, end, value) =>
  `  <Record type="${type}" ${src}${unit ? ` unit="${unit}"` : ""} creationDate="${stamp(end)}" startDate="${stamp(start)}" endDate="${stamp(end)}" value="${value}"/>`;

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE HealthData [',
  '<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary)*)>',
  ']>',
  '<HealthData locale="en_US">',
  ' <!-- SYNTHETIC SAMPLE for the Parthia Health demo. No real person. -->',
  ` <ExportDate value="${stamp(at(END, 7))}"/>`,
  ' <Me HKCharacteristicTypeIdentifierDateOfBirth="1958-03-02" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeAPositive"/>',
];

for (let back = DAYS - 1; back >= 0; back--) {
  const day = new Date(END);
  day.setDate(day.getDate() - back);
  const recent = back < 14;

  // Sleep: previous night into this morning, a few stages from the Watch + "in bed" from the iPhone.
  let t = at(new Date(day.getTime() - 86400000), 22, 40 + Math.floor(rand() * 30));
  const wake = at(day, 6, 10 + Math.floor(rand() * 40));
  lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", PHONE, "", t, wake, "HKCategoryValueSleepAnalysisInBed"));
  t = addMin(t, 15);
  for (const [stage, mins] of [["AsleepCore", 110], ["AsleepDeep", 55], ["AsleepCore", 80], ["AsleepREM", 45], ["Awake", 10], ["AsleepCore", 70]]) {
    const len = Math.round(mins * (0.8 + rand() * 0.4));
    const e = addMin(t, len);
    if (e > wake) break;
    lines.push(rec("HKCategoryTypeIdentifierSleepAnalysis", WATCH, "", t, e, `HKCategoryValueSleepAnalysis${stage}`));
    t = e;
  }

  // Heart rate: hourly 8:00–21:00 from the Watch.
  for (let h = 8; h <= 21; h++) {
    const s = at(day, h, Math.floor(rand() * 50));
    lines.push(rec("HKQuantityTypeIdentifierHeartRate", WATCH, "count/min", s, s, Math.round(64 + rand() * 18 + (h > 16 ? 4 : 0))));
  }
  // Resting heart rate: mid-50s on metoprolol; dips into the high 40s on some recent days.
  const low = recent && [2, 5, 8, 11].includes(back);
  lines.push(rec("HKQuantityTypeIdentifierRestingHeartRate", WATCH, "count/min", at(day, 7), at(day, 23, 59), low ? 47 + Math.floor(rand() * 3) : 52 + Math.floor(rand() * 6)));

  // Steps: hourly from BOTH iPhone and Watch (overlapping — real exports do this).
  for (let h = 7; h <= 20; h++) {
    const n = Math.round((150 + rand() * 450) * (h === 10 || h === 17 ? 3 : 1));
    lines.push(rec("HKQuantityTypeIdentifierStepCount", PHONE, "count", at(day, h), at(day, h, 59), n));
    lines.push(rec("HKQuantityTypeIdentifierStepCount", WATCH, "count", at(day, h), at(day, h, 59), Math.round(n * (0.9 + rand() * 0.15))));
  }
  // Records Parthia doesn't use.
  lines.push(rec("HKQuantityTypeIdentifierActiveEnergyBurned", WATCH, "Cal", at(day, 20), at(day, 20, 59), Math.round(200 + rand() * 200)));

  // Weight weekly (pounds, as a US scale would record it).
  if (back % 7 === 0) lines.push(rec("HKQuantityTypeIdentifierBodyMass", SCALE, "lb", at(day, 7, 5), at(day, 7, 5), (195.5 - (DAYS - back) * 0.03 + rand()).toFixed(1)));

  // Home blood pressure, Mon/Thu mornings, wrapped in a Correlation.
  if (back % 7 === 1 || back % 7 === 4) {
    const s = at(day, 8, 5);
    const sys = Math.round(128 + rand() * 12);
    const dia = Math.round(78 + rand() * 8);
    lines.push(`  <Correlation type="HKCorrelationTypeIdentifierBloodPressure" ${CUFF} creationDate="${stamp(s)}" startDate="${stamp(s)}" endDate="${stamp(s)}">`);
    lines.push("  " + rec("HKQuantityTypeIdentifierBloodPressureSystolic", CUFF, "mmHg", s, s, sys));
    lines.push("  " + rec("HKQuantityTypeIdentifierBloodPressureDiastolic", CUFF, "mmHg", s, s, dia));
    lines.push("  </Correlation>");
    // The Health app also lists the same readings at top level.
    lines.push(rec("HKQuantityTypeIdentifierBloodPressureSystolic", CUFF, "mmHg", s, s, sys));
    lines.push(rec("HKQuantityTypeIdentifierBloodPressureDiastolic", CUFF, "mmHg", s, s, dia));
  }
}
lines.push(' <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="32" durationUnit="min" sourceName="Harold’s Apple Watch" startDate="2026-09-08 17:02:00 -0400" endDate="2026-09-08 17:34:00 -0400"/>');
lines.push("</HealthData>");
const xml = Buffer.from(lines.join("\n") + "\n", "utf8");

/* ---- Minimal zip writer (one deflated entry) ---------------------------- */
const name = Buffer.from("apple_health_export/export.xml");
const data = deflateRawSync(xml, { level: 9 });
const crc = crc32(xml);
const local = Buffer.alloc(30);
local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
local.writeUInt16LE(0, 10); local.writeUInt16LE(0x5321, 12); local.writeUInt32LE(crc, 14);
local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
const central = Buffer.alloc(46);
central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(8, 10);
central.writeUInt16LE(0, 12); central.writeUInt16LE(0x5321, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24);
central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(0, 42);
const cdOffset = local.length + name.length + data.length;
const cdSize = central.length + name.length;
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(cdOffset, 16);
writeFileSync(OUT, Buffer.concat([local, name, data, central, name, eocd]));
console.log(`apple-health-export-sample.zip: ${lines.length} lines, xml ${Math.round(xml.length / 1024)} KB → zip ${Math.round((cdOffset + cdSize + 22) / 1024)} KB`);
