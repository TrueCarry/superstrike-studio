// App state and every action that talks to the mouse. One store, read with useStore().
import { useSyncExternalStore } from "react";
import {
  Device, MODE_ONBOARD, sectorBlank, sectorCrcOk, type FeatureEntry, type Hits, type OnboardInfo,
} from "../hid/device";
import { confirmDialog } from "../components/dialogs";
import { demoDevice } from "../hid/sim";
import { HidppError } from "../hid/transport";
import { f, t } from "../i18n/i18n";
import { backupJson, parseBackup, restoreSectors, storeAutoBackup } from "../model/backup";
import {
  DIR_SECTOR, FACTORY_SECTOR, cloneProfile, encodeDirectory, encodeProfile, hasLeftClick, parseDirectory,
  parseProfile, ROM_DIR_SECTOR, type DirEntry, type Preset, type Profile,
} from "../model/profile";

export interface DeviceInfo {
  name: string;
  demo: boolean;
  index: number; // receiver slot 1..6, 0xFF cable
  productId: number;
  firmware: string[];
  battery: number; // -1 unknown
  batteryState: string;
  onboard: OnboardInfo | null;
  mode: number;
  surface: number; // -1 unknown
  stage: number; // DPI stage in use now
  dpiList: number[];
  rates: number[];
  features: FeatureEntry[];
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

export interface State {
  supported: boolean;
  status: "disconnected" | "connecting" | "loading" | "connected";
  busy: string; // non-empty while a long job runs ("Writing to the mouse memory…")
  error: string;
  info: DeviceInfo | null;
  dirRaw: Uint8Array;
  dir: DirEntry[];
  profiles: Record<number, Profile>;
  factory: Profile | null;
  active: number;
  edit: number;
  dirty: number[]; // sectors (DIR_SECTOR = directory)
  /** The onboard flash was never written: the mouse runs on its factory (ROM) profile, the first save sets it up. */
  blank: boolean;
  toasts: Toast[];
  log: string[];
  presets: Preset[]; // user presets
  shell: string;
  accent: string;
}

const PRESETS_KEY = "superstrike.presets";
const LOOK_KEY = "superstrike.look";
const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback;
  } catch {
    return fallback;
  }
};
const look = loadJson(LOOK_KEY, { shell: "#ffffff", accent: "#3b9cff" });

let state: State = {
  supported: typeof navigator !== "undefined" && "hid" in navigator,
  status: "disconnected",
  busy: "",
  error: "",
  info: null,
  dirRaw: new Uint8Array(),
  dir: [],
  profiles: {},
  factory: null,
  active: -1,
  edit: -1,
  dirty: [],
  blank: false,
  toasts: [],
  log: [],
  presets: loadJson(PRESETS_KEY, []),
  shell: look.shell,
  accent: look.accent,
};

const listeners = new Set<() => void>();
const set = (patch: Partial<State> | ((s: State) => Partial<State>)) => {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
};
export const getState = () => state;
// Dev builds: the live store, for debugging from the console.
if (import.meta.env.DEV) Object.assign(globalThis, { __superstrike: { getState, updateProfile: (fn: (p: Profile) => void) => updateProfile(fn) } });
export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => select(state),
  );
}

let device: Device | null = null;
let hidDevice: HIDDevice | null = null;
let demo: HIDDevice | null = null;
let backedUp = false;
let toastId = 0;

export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = ++toastId;
  set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 8000 : 4000);
}

