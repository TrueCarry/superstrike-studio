// Demo mouse: a simulated PRO X3 SUPERSTRIKE on receiver slot 1, answering HID++ like the real one.
// Same five profiles as upstream src/hid_sim.cpp (MIT), so the app can be tried without a mouse.
// Nothing leaves the page; writes only change this simulation.
import { encodeProfile, makeAction, parseProfile, type Profile } from "../model/profile";
import { crc16, F, MODE_ONBOARD, type Hits } from "./device";

const SLOT = 1;
const NAME = "PRO X3 SUPERSTRIKE";
// feature index -> id, as the real mouse lists them (plus a few it has that the app does not use)
const FEATURES = [F.ROOT, F.FEATURESET, F.FWINFO, F.NAME, 0x0020, 0x1d4b, F.BATTERY, F.DPI, F.RATE, F.MODESTATUS, F.HITS, F.ONBOARD, 0x00c3];
const UNUSED = new Set([0x0020, 0x1d4b, 0x00c3]);

function withCrc(r: Uint8Array): Uint8Array {
  const c = crc16(r, r.length - 2);
  r[r.length - 2] = c >> 8;
  r[r.length - 1] = c & 0xff;
  return r;
}

function make(name: string, dpi: number[], defStage: number, rate: number, l: Hits, r: Hits): Profile {
  const p = parseProfile(0, new Uint8Array(255).fill(0xff));
  Object.assign(p, { name, defaultStage: defStage, shiftStage: 0, rateWireless: rate, rateWired: 3, angleSnap: 0, scrollFilter: 0, sleepS: 60, offS: 300 });
  p.stages = Array.from({ length: 5 }, (_, i) => (i < dpi.length ? { x: dpi[i], y: dpi[i], lod: 1 } : { x: 0, y: 0, lod: 0 }));
  p.hits = [l, r];
  for (let i = 0; i < 5; i++) p.buttons[i] = makeAction("mouse", 1 << i);
  return p;
}

const hit = (act: number, rt: number, rtOn: boolean, hap: number): Hits => ({ act, rt, rtOn, hap });

class Sim {
  sectors = new Map<number, Uint8Array>();
  hits: Hits[] = [];
  profile = 1;
  stage = 1;
  rate = 6;
  dpi = { x: 800, y: 800, lod: 1 };
  surface = 0;
  mode = MODE_ONBOARD;
  writeSector = -1;
  writeBuf: number[] = [];

  constructor() {
    const p = [
      make("Tactical FPS", [400, 800, 1600, 3200], 1, 6, hit(2, 1, true, 4), hit(4, 2, false, 3)),
      make("Arena FPS", [800, 1600, 3200], 1, 6, hit(1, 1, true, 5), hit(3, 1, true, 4)),
      make("Battle royale", [800, 1200, 1600, 3200, 6400], 2, 5, hit(3, 2, true, 3), hit(5, 2, false, 3)),
      make("MMO / MOBA", [1200, 2400, 3200], 1, 4, hit(5, 2, false, 2), hit(5, 2, false, 2)),
      make("Desktop", [1600, 3200], 0, 3, hit(6, 3, false, 1), hit(6, 3, false, 1)),
    ];
    p[1].stages[0].y = 720; // separate X / Y on one stage
    p[2].angleSnap = 1;
    p[3].buttons[3] = makeAction("key", 0x1e); // Back: 1
    p[3].buttons[4] = makeAction("key", 0x1f); // Forward: 2
    p[3].buttons[2] = makeAction("function", 0x05); // Middle: cycle DPI
    p[4].buttons[3] = makeAction("media", 0x00ea);
    p[4].buttons[4] = makeAction("media", 0x00e9);
    p[4].scrollFilter = 3;
    const dir = new Uint8Array(255).fill(0xff);
    p.forEach((prof, i) => {
      this.sectors.set(i + 1, withCrc(encodeProfile(prof)));
      dir.set([0, i + 1, i < 4 ? 1 : 0], 4 * i); // the last one is not in the profile cycle
    });
    this.sectors.set(0, withCrc(dir));
    const rom = new Uint8Array(255).fill(0xff); // ROM directory: the factory profile
    rom.set([0x01, 0x01, 1]);
    this.sectors.set(0x100, withCrc(rom));
    this.sectors.set(0x101, withCrc(encodeProfile(make("", [400, 800, 1600, 3200, 6400], 1, 3, hit(5, 2, false, 3), hit(5, 2, false, 3)))));
    this.loadHits();
  }

  loadHits() {
    const pr = parseProfile(this.profile, this.sectors.get(this.profile)!);
    this.hits = [{ ...pr.hits[0] }, { ...pr.hits[1] }];
  }

