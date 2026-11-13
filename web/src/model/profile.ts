// Onboard profile sector model (format 8, 255-byte sectors), button actions, the profile
// directory, and G HUB HITS codes. Layout as documented in upstream src/profile.hpp (MIT):
// 0x00 rate idx wireless, 0x01 rate idx wired, 0x02 default stage, 0x03 shift stage,
// 0x04+5n stage n [X LE16][Y LE16][LOD] (X == 0: off), 0x22 angle snap, 0x25 scroll filter
// (10 ms units, 0xFF off), 0x26 HITS L/R 3 bytes each, 0x2C sleep s LE16, 0x2E off s LE16,
// 0x30 buttons 16x4, 0x70 shift buttons 12x4, 0xA0 name UTF-16LE 24 chars, last 2 bytes CRC.
import type { Hits } from "../hid/device";
import { FUNCTIONS, KEYS, MEDIA, MODIFIERS, MOUSE_BUTTONS, type Named } from "./tables";

export const SECTOR_SIZE = 255;
export const DIR_SECTOR = 0;
export const ROM_DIR_SECTOR = 0x100;
export const FACTORY_SECTOR = 0x101;

// ---------------------------------------------------------------- actions

export type Kind = "default" | "disabled" | "mouse" | "key" | "media" | "function" | "raw";
export type Action = [number, number, number, number];

export const DEFAULT_ACTION: Action = [0xff, 0xff, 0xff, 0xff];

export function kindOf(a: Action): Kind {
  if (a.every((b) => b === 0xff)) return "default";
  if (a[0] >> 4 === 0x8) {
    const k = (["disabled", "mouse", "key", "media"] as const)[a[1]];
    if (k) return k;
  } else if (a[0] >> 4 === 0x9) {
    return "function";
  }
  return "raw";
}

/** Mouse mask, HID usage, consumer code or function id. */
export function codeOf(a: Action): number {
  switch (kindOf(a)) {
    case "mouse":
    case "media":
      return (a[2] << 8) | a[3];
    case "key":
      return a[3];
    case "function":
      return a[1];
    default:
      return 0;
  }
}

export const modsOf = (a: Action) => (kindOf(a) === "key" ? a[2] : 0);

