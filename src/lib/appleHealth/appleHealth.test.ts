import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeWithProgress, parseAppleHealth, appleLocal } from "./parser";
import { listZipEntries, openAppleHealthXml } from "./zip";

const zipBytes = readFileSync(join(__dirname, "..", "..", "..", "public", "samples", "apple-health-export-sample.zip"));
const zipBlob = new Blob([zipBytes]);

async function parse(since: string, until = "2026-10-03") {
  const { stream, size } = await openAppleHealthXml(zipBlob);
  let last = 0;
  const result = await parseAppleHealth(decodeWithProgress(stream, (b) => (last = b)), { patientId: "p-harold", since, until, importedAt: "2026-10-03T09:00:00Z" });
  return { result, size, last };
}

describe("zip reader", () => {
  it("lists the export entry from the central directory", async () => {
    const entries = await listZipEntries(zipBlob);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "apple_health_export/export.xml", method: 8 });
    expect(entries[0].uncompressedSize).toBeGreaterThan(entries[0].compressedSize * 5);
  });

  it("rejects something that isn't a zip with a helpful error… or reads a bare export.xml", async () => {
    const xml = new Blob(['<HealthData><Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="W" unit="count/min" startDate="2026-10-02 07:00:00 -0400" endDate="2026-10-02 23:59:00 -0400" value="51"/></HealthData>']);
    const { stream } = await openAppleHealthXml(xml);
    const r = await parseAppleHealth(decodeWithProgress(stream), { patientId: "p", since: "2026-09-23" });
    expect(r.vitals[0]).toMatchObject({ restingHeartRate: 51, timestamp: "2026-10-02T23:59:00" });
    await expect(listZipEntries(new Blob(["not a zip at all"]))).rejects.toThrow(/zip/);
  });
});

describe("Apple Health parser (synthetic sample export)", () => {
  it("streams the whole file and reports progress to the end", async () => {
    const { result, size, last } = await parse("2026-08-05");
    expect(last).toBe(size);
    expect(result.exportDate).toBe("2026-10-03T07:00:00");
    expect(result.counts.recordsSeen).toBeGreaterThan(3000);
  });

  it("keeps only the date window and only the types Parthia uses", async () => {
    const { result } = await parse("2026-09-04");
    expect(result.firstDate).toBe("2026-09-04");
    expect(result.lastDate).toBe("2026-10-03");
    const days = result.vitals.filter((v) => v.id.startsWith("ah-day-"));
    expect(days).toHaveLength(30);
    expect(result.counts.recordsInRange).toBeLessThan(result.counts.recordsSeen);
    expect(result.sources.sort()).toEqual(["Harold’s Apple Watch", "Harold’s iPhone", "Health", "OMRON connect"].sort());
  });

  it("does not double-count steps recorded by both iPhone and Watch", async () => {
    const { result } = await parse("2026-09-23");
    for (const v of result.vitals.filter((x) => x.steps !== undefined)) {
      expect(v.steps!).toBeGreaterThan(2500);
      expect(v.steps!).toBeLessThan(12000);
    }
  });

  it("sums only asleep stages into hours of sleep per night", async () => {
    const { result } = await parse("2026-09-23");
    const sleeps = result.vitals.filter((v) => v.sleepHours !== undefined).map((v) => v.sleepHours!);
    expect(sleeps.length).toBe(11);
    for (const h of sleeps) {
      expect(h).toBeGreaterThan(4.5);
      expect(h).toBeLessThan(8.5);
    }
  });

  it("finds the low resting heart rates on recent days", async () => {
    const { result } = await parse("2026-09-20");
    const low = result.vitals.filter((v) => (v.restingHeartRate ?? 99) < 50).map((v) => v.timestamp.slice(0, 10));
    expect(low).toEqual(["2026-09-22", "2026-09-25", "2026-09-28", "2026-10-01"]);
  });

  it("pairs systolic/diastolic into single readings, once each (not again from the Correlation)", async () => {
    const { result } = await parse("2026-09-04");
    const bp = result.vitals.filter((v) => v.systolic !== undefined);
    expect(bp.length).toBe(result.counts.bloodPressure);
    expect(bp.length).toBe(9); // Mon/Thu mornings in the 30-day window
    expect(new Set(bp.map((b) => b.timestamp)).size).toBe(bp.length);
    expect(bp[0]).toMatchObject({ bpSetting: "home-cuff", source: { kind: "wearable", label: "Apple Health", verified: false } });
  });

  it("converts weight recorded in pounds", async () => {
    const { result } = await parse("2026-09-04");
    const w = result.vitals.filter((v) => v.weightKg !== undefined).map((v) => v.weightKg!);
    expect(w.length).toBeGreaterThan(3);
    for (const kg of w) expect(kg).toBeGreaterThan(87);
  });

  it("handles a record split across two stream chunks", async () => {
    async function* chunks() {
      yield '<HealthData><Record type="HKQuantityTypeIdentifierStepCount" sourceName="P" unit="count" startDate="2026-09-10 08:00:00 -0400" endD';
      yield 'ate="2026-09-10 08:59:00 -0400" value="1234"/><Record type="HKQuantityTypeIdentifierStepCount" sourceName="P" unit="count" startDate="2026-09-10 09:00:00 -0400" endDate="2026-09-10 09:59:00 -0400" value="766"/></HealthData>';
    }
    const r = await parseAppleHealth(chunks(), { patientId: "p", since: "2026-09-10" });
    expect(r.vitals[0].steps).toBe(2000);
  });

  it("reads Apple's timestamp format as local time", () => {
    expect(appleLocal("2026-09-10 07:12:00 -0400")).toBe("2026-09-10T07:12:00");
  });
});
