import type { DataSource, PatientId, VitalSign } from "../types";

/**
 * HOME BLOOD PRESSURE MONITOR
 *
 * 1. Simulated sync: a realistic 14-day series (morning + evening) per demo
 *    persona, labelled "Simulated".
 * 2. Real Web Bluetooth, where the browser supports it: the standard
 *    Bluetooth SIG Blood Pressure Service (0x1810) and its Blood Pressure
 *    Measurement characteristic (0x2A35), which most Bluetooth cuffs that
 *    follow the Blood Pressure Profile expose.
 */

/* ---- Blood Pressure Measurement (0x2A35) parsing ------------------------ */

/** IEEE-11073 16-bit SFLOAT: 4-bit signed exponent, 12-bit signed mantissa. */
export function sfloat(raw: number): number {
  if (raw === 0x07ff || raw === 0x0800 || raw === 0x0801) return NaN; // NaN, NRes, reserved
  if (raw === 0x07fe) return Infinity;
  if (raw === 0x0802) return -Infinity;
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x8) exponent -= 0x10;
  return mantissa * 10 ** exponent;
}

export interface BpMeasurement {
  systolic: number;
  diastolic: number;
  meanArterial: number;
  /** ISO local date-time if the cuff sent one. */
  timestamp?: string;
  pulse?: number;
  userId?: number;
  /** Status bits: body movement, cuff fit, irregular pulse… (raw). */
  status?: number;
}

const KPA_TO_MMHG = 7.50062;

export function parseBloodPressureMeasurement(view: DataView): BpMeasurement {
  const flags = view.getUint8(0);
  const kPa = (flags & 0x01) !== 0;
  let o = 1;
  const read = () => {
    const v = sfloat(view.getUint16(o, true));
    o += 2;
    return v;
  };
  const conv = (v: number) => Math.round(kPa ? v * KPA_TO_MMHG : v);
  const m: BpMeasurement = { systolic: conv(read()), diastolic: conv(read()), meanArterial: conv(read()) };
  if (flags & 0x02) {
    const year = view.getUint16(o, true);
    const p = (n: number) => String(n).padStart(2, "0");
    m.timestamp = `${year}-${p(view.getUint8(o + 2))}-${p(view.getUint8(o + 3))}T${p(view.getUint8(o + 4))}:${p(view.getUint8(o + 5))}:${p(view.getUint8(o + 6))}`;
    o += 7;
  }
  if (flags & 0x04) m.pulse = Math.round(read());
  if (flags & 0x08) m.userId = view.getUint8(o++);
  if (flags & 0x10) m.status = view.getUint16(o, true);
  return m;
}

/* ---- Web Bluetooth ------------------------------------------------------- */

export const BP_SERVICE = 0x1810;
export const BP_MEASUREMENT = 0x2a35;

/** Minimal Web Bluetooth types (not in TypeScript's DOM lib). */
interface BtCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BtCharacteristic>;
}
interface BtServer {
  connected: boolean;
  getPrimaryService(s: number): Promise<{ getCharacteristic(c: number): Promise<BtCharacteristic> }>;
  disconnect(): void;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: { connect(): Promise<BtServer> };
}
interface Bluetooth {
  requestDevice(o: { filters: { services: number[] }[] }): Promise<BtDevice>;
  getAvailability?(): Promise<boolean>;
}

export function bluetoothSupport(nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator, secure = typeof isSecureContext === "undefined" ? true : isSecureContext): { supported: boolean; reason?: string } {
  if (!nav) return { supported: false, reason: "Not available here." };
  if ("bluetooth" in nav && secure) return { supported: true };
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1))
    return { supported: false, reason: "iPhone and iPad browsers (Safari and all others) don't support Web Bluetooth. A future native iOS app can connect to your cuff directly." };
  if (/Firefox\//.test(ua)) return { supported: false, reason: "Firefox doesn't support Web Bluetooth. Try Chrome or Edge on a computer or Android phone." };
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return { supported: false, reason: "Safari doesn't support Web Bluetooth. Try Chrome or Edge on a computer or Android phone." };
  if (!secure) return { supported: false, reason: "Web Bluetooth only works on secure (https) pages." };
  return { supported: false, reason: "This browser doesn't support Web Bluetooth. Try Chrome or Edge on a computer or Android phone." };
}