export function makeAction(k: Kind, code = 0, mods = 0): Action {
  const hi = (code >> 8) & 0xff;
  const lo = code & 0xff;
  switch (k) {
    case "mouse":
      return [0x80, 0x01, hi, lo];
    case "key":
      return [0x80, 0x02, mods & 0xff, lo];
    case "media":
      return [0x80, 0x03, hi, lo];
    case "function":
      return [0x90, lo, 0xff, 0x00];
    case "default":
      return [...DEFAULT_ACTION];
    default:
      return [0x80, 0x00, 0xff, 0xff];
  }
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
const nameOf = (table: Named[], code: number, fallback: string) => table.find((n) => n.code === code)?.name ?? fallback;

export function describe(a: Action): string {
  const code = codeOf(a);
  switch (kindOf(a)) {
    case "mouse":
      return nameOf(MOUSE_BUTTONS, code, `Mouse mask 0x${code.toString(16).padStart(4, "0")}`);
    case "key": {
      const mods = MODIFIERS.filter((m) => modsOf(a) & m.code).map((m) => m.name + "+").join("");
      return mods + nameOf(KEYS, code, `key 0x${hex2(code)}`);
    }
    case "media":
      return nameOf(MEDIA, code, `Consumer 0x${code.toString(16).padStart(4, "0")}`);
    case "function":
      return nameOf(FUNCTIONS, code, `Function 0x${hex2(code)}`);
    case "disabled":
      return "Disabled";
    case "default":
      return "Factory default";
    default:
      return `Macro / custom (${a.map(hex2).join(" ")})`;
  }
}

// ---------------------------------------------------------------- profile

export interface Stage {
  x: number; // 0 = stage off
  y: number;
  lod: number; // lift-off distance: 1 low, 2 medium, 3 high
}

export interface Profile {
  sector: number;
  raw: Uint8Array; // original bytes, so unknown fields survive a save
  rateWireless: number;
  rateWired: number;
  defaultStage: number;
  shiftStage: number;
  stages: Stage[]; // 5
  angleSnap: number;
  scrollFilter: number; // 10 ms units, 0 off
  hits: [Hits, Hits];
  sleepS: number;
  offS: number;
  buttons: Action[]; // 16
  shiftButtons: Action[]; // 12
  name: string;
}

function decodeName(r: Uint8Array): string {
  const u: number[] = [];
  for (let i = 0xa0; i < 0xd0; i += 2) {
    const c = r[i] | (r[i + 1] << 8);
    if (c === 0 || (r[i] & r[i + 1]) === 0xff) break;
    u.push(c);
  }
  return String.fromCharCode(...u).toWellFormed().trim();
}

function encodeName(name: string): Uint8Array {
  const out = new Uint8Array(48);
  let n = Math.min(name.length, 24);
  const c23 = name.charCodeAt(23);
  if (name.length > 24 && c23 >= 0xd800 && c23 < 0xdc00) n = 23; // never split a surrogate pair
  for (let i = 0; i < n; i++) {
    const c = name.charCodeAt(i);
    out[2 * i] = c & 0xff;
    out[2 * i + 1] = c >> 8;
  }
  return out;
}

export function parseProfile(sector: number, input: Uint8Array): Profile {
  const r = new Uint8Array(Math.max(SECTOR_SIZE, input.length)).fill(0xff);
  r.set(input);
  const u16 = (o: number) => r[o] | (r[o + 1] << 8);
  const hitsAt = (o: number): Hits => ({ act: r[o] >> 2, rt: r[o + 1] >> 2, rtOn: (r[o + 1] & 1) !== 0, hap: r[o + 2] >> 2 });
  const actions = (base: number, n: number) =>
    Array.from({ length: n }, (_, i) => Array.from(r.subarray(base + 4 * i, base + 4 * i + 4)) as Action);
  return {
    sector,
    raw: r,
    rateWireless: r[0],
    rateWired: r[1],
    defaultStage: r[2],
    shiftStage: r[3],
    stages: Array.from({ length: 5 }, (_, n) => {
      const o = 4 + 5 * n;
      return { x: u16(o), y: u16(o + 2), lod: r[o + 4] };
    }),
    angleSnap: r[0x22],
    scrollFilter: r[0x25] === 0xff ? 0 : r[0x25],
    hits: [hitsAt(0x26), hitsAt(0x29)],
    sleepS: u16(0x2c),
    offS: u16(0x2e),
    buttons: actions(0x30, 16),
    shiftButtons: actions(0x70, 12),
    name: decodeName(r),
  };
}

/** Encodes back into the sector bytes. The CRC is set by Device.writeSector. */
export function encodeProfile(p: Profile): Uint8Array {
  const r = new Uint8Array(Math.max(SECTOR_SIZE, p.raw.length)).fill(0xff);
  r.set(p.raw);
  const u8 = (v: number) => v & 0xff;
  r[0] = u8(p.rateWireless);
  r[1] = u8(p.rateWired);
  r[2] = u8(p.defaultStage);
  r[3] = u8(p.shiftStage);
  p.stages.forEach((s, n) => {
    const o = 4 + 5 * n;
    r[o] = u8(s.x);
    r[o + 1] = u8(s.x >> 8);
    r[o + 2] = u8(s.y);
    r[o + 3] = u8(s.y >> 8);
    r[o + 4] = u8(s.lod);
  });
  r[0x22] = u8(p.angleSnap);
  r[0x25] = p.scrollFilter ? u8(p.scrollFilter) : p.raw[0x25] === 0xff ? 0xff : 0;
  p.hits.forEach((h, b) => {
    const o = 0x26 + 3 * b;
    r[o] = u8((h.act << 2) | (r[o] & 3));
    r[o + 1] = u8((h.rt << 2) | (r[o + 1] & 2) | (h.rtOn ? 1 : 0));
    r[o + 2] = u8((h.hap << 2) | (r[o + 2] & 3));
  });
  r[0x2c] = u8(p.sleepS);
  r[0x2d] = u8(p.sleepS >> 8);
  r[0x2e] = u8(p.offS);
  r[0x2f] = u8(p.offS >> 8);
  p.buttons.forEach((a, i) => r.set(a, 0x30 + 4 * i));
  p.shiftButtons.forEach((a, i) => r.set(a, 0x70 + 4 * i));
  if (p.name !== decodeName(r)) r.set(encodeName(p.name), 0xa0);
  return r;
}

export const cloneProfile = (p: Profile): Profile => ({ ...structuredClone(p), raw: new Uint8Array(p.raw) });

/** True when some button still sends a left click (saving without one locks you out of clicking). */
export function hasLeftClick(p: Profile): boolean {
  return p.buttons.slice(0, 5).some((a, i) => (kindOf(a) === "mouse" && (codeOf(a) & 1) !== 0) || (kindOf(a) === "default" && i === 0));
}

// ---------------------------------------------------------------- profile JSON (export / import)

const actionHex = (a: Action) => a.map(hex2).join("");

export function profileToJson(p: Profile): string {
  return JSON.stringify(
    {
      name: p.name,
      rate_wireless: p.rateWireless,
      rate_wired: p.rateWired,
      default_stage: p.defaultStage,
      shift_stage: p.shiftStage,
      stages: p.stages,
      angle_snap: p.angleSnap,
      scroll_filter: p.scrollFilter,
      hits: p.hits.map((h) => ({ act: h.act, rt: h.rt, rt_on: h.rtOn, hap: h.hap })),
      sleep_s: p.sleepS,
      off_s: p.offS,
      buttons: p.buttons.map(actionHex),
      shift_buttons: p.shiftButtons.map(actionHex),
    },
    null,
    2,
  );
}

/** Applies an exported profile onto `base`. Returns null on any invalid value (nothing changes). */
export function profileFromJson(base: Profile, text: string): Profile | null {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const j = o as Record<string, unknown>;
  const p = cloneProfile(base);
  const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);
  const ints: [string, number, number, (v: number) => void][] = [
    ["rate_wireless", 0, 6, (v) => (p.rateWireless = v)],
    ["rate_wired", 0, 6, (v) => (p.rateWired = v)],
    ["default_stage", 0, 4, (v) => (p.defaultStage = v)],
    ["shift_stage", 0, 4, (v) => (p.shiftStage = v)],
    ["angle_snap", 0, 255, (v) => (p.angleSnap = v)],
    ["scroll_filter", 0, 255, (v) => (p.scrollFilter = v)],
    ["sleep_s", 0, 0xffff, (v) => (p.sleepS = v)],
    ["off_s", 0, 0xffff, (v) => (p.offS = v)],
  ];
  for (const [key, lo, hi, set] of ints) {
    if (!(key in j)) continue;
    const v = int(j[key], lo, hi);
    if (v === null) return null;
    set(v);
  }
  if ("name" in j) {
    if (typeof j.name !== "string") return null;
    p.name = j.name;
  }
  const arr = (key: string, max: number) => {
    if (!(key in j)) return [];
    const a = j[key];
    return Array.isArray(a) && a.length <= max ? a : null;
  };
  const stages = arr("stages", 5);
  if (!stages) return null;
  for (const [i, s] of stages.entries()) {
    if (!s || typeof s !== "object") return null;
    const x = int(s.x, 0, 0xffff), y = int(s.y, 0, 0xffff), lod = int(s.lod, 0, 3);
    if (x === null || y === null || lod === null) return null;
    p.stages[i] = { x, y, lod };
  }
  const hits = arr("hits", 2);
  if (!hits) return null;
  for (const [i, h] of hits.entries()) {
    if (!h || typeof h !== "object") return null;
    const act = int(h.act, 0, 63), rt = int(h.rt, 0, 63), hap = int(h.hap, 0, 63);
    if (act === null || rt === null || hap === null || (h.rt_on !== undefined && typeof h.rt_on !== "boolean")) return null;
    p.hits[i] = { act, rt, hap, rtOn: h.rt_on ?? p.hits[i].rtOn };
  }
  for (const [key, dst] of [["buttons", p.buttons], ["shift_buttons", p.shiftButtons]] as const) {
    const list = arr(key, dst.length);
    if (!list) return null;
    for (const [i, s] of list.entries()) {
      if (typeof s !== "string" || !/^[0-9a-fA-F]{8}$/.test(s)) return null;
      dst[i] = [0, 2, 4, 6].map((k) => parseInt(s.slice(k, k + 2), 16)) as Action;
    }
  }
  return p;
}

