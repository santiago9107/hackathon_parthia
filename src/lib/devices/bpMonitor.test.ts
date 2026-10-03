import { describe, expect, it } from "vitest";
import { bluetoothSupport, parseBloodPressureMeasurement, sfloat, simulateBpSync, vitalFromMeasurement } from "./bpMonitor";

/** Build an SFLOAT from mantissa/exponent. */
const sf = (mantissa: number, exponent = 0) => ((exponent & 0xf) << 12) | (mantissa & 0x0fff);

function packet(opts: { kPa?: boolean; sys: number; dia: number; map: number; exp?: number; time?: [number, number, number, number, number, number]; pulse?: number; user?: number }) {
  const bytes: number[] = [];
  let flags = 0;
  if (opts.kPa) flags |= 0x01;
  if (opts.time) flags |= 0x02;
  if (opts.pulse !== undefined) flags |= 0x04;
  if (opts.user !== undefined) flags |= 0x08;
  bytes.push(flags);
  const push16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff);
  push16(sf(opts.sys, opts.exp));
  push16(sf(opts.dia, opts.exp));
  push16(sf(opts.map, opts.exp));
  if (opts.time) {
    push16(opts.time[0]);
    bytes.push(...opts.time.slice(1));
  }
  if (opts.pulse !== undefined) push16(sf(opts.pulse));
  if (opts.user !== undefined) bytes.push(opts.user);
  return new DataView(new Uint8Array(bytes).buffer);
}

describe("IEEE-11073 SFLOAT", () => {
  it("decodes mantissa and signed exponent", () => {
    expect(sfloat(sf(128))).toBe(128);
    expect(sfloat(sf(165, -1))).toBeCloseTo(16.5);
    expect(sfloat(sf(-5))).toBe(-5);
    expect(sfloat(0x07ff)).toBeNaN();
  });
});

describe("Blood Pressure Measurement (0x2A35)", () => {
  it("parses mmHg with timestamp, pulse and user", () => {
    const m = parseBloodPressureMeasurement(packet({ sys: 128, dia: 79, map: 95, time: [2026, 9, 10, 7, 35, 0], pulse: 64, user: 1 }));
    expect(m).toEqual({ systolic: 128, diastolic: 79, meanArterial: 95, timestamp: "2026-09-10T07:35:00", pulse: 64, userId: 1 });
  });

  it("converts kPa to mmHg", () => {
    const m = parseBloodPressureMeasurement(packet({ kPa: true, sys: 171, dia: 105, map: 127, exp: -1 }));
    expect(m.systolic).toBe(128);
    expect(m.diastolic).toBe(79);
  });

  it("becomes a Passport reading from a device", () => {
    const v = vitalFromMeasurement({ systolic: 118, diastolic: 72, meanArterial: 87, pulse: 61 }, "p-rosa", "BP7000", "2026-10-03T08:00:00");
    expect(v).toMatchObject({ systolic: 118, diastolic: 72, heartRate: 61, timestamp: "2026-10-03T08:00:00", bpSetting: "home-cuff", source: { kind: "device", label: "BP7000", verified: false } });
  });
});

describe("Web Bluetooth support", () => {
  const nav = (ua: string, extra: object = {}) => ({ userAgent: ua, maxTouchPoints: 0, ...extra }) as unknown as Navigator;
  it("explains why iPhone / Safari / Firefox can't connect", () => {
    expect(bluetoothSupport(nav("Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit Safari/605.1"), true).reason).toMatch(/iPhone and iPad/);
    expect(bluetoothSupport(nav("Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/19 Safari/605.1.15"), true).reason).toMatch(/Safari doesn't/);
    expect(bluetoothSupport(nav("Mozilla/5.0 Firefox/140.0"), true).reason).toMatch(/Firefox/);
  });
  it("is supported in Chromium on a secure page", () => {
    expect(bluetoothSupport(nav("Chrome/140", { bluetooth: {} }), true)).toEqual({ supported: true });
    expect(bluetoothSupport(nav("Chrome/140", { bluetooth: {} }), false).supported).toBe(false);
  });
});

describe("simulated sync", () => {
  it("produces 14 days of morning and evening readings, deterministic per persona", () => {
    const a = simulateBpSync("p-margaret", "2026-10-03", 14, "x");
    expect(a).toHaveLength(28);
    expect(simulateBpSync("p-margaret", "2026-10-03", 14, "x")).toEqual(a);
    expect(a[0].source).toMatchObject({ kind: "device", label: "Blood pressure monitor (simulated)" });
    expect(a.every((v) => v.diastolic! < v.systolic!)).toBe(true);
  });
  it("Margaret has several low morning readings; Harold doesn't", () => {
    const low = (id: string) => simulateBpSync(id, "2026-10-03").filter((v) => v.systolic! < 100).length;
    expect(low("p-margaret")).toBeGreaterThanOrEqual(4);
    expect(low("p-harold")).toBe(0);
  });
});
