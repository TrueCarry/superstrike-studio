// HITS (click) actions shared by the Click panel, the feel library and quick setup.
import { entryDialog } from "../components/dialogs";
import type { Hits } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { hitsCodeDecode, hitsCodeEncode } from "../model/profile";
import { currentProfile, getState, liveHits, savePreset, toast, updateProfile } from "./store";

export const clampHits = (h: Hits): Hits => ({
  act: Math.min(10, Math.max(1, h.act)),
  rt: Math.min(5, Math.max(1, h.rt)),
  rtOn: h.rtOn,
  hap: Math.min(5, Math.max(0, h.hap)),
});
/** Short value shown in the callout boxes: the level, or "off". */
export const rtText = (h: Hits) => (h.rtOn ? String(h.rt) : tc("level value", "off"));
export const same = (a: Hits, b: Hits) => a.act === b.act && a.rt === b.rt && a.rtOn === b.rtOn && a.hap === b.hap;

export function summary(h: [Hits, Hits]) {
  const pair = (get: (x: Hits) => string) => (get(h[0]) === get(h[1]) ? get(h[0]) : `${get(h[0])} / ${get(h[1])}`);
  return f(t("Actuation %s   Rapid trigger %s   Haptics %s"), pair((x) => String(x.act)), pair(rtText), pair((x) => String(x.hap)));
}

/** Applies both buttons' HITS to the edited profile, and to the mouse now when it is the active one. */
export function commit(v: [Hits, Hits]) {
  const p = currentProfile(getState());
  if (!p) return;
  const next: [Hits, Hits] = [clampHits(v[0]), clampHits(v[1])];
  const changed = [0, 1].filter((b) => !same(p.hits[b], next[b]));
  if (!changed.length) return;
  updateProfile((q) => (q.hits = next));
  void liveHits(changed);
}

export function applyPreset(name: string, v: [Hits, Hits]) {
  if (!currentProfile(getState())) return;
  commit(v);
  toast(f(t('Preset "%s" applied. Press Save to mouse to keep it.'), name));
}

export async function copyCode() {
  const p = currentProfile(getState());
  if (!p) return;
  const code = hitsCodeEncode(p.hits);
  await navigator.clipboard?.writeText(code).catch(() => undefined);
  toast(f(t("HITS code copied: %s"), code));
}

export async function importCode() {
  const text = await entryDialog(t("Import HITS code"), t("Paste a HITS code from G HUB, a pro player or a friend."), "MDAwNjA2MDEwMTExMDUwMw==", t("Apply"));
  if (text === null) return;
  const v = hitsCodeDecode(text);
  if (typeof v === "string") return toast(v ? f(t("Not a valid HITS code: %s"), v) : t("Not a valid HITS code"), "error");
  applyPreset(t("HITS code"), v);
}

export async function saveCurrent() {
  const name = await entryDialog(t("Save HITS preset"), t("Name for the current left and right button settings."), t("My preset"), t("Save"));
  const p = currentProfile(getState());
  if (!name || !p) return;
  savePreset(name, hitsCodeEncode(p.hits));
  toast(f(t('Preset "%s" saved'), name));
}