const hex = (b: Uint8Array) => Array.from(b, (c) => c.toString(16).padStart(2, "0")).join(" ");
function traffic(dir: "out" | "in", bytes: Uint8Array) {
  set((s) => ({ log: [...s.log.slice(-299), `${dir === "out" ? "->" : "<-"} ${hex(bytes)}`] }));
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs a device job; failures become an error toast (`fail` words it). Returns undefined when it failed. */
export async function run<T>(job: (d: Device) => Promise<T>, busy = "", fail = (m: string) => f(t("Mouse: %s"), m)): Promise<T | undefined> {
  if (!device) {
    toast(t("Not connected"), "error");
    return undefined;
  }
  if (busy) set({ busy });
  try {
    return await job(device);
  } catch (e) {
    toast(fail(message(e)), "error");
    if (e instanceof HidppError && e.message.startsWith("write failed")) dropDevice("The receiver stopped answering");
    return undefined;
  } finally {
    if (busy) set({ busy: "" });
  }
}

// ---------------------------------------------------------------- connection

// HID++ lives on a vendor usage page: 0xFF43 on LIGHTSPEED receivers (c54f), 0xFF00 on older ones.
// Only the long-report collection (id 0x11) is asked for: Windows splits the short and long reports
// into separate devices, and every request here is a long one. Linux and macOS keep both in one device.
const FILTERS: HIDDeviceFilter[] = [
  { vendorId: 0x046d, usagePage: 0xff43, usage: 0x0302 }, // 0x0301 is the short-report collection
  { vendorId: 0x046d, usagePage: 0xff00, usage: 0x0002 },
];

const isHidpp = (d: HIDDevice) =>
  d.vendorId === 0x046d &&
  d.collections.some((c) => (c.usagePage === 0xff43 || c.usagePage === 0xff00) && c.outputReports?.some((r) => r.reportId === 0x11));

/** Opens the browser's device picker (needs a click), then loads everything. */
export async function connect() {
  if (!state.supported) return;
  try {
    const [d] = await navigator.hid.requestDevice({ filters: FILTERS });
    if (d && !isHidpp(d)) return set({ error: "This entry of the receiver can not send HID++ long reports. Pick the other one." });
    if (d) await openDevice(d);
  } catch (e) {
    set({ error: message(e) });
  }
}

/** Opens the simulated demo mouse (no browser picker, nothing is sent to a real mouse). */
export function connectDemo() {
  demo ??= demoDevice();
  return openDevice(demo);
}

/** `?demo` in the page address: start with the demo mouse. */
export const demoRequested = () => new URLSearchParams(location.search).has("demo");

let opening: Promise<boolean> | null = null;

/** Reconnects to a receiver the user already allowed, without a picker. */
export async function autoConnect() {
  if (state.status !== "disconnected" || opening) return;
  if (demoRequested()) return void connectDemo();
  if (!state.supported) return;
  const granted = (await navigator.hid.getDevices()).filter(isHidpp);
  for (const d of granted) {
    if (await openDevice(d, true)) return;
  }
}

/** One open at a time: a second call (React StrictMode runs effects twice) waits for the first. */
function openDevice(d: HIDDevice, quiet = false): Promise<boolean> {
  opening ??= doOpen(d, quiet).finally(() => (opening = null));
  return opening;
}

async function doOpen(d: HIDDevice, quiet: boolean): Promise<boolean> {
  set({ status: "connecting", error: "" });
  try {
    device = await Device.open(d, traffic);
    hidDevice = d;
    set({ status: "loading" });
    await loadAll(device, d.productId);
    return true;
  } catch (e) {
    console.warn("SuperStrike: could not open the receiver:", e);
    device = null;
    hidDevice = null;
    set({ status: "disconnected", error: quiet ? "" : message(e) });
    return false;
  }
}

function dropDevice(reason: string) {
  device = null;
  hidDevice = null;
  set({ status: "disconnected", info: null, error: reason, busy: "" });
}

export async function disconnect() {
  const d = hidDevice;
  dropDevice("");
  await d?.close().catch(() => undefined);
}

async function loadAll(d: Device, productId: number) {
  const info: DeviceInfo = {
    name: d.name || "PRO X3 SUPERSTRIKE",
    demo: hidDevice === demo,
    index: d.index,
    productId,
    firmware: await d.firmware(),
    battery: -1,
    batteryState: "",
    onboard: await d.onboardInfo(),
    mode: await d.onboardMode(),
    surface: -1,
    stage: 0,
    dpiList: await d.dpiList(),
    rates: await d.rateSupported().catch(() => [0, 1, 2, 3, 4, 5, 6]),
    features: await d.features(),
  };
  const b = await d.battery().catch(() => null);
  if (b) [info.battery, info.batteryState] = [b.percent, b.state];
  info.surface = await d.surfaceGet().catch(() => -1);
  const factory = parseProfile(FACTORY_SECTOR, await d.readSector(FACTORY_SECTOR));
  const active = await d.currentProfile();
  info.stage = await d.currentStage().catch(() => 0);

  let dirRaw = await d.readSector(DIR_SECTOR, 255, false);
  const blank = !sectorCrcOk(dirRaw);
  if (blank && !sectorBlank(dirRaw)) {
    throw new HidppError("the profile directory in the mouse memory is damaged (bad CRC). Restore a backup or reset the mouse with G HUB");
  }
  let dir: DirEntry[];
  const profiles: Record<number, Profile> = {};
  if (blank) {
    // Factory state: only the ROM directory (0x100) and ROM profile exist. Nothing is written until the first save.
    dirRaw = new Uint8Array(255).fill(0xff);
    dir = parseDirectory(await d.readSector(ROM_DIR_SECTOR)).filter((e) => e.sector === FACTORY_SECTOR);
    if (!dir.length) dir = [{ sector: FACTORY_SECTOR, enabled: true }];
    profiles[FACTORY_SECTOR] = cloneProfile(factory);
  } else {
    dir = parseDirectory(dirRaw);
    for (const e of dir) profiles[e.sector] = parseProfile(e.sector, await d.readSector(e.sector));
  }
  const edit = profiles[state.edit] ? state.edit : profiles[active] ? active : (dir[0]?.sector ?? -1);
  saved = { profiles: Object.fromEntries(Object.entries(profiles).map(([k, p]) => [k, cloneProfile(p)])), dir: dir.map((e) => ({ ...e })) };
  forced.clear();
  set({ status: "connected", info, dirRaw, dir, profiles, factory, active, edit, dirty: [], blank });
}

// ---------------------------------------------------------------- unsaved changes

/** What the mouse memory holds: taken on load and after each save. A sector is unsaved when it differs from this. */
let saved: { profiles: Record<number, Profile>; dir: DirEntry[] } = { profiles: {}, dir: [] };
/** Sectors marked unsaved without a change (screenshot states). */
const forced = new Set<number>();

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameDir = (a: DirEntry[], b: DirEntry[]) => a.length === b.length && a.every((e, i) => e.sector === b[i].sector && e.enabled === b[i].enabled);

/** Recomputes `dirty`: the profiles and the directory that differ from what the mouse holds. */
function refreshDirty() {
  const dirty = Object.values(state.profiles)
    .filter((p) => { const s = saved.profiles[p.sector]; return !s || !sameBytes(encodeProfile(p), encodeProfile(s)); })
    .map((p) => p.sector);
  if (!sameDir(state.dir, saved.dir)) dirty.push(DIR_SECTOR);
  for (const s of forced) if (!dirty.includes(s)) dirty.push(s);
  if (dirty.length !== state.dirty.length || dirty.some((s, i) => s !== state.dirty[i])) set({ dirty });
}

/** Drops every unsaved change at once, without reading the mouse again. The active profile's HITS, sent live while editing, go back too. */
export async function discard() {
  if (state.status !== "connected") return;
  const before = state.profiles[state.active];
  const profiles = Object.fromEntries(Object.entries(saved.profiles).map(([k, p]) => [k, cloneProfile(p)]));
  forced.clear();
  set({ profiles, dir: saved.dir.map((e) => ({ ...e })) });
  refreshDirty();
  const after = profiles[state.active];
  if (before && after) {
    const changed = [0, 1].filter((b) => JSON.stringify(before.hits[b]) !== JSON.stringify(after.hits[b]));
    if (changed.length) await run(async (d) => { for (const b of changed) await d.hitsSet(b, after.hits[b]); });
  }
  toast(t("Changes discarded"));
}

/** Re-reads everything from the mouse, dropping unsaved changes. */
export async function revert() {
  if (!device || !hidDevice) return;
  // the studio stays on screen under the busy overlay; only a first connect shows the connect screen
  set({ busy: t("Reading the mouse memory…") });
  try {
    await loadAll(device, hidDevice.productId);
    toast(t("Loaded from the mouse"));
  } catch (e) {
    toast(f(t("Mouse: %s"), message(e)), "error");
  } finally {
    set({ busy: "" });
  }
}

if (state.supported) {
  navigator.hid.addEventListener("disconnect", (e) => {
    if (e.device === hidDevice) dropDevice("Receiver unplugged");
  });
  navigator.hid.addEventListener("connect", () => void autoConnect());
  // battery every 60 s
  setInterval(async () => {
    if (state.status !== "connected" || !device || state.busy) return;
    try {
      const b = await device.battery();
      if (state.info) set({ info: { ...state.info, battery: b.percent, batteryState: b.state } });
    } catch {
      /* the mouse may sleep; the next poll tries again */
    }
  }, 60_000);
}

// ---------------------------------------------------------------- editing

export const currentProfile = (s: State): Profile | null => s.profiles[s.edit] ?? null;
export const slotOf = (s: State, sector: number) => Math.max(0, s.dir.findIndex((e) => e.sector === sector));

export function setEdit(sector: number) {
  set({ edit: sector });
}

/** Marks a sector unsaved without changing it (screenshot states). */
export function markDirty(sector: number) {
  forced.add(sector);
  refreshDirty();
}

/** Edits the profile being edited (or `sector`). It counts as unsaved while it differs from the mouse memory. */
export function updateProfile(fn: (p: Profile) => void, sector = state.edit) {
  const cur = state.profiles[sector];
  if (!cur) return;
  const p = cloneProfile(cur);
  fn(p);
  set((s) => ({ profiles: { ...s.profiles, [sector]: p } }));
  refreshDirty();
}

/** Copies all settings of `from` into `sector` (keeps that profile's name). Unsaved until save(). */
export function replaceProfile(sector: number, from: Profile) {
  updateProfile((p) => {
    const name = p.name;
    Object.assign(p, cloneProfile(from), { sector, name });
  }, sector);
}

/** Sends the edited profile's HITS for one button now, when it is the active profile. */
export async function liveHits(buttons: number[]) {
  const p = currentProfile(state);
  if (!p || state.edit !== state.active || state.status !== "connected") return;
  const hits: Hits[] = buttons.map((b) => p.hits[b]);
  await run(async (d) => {
    for (const [i, b] of buttons.entries()) await d.hitsSet(b, hits[i]);
  });
}

export function setDirEnabled(slot: number, on: boolean) {
  if (state.dir[slot].enabled === on) return;
  if (!on && state.dir.filter((e) => e.enabled).length <= 1) {
    toast(t("At least one profile must stay in the cycle"), "error");
    return;
  }
  set((s) => ({ dir: s.dir.map((e, i) => (i === slot ? { ...e, enabled: on } : e)) }));
  refreshDirty();
}

export async function activateProfile(sector: number) {
  if (state.dirty.includes(sector)) {
    toast(f(t("Save Profile %d first"), slotOf(state, sector) + 1), "error");
    return;
  }
  const now = await run(async (d) => {
    await d.setCurrentProfile(sector);
    return d.currentProfile();
  });
  if (now === undefined) return;
  set({ active: now, edit: now });
  toast(f(t("Profile %d is now active"), slotOf(state, now) + 1));
}

/** Switches the mouse to DPI stage n of the active profile now (a click on a stage chip). */
export async function setStage(n: number) {
  const ok = await run((d) => d.setCurrentStage(n));
  if (ok === undefined || !state.info) return;
  set({ info: { ...state.info, stage: n } });
  toast(state.dirty.includes(state.edit)
    ? f(t("Mouse now uses stage %d — save (Ctrl+S) to feel your new DPI values"), n + 1)
    : f(t("Mouse now uses stage %d"), n + 1));
}

export async function setSurface(mode: number) {
  const ok = await run((d) => d.surfaceSet(mode));
  if (ok === undefined || !state.info) return;
  set({ info: { ...state.info, surface: mode } });
  toast(t("Surface mode set"));
}

export async function setControlMode(mode: number) {
  const ok = await run((d) => d.setOnboardMode(mode), "", (m) => f(t("Could not change the control mode: %s"), m));
  if (ok === undefined || !state.info) return;
  set({ info: { ...state.info, mode } });
  toast(t(mode === MODE_ONBOARD ? "Onboard memory mode" : "Host mode: saved profiles are ignored until you switch back"));
}

// ---------------------------------------------------------------- saving

/**
 * First save on a mouse in factory state: creates the onboard profiles like G HUB does. Profile 1
 * gets the edited settings, the others are copies of the factory profile; only Profile 1 is in the
 * cycle. Profiles are written before the directory, so a failure part way leaves the factory state.
 */
async function setupOnboard() {
  const edited = state.profiles[FACTORY_SECTOR];
  const factory = state.factory;
  if (!edited || !factory) return;
  const count = Math.min(5, Math.max(1, state.info?.onboard?.profiles ?? 5));
  if (!hasLeftClick(edited) && !(await confirmNoLeftClick())) return;
  if (!(await confirmDialog(
    "Create onboard profiles",
    `The mouse has no saved profiles yet: it runs on its built-in factory profile. ` +
    `Saving creates ${count} onboard profiles in the mouse memory, like G HUB does: Profile 1 with your changes, ` +
    `the others as copies of the factory profile. A backup is made first.`,
    t("Save"),
  ))) return;
  const sectors = Array.from({ length: count }, (_, i) => i + 1);
  const ok = await run(async (d) => {
    storeAutoBackup(await backupJson(d));
    backedUp = true;
    for (const s of sectors) await d.writeSector(s, encodeProfile({ ...(s === 1 ? edited : factory), sector: s }));
    const dir = sectors.map((s) => ({ sector: s, enabled: s === 1 }));
    await d.writeSector(DIR_SECTOR, encodeDirectory(new Uint8Array(255).fill(0xff), dir));
    await d.setCurrentProfile(1);
    await new Promise((r) => setTimeout(r, 100));
    for (const b of [0, 1]) await d.hitsSet(b, edited.hits[b]);
    return true;
  }, "Setting up onboard profiles…", saveFailed);
  if (!ok) return;
  set({ edit: 1 });
  await revert();
  toast("Onboard profiles created — Profile 1 is active and has your settings");
}

const saveFailed = (m: string) => f(t("Save failed: %s. Backups: %s"), m, "this browser");

const confirmNoLeftClick = () => confirmDialog(
  t("No button does Left click"), t("After saving, no button on this profile sends a left click. Save anyway?"), t("Save anyway"), "destructive",
);

/** Writes every unsaved sector. Makes a whole-memory backup first, once per session. */
export async function save() {
  if (state.status !== "connected" || !state.dirty.length) return;
  if (state.blank) return setupOnboard();
  const noLeftClick = state.dirty.some((s) => s !== DIR_SECTOR && !hasLeftClick(state.profiles[s]));
  if (noLeftClick && !(await confirmNoLeftClick())) return;
  if (state.status !== "connected" || !state.dirty.length) return;
  const writes = state.dirty.filter((s) => s !== DIR_SECTOR).map((s) => ({ sector: s, raw: encodeProfile(state.profiles[s]) }));
  const dirNew = state.dirty.includes(DIR_SECTOR) ? encodeDirectory(state.dirRaw, state.dir) : null;
  const active = state.active;
  const stage = state.info?.stage ?? 0;
  const result = await run(async (d) => {
    if (!backedUp) {
      storeAutoBackup(await backupJson(d));
      backedUp = true;
    }
    const written: { sector: number; raw: Uint8Array }[] = [];
    for (const w of writes) written.push({ sector: w.sector, raw: await d.writeSector(w.sector, w.raw) });
    const dirWritten = dirNew ? await d.writeSector(DIR_SECTOR, dirNew) : null;
    for (const w of written) {
      if (w.sector !== active) continue;
      await d.setCurrentProfile(active); // reload so DPI, rate and buttons apply now
      await new Promise((r) => setTimeout(r, 100));
      const p = parseProfile(active, w.raw);
      for (const b of [0, 1]) await d.hitsSet(b, p.hits[b]);
      if (p.stages[stage]?.x) await d.setCurrentStage(stage); // a reload resets the stage
    }
    return { written, dirWritten };
  }, t("Writing to the mouse memory…"), saveFailed);
  if (!result) return;
  // what was written is now the saved state; edits made while writing stay unsaved
  for (const w of result.written) saved.profiles[w.sector] = parseProfile(w.sector, w.raw);
  if (result.dirWritten) saved.dir = parseDirectory(result.dirWritten);
  forced.clear();
  set((s) => {
    const profiles = { ...s.profiles };
    for (const w of result.written) if (sameBytes(encodeProfile(profiles[w.sector]), writes.find((x) => x.sector === w.sector)!.raw)) profiles[w.sector] = parseProfile(w.sector, w.raw);
    return { profiles, dirRaw: result.dirWritten ?? s.dirRaw };
  });
  refreshDirty();
  toast(t("Saved in the mouse — it now works without this app"));
}

export async function backupNow(): Promise<string | undefined> {
  return run((d) => backupJson(d), "Reading the whole memory…", (m) => f(t("Backup failed: %s"), m));
}

export async function restoreBackup(text: string) {
  const secs = parseBackup(text);
  if (typeof secs === "string") {
    toast(f(t("Restore failed: %s"), secs), "error");
    return;
  }
  const ok = await run(async (d) => {
    storeAutoBackup(await backupJson(d)); // the current memory, in case the restore was a mistake
    await restoreSectors(d, secs);
    return true;
  }, "Restoring memory…", (m) => f(t("Restore failed: %s"), m));
  if (!ok) return;
  toast(t("Memory restored"));
  await revert();
}

// ---------------------------------------------------------------- local settings

export function savePreset(name: string, code: string) {
  const presets = [...state.presets.filter((p) => p.name !== name), { name, code }];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  set({ presets });
}

export function deletePreset(name: string) {
  const presets = state.presets.filter((p) => p.name !== name);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  set({ presets });
}

export function setLook(shell: string, accent: string) {
  localStorage.setItem(LOOK_KEY, JSON.stringify({ shell, accent }));
  set({ shell, accent });
}
