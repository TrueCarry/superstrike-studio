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

if (typeof window !== "undefined") {
  // The side buttons would otherwise make the browser go back / forward and leave the app.
  for (const type of ["mouseup", "mousedown", "auxclick"] as const)
    window.addEventListener(type, (e) => {
      if (e.button === 3 || e.button === 4) e.preventDefault();
    });
  window.addEventListener("pointerdown", (e) => BUTTON_ZONE[e.button] && inputPress(BUTTON_ZONE[e.button], true));
  window.addEventListener("pointerup", (e) => BUTTON_ZONE[e.button] && inputPress(BUTTON_ZONE[e.button], false));
  window.addEventListener("blur", () => input.pressed.size && set({ pressed: new Set() }));
  window.addEventListener("wheel", (e) => e.deltaY && inputWheel(Math.sign(e.deltaY)), { passive: true });
}

export function useMouseInput(): MouseInput {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => input);
}
