// PRO X2 / X3 SUPERSTRIKE over HID++ 2.0. Protocol notes from upstream SuperStrike Studio
// (src/device.hpp, MIT): HITS 0x1B0C, report rate 0x8061, DPI list and live DPI 0x2202, onboard profiles
// 0x8100, surface mode 0x8090, battery 0x1004, firmware 0x0003, name 0x0005.
import { HidppError, sleep, Transport, type Bytes } from "./transport";
import { f, t, tc } from "../i18n/i18n";

export const F = {
  ROOT: 0x0000,
  FEATURESET: 0x0001,
  FWINFO: 0x0003,
  NAME: 0x0005,
  BATTERY: 0x1004,
  HITS: 0x1b0c,
  DPI: 0x2202,
  RATE: 0x8061,
  MODESTATUS: 0x8090,
  ONBOARD: 0x8100,
} as const;

export const MODE_ONBOARD = 1;
export const MODE_HOST = 2;
export const RATES_HZ = [125, 250, 500, 1000, 2000, 4000, 8000];

export interface Hits {
  act: number; // actuation 1..10
  rt: number; // rapid trigger level 1..5
  rtOn: boolean;
  hap: number; // haptics 0..5
}

export interface FeatureEntry {
  index: number;
  id: number;
  flags: number;
  version: number;
}

export interface OnboardInfo {
  format: number;
  profiles: number;
  buttons: number;
  sectors: number;
  sectorSize: number;
}

export const BATTERY_STATES = ["discharging", "charging", "charging (slow)", "full", "charge error"];

/** Battery state for display. States stay English inside the app; only the text shown is translated. */
export function batteryStateText(state: string): string {
  if (BATTERY_STATES.includes(state)) return t(state);
  const m = /^state (.*)$/.exec(state);
  return m ? f(t("state %s"), m[1]) : state;
}

