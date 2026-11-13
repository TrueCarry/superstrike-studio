// Whole-memory backups, same JSON format as upstream SuperStrike Studio:
// {"device": "...", "time": "...", "sectors": {"0x0000": "hex", ...}}
import { sectorCrcOk, type Device } from "../hid/device";
import { parseDirectory } from "./profile";

const toHex = (b: Uint8Array) => Array.from(b, (c) => c.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array((h.match(/[0-9a-fA-F]{2}/g) ?? []).map((x) => parseInt(x, 16)));

export async function backupJson(d: Device): Promise<string> {
  // Sector 0 may be erased (factory state): back it up as it is, and list no flash profiles then.
  const dir = await d.readSector(0, 255, false);
  const listed = sectorCrcOk(dir) ? parseDirectory(dir).map((e) => e.sector).filter((s) => s > 0 && s < 0x100) : [];
  const sectors: Record<string, string> = { "0x0000": toHex(dir) };
  for (const s of [...listed, 0x100, 0x101]) sectors["0x" + s.toString(16).padStart(4, "0")] = toHex(await d.readSector(s));
  const time = new Date().toLocaleString("sv-SE"); // "YYYY-MM-DD HH:MM:SS"
  return JSON.stringify({ device: d.name, time, sectors }, null, 2);
}

/** Valid writable sectors from a backup (CRC-checked, below 0x100), or an error message. */
export function parseBackup(text: string): [number, Uint8Array][] | string {
  let o: { sectors?: Record<string, unknown> };
  try {
    o = JSON.parse(text);
  } catch {
    return "not a SUPERSTRIKE backup file";
  }
  const out: [number, Uint8Array][] = [];
  for (const [key, value] of Object.entries(o?.sectors ?? {})) {
    const sec = parseInt(key, 16);
    if (typeof value !== "string" || !(sec >= 0 && sec < 0x100)) continue;
    const raw = fromHex(value);
    if (raw.length >= 64 && sectorCrcOk(raw)) out.push([sec, raw]);
  }
  return out.length ? out : "not a SUPERSTRIKE backup file";
}

/** Writes only the sectors that differ, directory (sector 0) last, then reloads the active profile. */
export async function restoreSectors(d: Device, secs: [number, Uint8Array][]): Promise<void> {
  const sorted = [...secs].sort((a, b) => b[0] - a[0]);
  for (const [sec, raw] of sorted) {
    const cur = await d.readSector(sec, raw.length);
    if (cur.length !== raw.length || cur.some((v, i) => v !== raw[i])) await d.writeSector(sec, raw);
  }
  await d.setCurrentProfile(await d.currentProfile());
}

// Automatic backups made before the first save of each session live in localStorage.
const AUTO_KEY = "superstrike.autoBackups";
const AUTO_MAX = 10;

export interface StoredBackup {
  time: string;
  json: string;
}

export function listAutoBackups(): StoredBackup[] {
  try {
    return JSON.parse(localStorage.getItem(AUTO_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function storeAutoBackup(json: string): void {
  const list = [{ time: new Date().toLocaleString("sv-SE"), json }, ...listAutoBackups()].slice(0, AUTO_MAX);
  localStorage.setItem(AUTO_KEY, JSON.stringify(list));
}

export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
