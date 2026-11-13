import { describe, expect, test } from "bun:test";
import { crc16, sectorCrcOk } from "../hid/device";
import {
  BUILTIN_PRESETS, PRO_PRESETS, codeOf, describe as describeAction, encodeDirectory, encodeProfile, hasLeftClick,
  hitsCodeDecode, hitsCodeEncode, kindOf, makeAction, parseDirectory, parseProfile, profileFromJson, profileToJson,
} from "./profile";
import { codeToHid } from "./tables";

function sampleSector(): Uint8Array {
  const r = new Uint8Array(255).fill(0xff);
  r.set([3, 3, 1, 0], 0);
  r.set([0x20, 0x03, 0x20, 0x03, 2], 4); // stage 0: 800 dpi
  r.set([0x40, 0x06, 0x40, 0x06, 2], 9); // stage 1: 1600 dpi
  r.fill(0, 14, 29); // stages 2-4 off
  r.set([0x14, 0x08, 0x0c, 0x14, 0x09, 0x0c], 0x26); // HITS L/R
  r.set([60, 0, 0x2c, 0x01], 0x2c);
  r.set([0x80, 0x01, 0x00, 0x01], 0x30); // left click
  const name = "Gaming";
  for (let i = 0; i < 24; i++) r.set(i < name.length ? [name.charCodeAt(i), 0] : [0, 0], 0xa0 + 2 * i);
  const c = crc16(r, 253);
  r[253] = c >> 8;
  r[254] = c & 0xff;
  return r;
}

describe("profile sector", () => {
  test("parses fields", () => {
    const p = parseProfile(1, sampleSector());
    expect(p.name).toBe("Gaming");
    expect(p.stages[0]).toEqual({ x: 800, y: 800, lod: 2 });
    expect(p.stages[2].x).toBe(0);
    expect(p.hits[0]).toEqual({ act: 5, rt: 2, rtOn: false, hap: 3 });
    expect(p.hits[1]).toEqual({ act: 5, rt: 2, rtOn: true, hap: 3 });
    expect(p.sleepS).toBe(60);
    expect(p.offS).toBe(300);
    expect(describeAction(p.buttons[0])).toBe("Left click");
    expect(hasLeftClick(p)).toBe(true);
  });

  test("encode(parse(x)) keeps every byte", () => {
    const raw = sampleSector();
    expect(encodeProfile(parseProfile(1, raw))).toEqual(raw);
    expect(sectorCrcOk(raw)).toBe(true);
  });

  test("edits land on the right bytes", () => {
    const p = parseProfile(1, sampleSector());
    p.hits[0] = { act: 2, rt: 4, rtOn: true, hap: 5 };
    p.name = "Ünïcode ✓";
    p.buttons[0] = makeAction("disabled");
    const r = encodeProfile(p);
    expect([r[0x26], r[0x27], r[0x28]]).toEqual([2 << 2, (4 << 2) | 1, 5 << 2]);
    const back = parseProfile(1, r);
    expect(back.name).toBe("Ünïcode ✓");
    expect(hasLeftClick(back)).toBe(false);
  });

  test("JSON export / import round trip and rejects bad values", () => {
    const p = parseProfile(1, sampleSector());
    const q = profileFromJson(p, profileToJson(p))!;
    expect(encodeProfile(q)).toEqual(encodeProfile(p));
    expect(profileFromJson(p, '{"rate_wireless": 9}')).toBeNull();
    expect(profileFromJson(p, '{"buttons": ["zz"]}')).toBeNull();
    expect(profileFromJson(p, "nope")).toBeNull();
  });
});

describe("actions", () => {
  test("make / kind / code", () => {
    const k = makeAction("key", 0x06, 0x01);
    expect(kindOf(k)).toBe("key");
    expect(describeAction(k)).toBe("Ctrl+C");
    expect(codeOf(makeAction("media", 0xcd))).toBe(0xcd);
    expect(describeAction(makeAction("function", 0x03))).toBe("Next DPI");
    expect(kindOf(makeAction("default"))).toBe("default");
  });
  test("keyboard codes", () => {
    expect(codeToHid("KeyC")).toBe(0x06);
    expect(codeToHid("Digit0")).toBe(0x27);
    expect(codeToHid("F13")).toBe(0x68);
    expect(codeToHid("ShiftLeft")).toBe(0xe1);
  });
});

describe("directory", () => {
  test("round trip", () => {
    const raw = new Uint8Array(255).fill(0xff);
    const entries = [{ sector: 1, enabled: true }, { sector: 2, enabled: false }];
    const enc = encodeDirectory(raw, entries);
    expect(parseDirectory(enc)).toEqual(entries);
  });
});

describe("HITS codes", () => {
  test("INS example from upstream", () => {
    const h = hitsCodeDecode("MDAwNDA1MDMwNTEwMDQwMw==");
    expect(h).toEqual([{ act: 4, rt: 3, rtOn: true, hap: 4 }, { act: 5, rt: 5, rtOn: false, hap: 3 }]);
  });
  test("all presets decode and re-encode identically", () => {
    for (const p of [...PRO_PRESETS, ...BUILTIN_PRESETS]) {
      const h = hitsCodeDecode(p.code);
      expect(typeof h).not.toBe("string");
      expect(hitsCodeEncode(h as never)).toBe(p.code);
    }
  });
  test("rejects junk", () => {
    expect(typeof hitsCodeDecode("hello")).toBe("string");
    expect(typeof hitsCodeDecode(btoa("0099990101110303"))).toBe("string");
  });
});