/**
 * Ask the user to pick a cuff, subscribe to measurements, and call
 * `onReading` for each one. Returns the device name and a disconnect function.
 * Must be called from a user gesture (a button tap).
 */
export async function connectBluetoothCuff(onReading: (m: BpMeasurement) => void): Promise<{ name: string; disconnect: () => void }> {
  const bt = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
  if (!bt) throw new Error(bluetoothSupport().reason);
  const device = await bt.requestDevice({ filters: [{ services: [BP_SERVICE] }] });
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(BP_SERVICE);
  const ch = await service.getCharacteristic(BP_MEASUREMENT);
  ch.addEventListener("characteristicvaluechanged", () => {
    if (ch.value) onReading(parseBloodPressureMeasurement(ch.value));
  });
  await ch.startNotifications();
  return { name: device.name ?? "Blood pressure monitor", disconnect: () => server.connected && server.disconnect() };
}

/* ---- Simulated sync ----------------------------------------------------- */

interface Profile {
  am: [number, number];
  pm: [number, number];
  spread: number;
  pulse: [number, number];
  /** Days (before the end date) with a notably low morning reading. */
  lowMornings?: number[];
}

const PROFILES: Record<PatientId, Profile> = {
  "p-harold": { am: [132, 82], pm: [136, 84], spread: 8, pulse: [62, 6] },
  // Heart failure on amlodipine + furosemide + carvedilol: mornings run low.
  "p-margaret": { am: [108, 64], pm: [120, 70], spread: 7, pulse: [60, 5], lowMornings: [0, 1, 3, 4, 6, 8, 11] },
  "p-rosa": { am: [126, 79], pm: [130, 80], spread: 7, pulse: [74, 6] },
};

export function simulateBpSync(patientId: PatientId, endDate: string, days = 14, importedAt = new Date().toISOString()): VitalSign[] {
  const p = PROFILES[patientId] ?? PROFILES["p-rosa"];
  let seed = [...patientId].reduce((s, c) => s + c.charCodeAt(0), 0);
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const source: DataSource = { kind: "device", label: "Blood pressure monitor (simulated)", importedAt, verified: false };
  const out: VitalSign[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const d = new Date(`${endDate}T12:00:00`);
    d.setDate(d.getDate() - back);
    const date = d.toISOString().slice(0, 10);
    for (const [slot, time, [sys, dia]] of [["am", "07:35", p.am], ["pm", "20:10", p.pm]] as const) {
      const low = slot === "am" && p.lowMornings?.includes(back);
      const s = Math.round((low ? sys - 12 : sys) + (rand() - 0.5) * p.spread * 2);
      const di = Math.round((low ? dia - 7 : dia) + (rand() - 0.5) * p.spread);
      out.push({
        id: `bp-sim-${patientId}-${date}-${slot}`, patientId, timestamp: `${date}T${time}:00`,
        systolic: s, diastolic: Math.min(di, s - 25), heartRate: Math.round(p.pulse[0] + (rand() - 0.5) * p.pulse[1] * 2), bpSetting: "home-cuff", source,
      });
    }
  }
  return out;
}

/** A reading from a real cuff, as a Passport item. */
export function vitalFromMeasurement(m: BpMeasurement, patientId: PatientId, deviceName: string, fallbackTimestamp: string): VitalSign {
  const ts = m.timestamp && m.timestamp.slice(0, 4) !== "0000" ? m.timestamp : fallbackTimestamp;
  return {
    id: `bp-ble-${ts}-${m.systolic}-${m.diastolic}`, patientId, timestamp: ts, systolic: m.systolic, diastolic: m.diastolic, heartRate: m.pulse, bpSetting: "home-cuff",
    source: { kind: "device", label: deviceName, importedAt: new Date().toISOString(), verified: false },
  };
}