  /** Answer to feature id `fid`, function `func`. False for an unknown function. */
  answer(fid: number, func: number, a: Uint8Array, out: Uint8Array): boolean {
    switch (fid) {
      case F.ROOT:
        if (func === 0) {
          const i = FEATURES.indexOf((a[0] << 8) | a[1]);
          if (i >= 0) out[0] = i;
        } else out.set([4, 5, a[2]]); // ping: protocol 4.5, echo
        return true;
      case F.FEATURESET:
        if (func === 0) out[0] = FEATURES.length - 1;
        else if (a[0] < FEATURES.length) out.set([FEATURES[a[0]] >> 8, FEATURES[a[0]] & 0xff, 0, 1]);
        return true;
      case F.FWINFO: {
        const fw = [[0, 0x4d, 0x50, 0x4d, 0x27, 0x02, 0x00, 0x14], [1, 0x42, 0x4c, 0x31, 0x07, 0x00, 0x00, 0x03]];
        if (func === 0) out[0] = 2;
        else if (a[0] < 2) out.set(fw[a[0]]);
        return true;
      }
      case F.NAME:
        if (func === 0) out[0] = NAME.length;
        else for (let i = a[0], k = 0; i < NAME.length && k < 16; i++, k++) out[k] = NAME.charCodeAt(i);
        return true;
      case F.BATTERY:
        out.set([82, 4, 0]);
        return true;
      case F.DPI: // 100, then every 50 up to 48000
        if (func === 2 && a[2] === 0) out.set([0x00, 0x64, 0xe0, 0x32, 0xbb, 0x80], 3);
        else if (func === 6) this.dpi = { x: (a[1] << 8) | a[2], y: (a[3] << 8) | a[4], lod: a[5] };
        return true;
      case F.RATE:
        if (func === 1) out[1] = 0x7f;
        else if (func === 2) out[0] = this.rate;
        else if (func === 3) this.rate = a[0];
        return true;
      case F.MODESTATUS:
        if (func === 0) out[1] = this.surface << 1;
        else this.surface = (a[1] >> 1) & 3;
        return true;
      case F.HITS:
        if (func === 1 && a[0] < 2) this.hits[a[0]] = { act: a[1] >> 2, rt: a[2] >> 2, rtOn: (a[2] & 1) !== 0, hap: a[3] >> 2 };
        if (func === 2 && a[0] < 2) {
          const h = this.hits[a[0]];
          out.set([a[0], h.act << 2, (h.rt << 2) | (h.rtOn ? 1 : 0), h.hap << 2]);
        }
        return true;
      case F.ONBOARD:
        return this.onboard(func, a, out);
      default:
        return UNUSED.has(fid);
    }
  }

  onboard(func: number, a: Uint8Array, out: Uint8Array): boolean {
    const sec = (a[0] << 8) | a[1];
    switch (func) {
      case 0:
        out.set([0, 8, 0, 5, 0, 16, 16, 0, 255]);
        return true;
      case 1:
        this.mode = a[0];
        return true;
      case 2:
        out[0] = this.mode;
        return true;
      case 3:
        if (this.sectors.has(sec)) (this.profile = sec), this.loadHits();
        return true;
      case 4:
        out.set([this.profile >> 8, this.profile & 0xff]);
        return true;
      case 5: {
        const off = (a[2] << 8) | a[3];
        const s = this.sectors.get(sec);
        if (!s || off + 16 > s.length) return false;
        out.set(s.subarray(off, off + 16));
        return true;
      }
      case 6:
        this.writeSector = sec;
        this.writeBuf = [];
        return true;
      case 7:
        this.writeBuf.push(...a.subarray(0, 16));
        return true;
      case 8:
        if (this.writeSector >= 0) {
          const s = new Uint8Array(255);
          s.set(this.writeBuf.slice(0, 255));
          this.sectors.set(this.writeSector, s);
          if (this.writeSector === this.profile) this.loadHits();
        }
        this.writeSector = -1;
        return true;
      case 11:
        out[0] = this.stage;
        return true;
      case 12:
        this.stage = a[0];
        return true;
    }
    return false;
  }

  /** One long request (device index, feature index, function|swid, 16 params) -> the reply, or null (nobody on that slot). */
  request(req: Uint8Array): Uint8Array | null {
    if (req[0] !== SLOT) return null;
    const params = new Uint8Array(16);
    params.set(req.subarray(3, 19));
    const reply = new Uint8Array(19);
    reply.set(req.subarray(0, 3));
    const idx = req[1];
    const ok = idx < FEATURES.length && this.answer(FEATURES[idx], req[2] >> 4, params, reply.subarray(3));
    return ok ? reply : new Uint8Array([req[0], 0xff, req[1], req[2], 0x02 /* invalid argument */, 0, 0]);
  }
}

/** A fake receiver with the demo mouse on slot 1. Duck-types the parts of HIDDevice the app uses. */
export function demoDevice(): HIDDevice {
  const sim = new Sim();
  const target = new EventTarget();
  const dev = {
    opened: false,
    vendorId: 0x046d,
    productId: 0xc54f,
    productName: "Demo receiver",
    collections: [],
    async open() {
      dev.opened = true;
    },
    async close() {
      dev.opened = false;
    },
    async forget() {},
    async sendReport(reportId: number, data: BufferSource) {
      const req = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      const reply = sim.request(req);
      if (!reply) return;
      setTimeout(() => {
        const ev = Object.assign(new Event("inputreport"), { reportId, device: dev, data: new DataView(reply.buffer) });
        target.dispatchEvent(ev);
      }, 1);
    },
    async sendFeatureReport() {},
    async receiveFeatureReport() {
      return new DataView(new ArrayBuffer(0));
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    oninputreport: null,
  };
  return dev as unknown as HIDDevice;
}
