// Live mouse input from the page: which buttons are held, and wheel steps. One shared store, so
// the screenshot mode (?demo&press=1) can feed a press and a scroll like the native --shot did.
import { useSyncExternalStore } from "react";
import type { Zone } from "../model/tables";

// MouseEvent.button -> zone
export const BUTTON_ZONE: Record<number, Zone> = { 0: "btn-left", 1: "btn-middle", 2: "btn-right", 3: "btn-back", 4: "btn-forward" };

export interface MouseInput {
  pressed: ReadonlySet<Zone>;
  /** changes on every wheel step */
  wheelTick: number;
  /** notches of the last step, > 0 = wheel rolled toward the palm (scroll down) */
  wheelDelta: number;
}

let input: MouseInput = { pressed: new Set(), wheelTick: 0, wheelDelta: 1 };
export const getMouseInput = () => input;
const listeners = new Set<() => void>();
const set = (patch: Partial<MouseInput>) => {
  input = { ...input, ...patch };
  listeners.forEach((l) => l());
};

export function inputPress(zone: Zone, down: boolean) {
  if (input.pressed.has(zone) === down) return;
  const pressed = new Set(input.pressed);
  if (down) pressed.add(zone);
  else pressed.delete(zone);
  set({ pressed });
}

export function inputWheel(notches: number) {
  set({ wheelTick: input.wheelTick + 1, wheelDelta: notches });
}

/** What the mouse did on this page since it opened: presses, wheel notches and pointer travel in CSS px. */
export const session = { since: Date.now(), clicks: 0, notches: 0, travel: 0 };
let lastPointer: [number, number] | null = null;

if (typeof window !== "undefined") {
  // Mouse buttons are for trying the mouse here, not for the browser: the side buttons would go back /
  // forward and leave the app, the middle one would start autoscroll, paste (Linux) or open links in a tab.
  for (const type of ["mouseup", "mousedown", "auxclick"] as const)
    window.addEventListener(type, (e) => {
      if (e.button === 1 || e.button === 3 || e.button === 4) e.preventDefault();
    });
  // No browser menu on right click, except in text fields (paste a HITS code, a preset name).
  window.addEventListener("contextmenu", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el?.closest("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]), textarea, [contenteditable=true]")) e.preventDefault();
  });
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") session.clicks++;
    if (BUTTON_ZONE[e.button]) inputPress(BUTTON_ZONE[e.button], true);
  });
  window.addEventListener("pointerup", (e) => BUTTON_ZONE[e.button] && inputPress(BUTTON_ZONE[e.button], false));
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    if (lastPointer) session.travel += Math.hypot(e.screenX - lastPointer[0], e.screenY - lastPointer[1]);
    lastPointer = [e.screenX, e.screenY];
  }, { passive: true });
  window.addEventListener("blur", () => {
    lastPointer = null;
    if (input.pressed.size) set({ pressed: new Set() });
  });
  window.addEventListener("wheel", (e) => {
    if (!e.deltaY) return;
    session.notches++;
    inputWheel(Math.sign(e.deltaY));
  }, { passive: true });
}

export function useMouseInput(): MouseInput {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => input);
}