/** CRC-16/CCITT-FALSE, used on onboard memory sectors (stored big-endian in the last 2 bytes). */
export function crc16(data: ArrayLike<number>, n = data.length): number {
  let c = 0xffff;
  for (let i = 0; i < n; i++) {
    c ^= data[i] << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}

export function sectorCrcOk(s: Bytes): boolean {
  return s.length > 2 && crc16(s, s.length - 2) === ((s[s.length - 2] << 8) | s[s.length - 1]);
}

/** An erased flash sector: never written (a mouse that only ever used its factory profile). */
export const sectorBlank = (s: Bytes) => s.every((b) => b === 0xff);

const hexId = (fid: number) => "0x" + fid.toString(16).padStart(4, "0");
const equal = (a: Bytes, b: Bytes) => a.length === b.length && a.every((v, i) => v === b[i]);
const secParams = (sector: number, off: number) => [sector >> 8, sector & 0xff, off >> 8, off & 0xff];

export class Device {
  name = "";
  private feat = new Map<number, number>();

  private constructor(readonly t: Transport, readonly index: number) {}

  /** Finds the first mouse with HITS on this receiver or cable (slots 1..6, then 0xFF). */
  static async open(hid: HIDDevice, onTraffic?: Transport["onTraffic"]): Promise<Device> {
    if (!hid.opened) await hid.open();
    const t = new Transport(hid);
    t.onTraffic = onTraffic;
    const errors: string[] = [];
    for (const idx of [1, 2, 3, 4, 5, 6, 0xff]) {
      let alive = false;
      for (const wait of [600, 1500]) {
        // a sleeping mouse needs a moment to wake up
        try {
          await t.request(idx, 0, 1, [0, 0, 0x5a], wait);
          alive = true;
          break;
        } catch {
          /* try the longer wait, then the next slot */
        }
      }
      if (!alive) continue;
      const d = new Device(t, idx);
      try {
        d.name = await d.readName();
        if ((await d.feature(F.HITS)) || d.name.toUpperCase().includes("SUPERSTRIKE")) return d;
      } catch (e) {
        errors.push(`slot ${idx}: ${(e as Error).message}`);
      }
    }
    throw new HidppError("no SUPERSTRIKE mouse found" + (errors.length ? ": " + errors.join("; ") : ". Is it awake?"));
  }

  /** Feature index, 0 when absent (cached). */
  async feature(fid: number): Promise<number> {
    const cached = this.feat.get(fid);
    if (cached !== undefined) return cached;
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await this.t.request(this.index, 0, 0, [fid >> 8, fid & 0xff]);
        this.feat.set(fid, r[0]);
        return r[0];
      } catch (e) {
        if (!(e instanceof HidppError) || !e.timeout || attempt >= 2) throw e;
        await sleep(50);
      }
    }
  }

  async call(fid: number, func: number, params: ArrayLike<number> = [], retries = 3): Promise<Bytes> {
    const idx = await this.feature(fid);
    if (!idx) throw new HidppError(`feature ${hexId(fid)} not present`);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.t.request(this.index, idx, func, params);
      } catch (e) {
        if (!(e instanceof HidppError) || !e.timeout || attempt >= retries) throw e;
        await sleep(40 * (attempt + 1));
      }
    }
  }

  private async readName(): Promise<string> {
    const idx = await this.feature(F.NAME);
    if (!idx) return "";
    const n = (await this.call(F.NAME, 0))[0];
    const bytes: number[] = [];
    while (bytes.length < n) {
      const r = await this.call(F.NAME, 1, [bytes.length]);
      bytes.push(...r.subarray(0, Math.min(16, n - bytes.length)));
    }
    return String.fromCharCode(...bytes.filter((b) => b)).trim();
  }

  async features(): Promise<FeatureEntry[]> {
    const n = (await this.call(F.FEATURESET, 0))[0];
    const out: FeatureEntry[] = [];
    for (let i = 0; i <= n; i++) {
      const r = await this.call(F.FEATURESET, 1, [i]);
      out.push({ index: i, id: (r[0] << 8) | r[1], flags: r[2], version: r[3] });
    }
    return out;
  }

  async firmware(): Promise<string[]> {
    const kinds: Record<number, string> = {
      0: "Main", 1: "Bootloader", 2: "Hardware", 3: "Touchpad", 4: "Optical sensor",
      5: "Softdevice", 6: "RF", 14: "Sub-module", 15: "Module",
    };
    const cnt = (await this.call(F.FWINFO, 0))[0];
    const out: string[] = [];
    for (let e = 0; e < cnt; e++) {
      const r = await this.call(F.FWINFO, 1, [e]);
      const k = kinds[r[0] & 0x0f];
      const kind = k ? tc("firmware part", k) : f(t("Type %d"), r[0]);
      const prefix = Array.from(r.subarray(1, 4), (c) => (c < 0x80 ? String.fromCharCode(c) : "\uFFFD")).join("").replace(/^[\0 ]+|[\0 ]+$/g, "");
      const h = (b: number) => b.toString(16).toUpperCase().padStart(2, "0");
      out.push(`${kind}: ${prefix} ${h(r[4])}.${h(r[5])}.B${h(r[6])}${h(r[7])}`);
    }
    return out;
  }

  async battery(): Promise<{ percent: number; state: string }> {
    const r = await this.call(F.BATTERY, 1);
    return { percent: r[0], state: BATTERY_STATES[r[2]] ?? `state ${r[2]}` };
  }

  async hitsGet(button: number): Promise<Hits> {
    const r = await this.call(F.HITS, 2, [button]);
    return { act: r[1] >> 2, rt: r[2] >> 2, rtOn: (r[2] & 1) !== 0, hap: r[3] >> 2 };
  }

  async hitsSet(button: number, h: Hits): Promise<void> {
    await this.call(F.HITS, 1, [button, (h.act << 2) & 0xfc, ((h.rt << 2) & 0xfc) | (h.rtOn ? 1 : 0), (h.hap << 2) & 0xfc]);
  }

  /** Report rate in use now, an index into RATES_HZ. */
  async rateGet(): Promise<number> {
    return (await this.call(F.RATE, 2))[0];
  }
  /** Sets the report rate now, until the next profile load. */
  async rateSet(idx: number): Promise<void> {
    await this.call(F.RATE, 3, [idx]);
  }

  /** Sets the sensor DPI now (0x2202 fn6: [sensor][x][y][lift-off]), until the next stage or profile load. */
  async dpiSet(x: number, y: number, lod: number): Promise<void> {
    await this.call(F.DPI, 6, [0, x >> 8, x & 0xff, y >> 8, y & 0xff, lod]);
  }

  async rateSupported(): Promise<number[]> {
    const r = await this.call(F.RATE, 1);
    const mask = (r[0] << 8) | r[1];
    return RATES_HZ.map((_, i) => i).filter((i) => mask & (1 << i));
  }

  /** Every DPI value the sensor accepts, sorted. */
  async dpiList(): Promise<number[]> {
    const raw: number[] = [];
    let words: number[] = [];
    for (let page = 0; page < 8; page++) {
      const r = await this.call(F.DPI, 2, [0, 0, page]);
      raw.push(...r.subarray(3, 16));
      words = [];
      for (let i = 0; i + 1 < raw.length; i += 2) words.push((raw[i] << 8) | raw[i + 1]);
      if (words.includes(0)) break;
    }
    const out: number[] = [];
    for (let i = 0; i < words.length && words[i]; ) {
      const w = words[i];
      if (w >> 13 === 7 && out.length && i + 1 < words.length) {
        const step = w & 0x1fff;
        const end = words[i + 1];
        for (let v = out[out.length - 1] + step; step > 0 && v <= end; v += step) out.push(v);
        i += 2;
      } else {
        out.push(w);
        i++;
      }
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }

  /** Gaming surface mode: 0 auto, 1 on, 2 off. Device setting, not per profile. */
  async surfaceGet(): Promise<number> {
    return ((await this.call(F.MODESTATUS, 0))[1] >> 1) & 3;
  }
  async surfaceSet(mode: number): Promise<void> {
    await this.call(F.MODESTATUS, 1, [0, (mode & 3) << 1, 0, 0x06]);
  }

  async onboardInfo(): Promise<OnboardInfo> {
    const r = await this.call(F.ONBOARD, 0);
    return { format: r[1], profiles: r[3], buttons: r[5], sectors: r[6], sectorSize: (r[7] << 8) | r[8] };
  }
  async onboardMode(): Promise<number> {
    return (await this.call(F.ONBOARD, 2))[0];
  }
  async setOnboardMode(mode: number): Promise<void> {
    await this.call(F.ONBOARD, 1, [mode]);
  }
  async currentProfile(): Promise<number> {
    const r = await this.call(F.ONBOARD, 4);
    return (r[0] << 8) | r[1];
  }
  async setCurrentProfile(sector: number): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.call(F.ONBOARD, 3, [sector >> 8, sector & 0xff], 0);
        return;
      } catch (e) {
        if (!(e instanceof HidppError) || !e.timeout || attempt >= 3) throw e;
        await sleep(150);
      }
    }
  }
  async currentStage(): Promise<number> {
    return (await this.call(F.ONBOARD, 11))[0];
  }
  async setCurrentStage(stage: number): Promise<void> {
    await this.call(F.ONBOARD, 12, [stage]);
  }

  /** Reads a memory sector; sectors below 0x100 are CRC-checked (3 tries) unless checkCrc is false. */
  async readSector(sector: number, size = 255, checkCrc = sector < 0x100): Promise<Bytes> {
    for (let attempt = 0; attempt < (checkCrc ? 3 : 1); attempt++) {
      const out = new Uint8Array(size);
      let off = 0;
      for (; off + 16 <= size; off += 16) out.set((await this.call(F.ONBOARD, 5, secParams(sector, off))).subarray(0, 16), off);
      if (off < size) {
        // the last partial chunk: read the final 16 bytes and keep the tail
        const c = await this.call(F.ONBOARD, 5, secParams(sector, size - 16));
        out.set(c.subarray(16 - (size - off), 16), off);
      }
      if (!checkCrc || sectorCrcOk(out)) return out;
    }
    throw new HidppError(`sector ${hexId(sector)}: CRC mismatch after 3 reads`);
  }

  /** Sets the CRC, writes the sector and verifies it by reading it back. Returns the written bytes. */
  async writeSector(sector: number, input: Bytes): Promise<Bytes> {
    if (sector >= 0x100) throw new HidppError(`sector ${hexId(sector)} is read-only`);
    const data = new Uint8Array(input);
    const n = data.length;
    const c = crc16(data, n - 2);
    data[n - 2] = c >> 8;
    data[n - 1] = c & 0xff;
    const step = async (func: number, params: ArrayLike<number>) => {
      try {
        await this.call(F.ONBOARD, func, params, 0);
      } catch (e) {
        if (!(e instanceof HidppError) || !e.timeout) throw e;
      }
    };
    await step(6, [sector >> 8, sector & 0xff, 0, 0, n >> 8, n & 0xff]);
    for (let off = 0; off < n; off += 16) await step(7, data.subarray(off, Math.min(off + 16, n)));
    await step(8, []);
    await sleep(50);
    if (!equal(await this.readSector(sector, n), data)) throw new HidppError(`sector ${hexId(sector)}: verification failed after write`);
    return data;
  }
}