// ---------------------------------------------------------------- directory (sector 0)

export interface DirEntry {
  sector: number;
  enabled: boolean; // in the profile cycle
}

export function parseDirectory(raw: Uint8Array): DirEntry[] {
  const out: DirEntry[] = [];
  for (let i = 0; i + 3 < raw.length; i += 4) {
    const sec = (raw[i] << 8) | raw[i + 1];
    if (sec === 0xffff) break;
    out.push({ sector: sec, enabled: raw[i + 2] === 1 });
  }
  return out;
}

export function encodeDirectory(raw: Uint8Array, entries: DirEntry[]): Uint8Array {
  const r = new Uint8Array(Math.max(raw.length, 4 * entries.length)).fill(0xff);
  r.set(raw);
  entries.forEach((e, i) => {
    r[4 * i] = e.sector >> 8;
    r[4 * i + 1] = e.sector & 0xff;
    r[4 * i + 2] = e.enabled ? 1 : 0;
    r[4 * i + 3] = 0xff;
  });
  const end = 4 * entries.length;
  if (end + 1 < r.length && !(r[end] === 0xff && r[end + 1] === 0xff)) r[end] = r[end + 1] = 0xff;
  return r;
}

// ---------------------------------------------------------------- HITS codes (G HUB format)
// base64 of 16 digits: "00", act L, act R, rt L, rt R (2 digits each), rt-on L, rt-on R
// (1 digit each), hap L, hap R.

