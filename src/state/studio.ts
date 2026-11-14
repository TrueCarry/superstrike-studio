// What the studio has picked, shared by the large mouse and the panel next to it: the button(s) the
// click settings apply to, the button being remapped and its layer, the mouse view, and quick setup.
import { useSyncExternalStore } from "react";
import type { View } from "../illustrations/picture";

export type Target = "left" | "right" | "both";

export interface Studio {
  target: Target;
  button: number; // index into BUTTON_ZONES
  layer: number; // 0 normal, 1 DPI-shift layer
  view: View;
  setup: boolean; // quick setup open
  test: boolean; // the large mouse is the click test area
}

let studio: Studio = { target: "left", button: 0, layer: 0, view: "top", setup: false, test: false };
const listeners = new Set<() => void>();

export const getStudio = () => studio;
export function setStudio(patch: Partial<Studio>) {
  studio = { ...studio, ...patch };
  listeners.forEach((l) => l());
}
export function useStudio<T>(select: (s: Studio) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => select(studio),
  );
}