export function hitsCodeDecode(code: string): [Hits, Hits] | string {
  const c = code.trim();
  if (!c || c.length % 4 || !/^[A-Za-z0-9+/=]+$/.test(c)) return "not a HITS code";
  let s: string;
  try {
    s = atob(c);
  } catch {
    return "not a HITS code";
  }
  if (!/^00\d{14}$/.test(s)) return "not a HITS code (unknown version or length)";
  const num = (pos: number) => Number(s.slice(pos, pos + 2));
  const h = [0, 1].map((b) => ({ act: num(2 + 2 * b), rt: num(6 + 2 * b), rtOn: s[10 + b] === "1", hap: num(12 + 2 * b) }));
  if (h.some((x) => x.act < 1 || x.act > 10 || x.rt < 1 || x.rt > 5 || x.hap > 5)) return "HITS code value out of range";
  return h as [Hits, Hits];
}

export function hitsCodeEncode(h: [Hits, Hits]): string {
  const d2 = (n: number) => String(n).padStart(2, "0");
  return btoa(`00${d2(h[0].act)}${d2(h[1].act)}${d2(h[0].rt)}${d2(h[1].rt)}${+h[0].rtOn}${+h[1].rtOn}${d2(h[0].hap)}${d2(h[1].hap)}`);
}

export interface Preset {
  name: string;
  code: string;
}

/** Logitech-published pro player HITS codes. */
export const PRO_PRESETS: Preset[] = [
  { name: "m0NESY (CS2)", code: "MDAwNjA2MDEwMTExMDUwMw==" }, { name: "INS (CS2)", code: "MDAwNDA1MDMwNTEwMDQwMw==" },
  { name: "KSCERATO (CS2)", code: "MDAwMjAyMDMwMjExMDMwMw==" }, { name: "Coach Joe (Valorant)", code: "MDAwMjAyMDIwMjExMDQwMw==" },
  { name: "McFaliN (Valorant)", code: "MDAwNDA1MDIwMjExMDMwNQ==" }, { name: "Yetujey (Valorant)", code: "MDAwNDA0MDMwMzExMDIwMg==" },
  { name: "ShowMaker (LoL)", code: "MDAwMjAyMDEwMTExMDIwMg==" }, { name: "Siwoo (LoL)", code: "MDAwMjAyMDEwMTExMDMwMw==" },
  { name: "Lucid (LoL)", code: "MDAwNTAxMDEwMTExMDMwMw==" }, { name: "Smash (LoL)", code: "MDAwMjAyMDIwMjExMDEwMQ==" },
  { name: "Career (LoL)", code: "MDAwMjAyMDIwMjExMDQwNA==" }, { name: "Blaz (R6)", code: "MDAwNjA2MDMwMzExMDAwMA==" },
];

export const BUILTIN_PRESETS: Preset[] = [
  { name: "Factory default", code: "MDAwNTA1MDIwMjAwMDMwMw==" },
  { name: "Hair trigger", code: "MDAwMTAxMDEwMTExMDIwMg==" },
  { name: "Fast FPS", code: "MDAwMzAzMDIwMjExMDMwMw==" },
  { name: "Balanced", code: "MDAwNTA1MDMwMzAwMDMwMw==" },
  { name: "Deep press", code: "MDAwODA4MDQwNDAwMDQwNA==" },
  { name: "Strong feedback", code: "MDAwNTA1MDIwMjAwMDUwNQ==" },
  { name: "Silent feel", code: "MDAwNTA1MDIwMjAwMDAwMA==" },
];
